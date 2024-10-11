<?php

namespace App\Http\Controllers\ItemContent;

use App\Http\Controllers\Controller;
use App\GlobalConstants;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Log;
use App\Http\Helpers;
use App\Models\File;
use App\Models\Folder;
use Illuminate\Support\Facades\DB;

class ItemDownloadController extends Controller
{
    public function getLinkShareFileDownload(Request $request): JsonResponse
    {
        Helpers::checkClassBOps();

        $request->validate([ // Leave as itemIds and other multi-id stuff in this function for now in frontend and backend for this in case link-shared folder downloading is implemented in future
            'itemIds' => 'required|array',
            'itemIds.*' => 'required|ext_max_length',
            'fileAccessToken' => 'required|string|max:255|regex:/.*-.*-.*$/',
        ]);
        $itemIds = $request['itemIds'];
        
        try {
            if (count($itemIds) !== 1 || Helpers::isFrontendFolderIdFormat($itemIds[0])) {
                throw New \Exception("Link-shared folder downloads not yet implemented.");
            }

            // If user only wants to download one file. No "belongsTo" authorisation since link-share. int for larastan
            // No is_uploaded check as getFileAccessTokens() public func has it
            $file = File::query()->findOrFail((int) $itemIds[0]);

            if ($request['fileAccessToken'] !== $file->getAccessToken()) {
                throw New \Exception("Invalid file access token.");
            }

            return $this->returnSingleFileDownload($file, $request->ip());
        }
        catch (\Exception $e) {
            Log::error($e);
            $message = ""; // Don't need to check for validation error in the first if statement since it would be unlikely for that error if user retrieved link-share file already
            if (
                $e->getMessage() === "Invalid file access token." ||
                $e->getCode() === '22P02' ||
                ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException && $e->getModel() === File::class)
            ) {
                $message = "Invalid file access token.";
            } else {
                $message = "Something went wrong.";
            }
            return response()->json(['message' => $message], 500);
        }
    }

    public function getItemDownload(Request $request): JsonResponse|StreamedResponse
    {
        try {     
            Helpers::checkClassBOps();
       
            $request->validate([
                'itemIds' => 'required|array|max:' . GlobalConstants::get('MAX_USER_ITEM_NUM'),
                'itemIds.*' => 'required|ext_max_length',
            ]);

            // topLvlItems means the items that the user directly selected (not necessarily root items).
            $topLvlItemDbIds = Helpers::convertFrontendItemIdsToDbIds($request['itemIds']);
            $topLvlFileIds = $topLvlItemDbIds['fileIds'];
            $topLvlFolderIds = $topLvlItemDbIds['folderIds'];

            // If user only wants to download one file (keep in main function as res needs to be returned)
            if (count($topLvlFileIds) === 1 && empty($topLvlFolderIds)) {
                $file = Helpers::authFindOrFailModel($topLvlFileIds[0], File::class, ['name', 'is_sample'], confirmUploadedFiles: true);
                return $this->returnSingleFileDownload($file, $request->ip());
            }

            // Validate topLvlItems separately first for efficiency
            $topLvlItems = $this->getValidatedTopLevelItems($topLvlFileIds, $topLvlFolderIds);

            $commonParentFolderId = $this->checkSameParentAndGetId($topLvlItems);

            $zipName = $this->getZipName($topLvlItems, $commonParentFolderId);

            $itemsToZip = $this->getItemsToZip($topLvlFileIds, $topLvlFolderIds, $request->ip());
        
            return response()->json(array_merge($itemsToZip, [
                'zipName' => $zipName
            ]));
        }
        catch (\Exception $e) {
            Log::error($e);
            return response()->json(['message' => "Something went wrong."], 500);
        }
    }

    private function getValidatedTopLevelItems(array $topLvlFileIds, array $topLvlFolderIds): array
    {
        $topLvlFiles = [];
        $topLvlFolders = [];
        $extraColumns = ['name', 'parent_folder_id']; // Don't need app_path as zip paths are different. Name is for zip name

        if (!empty($topLvlFileIds)) {
            $topLvlFiles = Helpers::authFindOrFailCollection($topLvlFileIds, File::class, $extraColumns, confirmUploadedFiles: true)->toArray();
        }

        if (!empty($topLvlFolderIds)) {
            $topLvlFolders = Helpers::authFindOrFailCollection($topLvlFolderIds, Folder::class, $extraColumns)->toArray();
        }

        return array_merge($topLvlFiles, $topLvlFolders);
    }

    private function checkSameParentAndGetId(array $topLvlItems): ?int
    {        
        $topLvlParentFolderIds = array_column($topLvlItems, 'parent_folder_id');
        
        if (count(array_unique($topLvlParentFolderIds)) > 1) { // Check if all items have the same parentFolderId
            throw new \Exception('All topLvlItems are not in the same folder.');
        }

        return $topLvlParentFolderIds[0]; // If all items have same parentFolderId then [0] (and any other element) will have the common parent folder id
    }

    private function getZipName(array $topLvlItems, ?int $commonParentFolderId): string
    {        
        // If single folder, then zipName should also be that folder's name with .zip (single files are already checked before, so [0] will have the correct single folder name)
        if (count($topLvlItems) === 1) { 
            $zipName = $topLvlItems[0]['name'] . ".zip";
        }
        // There is more than one topLvlItem AND they are from the root
        else if ($commonParentFolderId === null) {
            $zipName = "LimeDrive.zip";
        } 
        // Otherwise it should have the parent folder's name of the topLvlItems
        else {
            $parentFolder = Helpers::authFindOrFailModel($commonParentFolderId, Folder::class, ['name']);
            $zipName = $parentFolder->name . ".zip";
        }

        return $zipName;
    }

    private function getItemsToZip(array $topLvlFileIds, array $topLvlFolderIds, string $userIp): array
    {
        $itemsForZipQuery = DB::select("
            WITH RECURSIVE folder_cte AS (
                SELECT
                    id,
                    parent_folder_id,
                    name::character varying AS zip_path     -- Return zip path for frontend to correctly zip
                FROM folders
                WHERE id = ANY(:topLvlFolderIds)
                UNION ALL
                SELECT
                    fo.id,
                    fo.parent_folder_id,
                    folder_cte.zip_path || '/' || fo.name AS zip_path
                FROM folders fo
                INNER JOIN folder_cte ON fo.parent_folder_id = folder_cte.id
            ),
            file_cte AS ( -- Not recursive here as files don't have child items
                SELECT
                    id,
                    name,   -- Return name for getting cloud path
                    is_sample,
                    name::character varying AS zip_path
                FROM files
                WHERE id = ANY(:topLvlFileIds)  -- is_uploaded check not needed here as it's checked in authFindOrFailCollection
                UNION ALL
                SELECT 
                    fi.id,
                    fi.name,
                    is_sample,
                    folder_cte.zip_path || '/' || fi.name AS zip_path
                FROM files fi
                INNER JOIN folder_cte 
                    ON fi.parent_folder_id = folder_cte.id 
                    AND fi.is_uploaded = true
            )
            SELECT json_build_object(
                'folders', (
                    SELECT json_agg(json_build_object(
                        'zip_path', foc.zip_path
                    ))
                    FROM folder_cte foc
                ),
                'files', (
                    SELECT json_agg(json_build_object(
                        'id', fic.id,
                        'name', fic.name,
                        'is_sample', fic.is_sample, -- Leave snake_case
                        'zip_path', fic.zip_path
                    ))                              -- Don't need to return is_uploaded (they are excluded from inner join)
                    FROM file_cte fic
                )
            ) AS items            
        ", [
            'topLvlFolderIds' => '{' . implode(',', $topLvlFolderIds) . '}',
            'topLvlFileIds' => '{' . implode(',', $topLvlFileIds) . '}',
        ]);

        $items = json_decode($itemsForZipQuery[0]->items, true);

        /** @var \Illuminate\Database\Eloquent\Collection<key, \App\Models\File> $files */
        $files = File::query()->hydrate($items['files'] ?? []);
        $filesToZip = [];

        foreach ($files as $file) {
            $filesToZip[] = [
                'zipPath' => $file->zip_path,
                'url' => $file->getPresignedUrl($userIp, now()->addMinutes(15), false) // Longer expiry in case it takes long for frontend to download
            ];
        }

        $folders = $items['folders'] ?? [];
        $foldersToZip = [];

        foreach ($folders as $folder) {
            $foldersToZip[] = [
                'zipPath' => $folder['zip_path']
            ];
        }

        return [
            'filesToZip' => $filesToZip,
            'foldersToZip' => $foldersToZip
        ];
    }

    private function returnSingleFileDownload(File $file, string $userIp): JsonResponse
    {    
        $fileUrl = $file->getPresignedUrl($userIp, now()->addMinutes(2), false); // Download still continues even after url is expired

        return response()->json(['downloadUrl' => $fileUrl]);
    }
}