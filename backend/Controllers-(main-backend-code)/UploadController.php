<?php

namespace App\Http\Controllers\ItemManagement;

use App\Http\Controllers\Controller;
use App\GlobalConstants;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Http\Helpers;
use App\Models\File;
use App\Models\Folder;
use App\Models\User;
use App\Models\BucketStorage;
use Exception;
use App\Exceptions\StorageCapExceedableException;
use Illuminate\Http\JsonResponse;
use Aws\S3\S3Client;
use Illuminate\Validation\ValidationException;

class UploadController extends Controller
{
    private const MAX_USER_FILE_SIZE = 200 * 1024 * 1024; # 200 MiB (account limits are in binary units, so not MB, even if the frontend UI says MB for UX reasons)
    private const MAX_DEV_BUCKET_USAGE = 200 * 1024 * 1024;
    private const FILE_NOT_FOUND_IN_BUCKET_ERR_MSG = "File not found in bucket.";

    public function uploadFileMetadata(Request $request): JsonResponse
    {
        try {
            $this->validateFileMetadataRequest($request);

            /** @var int $userId (PHPStan) */
            $userId = auth()->id();
            
            $user = Helpers::getUserOrFail($userId); // Don't use auth()->user() as DB needs to be accessed
            $bucketStorage = Helpers::getBucketStorage();

            $this->checkStorageLimits($request['size'], $user, $bucketStorage);

            $this->checkFileCount($userId);

            $this->checkFileNameConflict($userId, $request['parentFolderId'], $request['name']); 

            Helpers::checkClassAOps();

            DB::beginTransaction();

            $newFile = $this->storeFileReferenceInDb($request, $userId);
            
            $uploadUrl = $this->getUploadUrl($newFile);

            DB::commit();

            return $this->createFileMetadataSuccessResponse($newFile, $uploadUrl);
        } 
        catch (Exception $e) {
            DB::rollBack();
            return $this->createExceptionResponse($e);
        }
    }

    private function validateFileMetadataRequest(Request $request): void
    {
        $request->validate([
            'name' => 'required|string|ext_max_length',
            'size' => 'required|integer|min:0|max:' . self::MAX_USER_FILE_SIZE, // Don't use ext_max_length here
            'type' => 'required|string|ext_max_length',
            'parentFolderId' => 'nullable|integer|ext_max_length', // null means parent is root
             // May be null, even on media files if their format is not supported for extracting duration.
             // numeric as it can be float, not just integer (float doesn't have a request validator as of writing this)
            'mediaDuration' => 'nullable|numeric|min:0|ext_max_length',
        ]);

        $this->validateItemName($request['name']); // don't put in the above validator function for consistency with global constants
    }

    private function validateItemName(string $itemName): void
    {
        if ( // Not using regex as it's more error-prone and not as readable
            strpbrk($itemName, GlobalConstants::get('INVALID_ITEM_NAME_CHARS')) !== false // Leave !== false
            || strlen($itemName) > 255
            || strlen($itemName) < 1
        ) {
            throw new Exception('Invalid item name.');
        }
    }

    private function checkStorageLimits(int $fileSize, User $user, BucketStorage $bucketStorage): void
    {
        if ($fileSize + $user->account_storage_used > $user->account_storage_cap) {
            throw new StorageCapExceedableException("Account storage cap", $user->account_storage_cap);
        }

        $this->checkBucketStorageLimit($fileSize, $bucketStorage);
    }

    private function checkBucketStorageLimit(int $fileSize, BucketStorage $bucketStorage): void
    {
        if ($fileSize + $bucketStorage->used >= $bucketStorage->cap) { // Intentionally without buffer here to only delete as necessary
            Helpers::deleteAccountsForSpace($bucketStorage); // Is called conditionally here as last resort if the limit is reached before the DeleteAccountsForSpace command has run again - since a buffer is used in the helper to allow the usage to fill past the buffer before the helper needs to be called from this controller (due to efficiency/speed reasons - prevent account pruning on every upload once bucket limit is close, so instead the call from the command runs it in the background for batching using the buffer)

            $bucketStorage->refresh(); // For accurate recalculation. Use refresh instead of fresh

            if ($fileSize + $bucketStorage->used >= $bucketStorage->cap) { // If the helper still didn't manage to free enough space for some reason (e.g. user accounts may have failed to delete).
                throw New Exception("CRITICAL: File size would still reach bucket limit despite helper call.");
            } // Don't notify admin here since it's handled in the helper

            // If the current user is also deleted then it will expire their session (as it should)
        }

        if (config('app.bucket_hard_storage_cap_reached')) {
            throw new \Exception("Failed upload: bucket hard storage cap from config reached."); // Don't use StorageCapExceedableException
        }

        // $bucketStorage->used here would be from dev db since for dev environment only dev db is used
        if (Helpers::isEnvLocal() && $fileSize + $bucketStorage->used > self::MAX_DEV_BUCKET_USAGE) {
            throw new StorageCapExceedableException("Max development bucket usage", self::MAX_DEV_BUCKET_USAGE);
        }
    }

    private function checkFileCount(int $userId): void
    {
        $filesCount = File::where('user_id', $userId)->count(); // Still include unuploaded files so users don't abuse it
        if ($filesCount >= GlobalConstants::get('MAX_USER_FILE_NUM')) {
            throw new \Exception(GlobalConstants::get('MAX_ITEM_NUM_ERR_MSG'));
        }
    }

    private function checkFileNameConflict(int $userId, ?int $parentFolderId, string $name): void
    {
        // Here since checking name conflict on DB level wasn't supported with UQ idx/constraint (subquery limitation on idx) 
        // for is_uploaded = false with is_uploaded = true files (although if both are true a UQ constraint handles that)
        // since the new file being uploaded would technically have is_uploaded = false
        // BUT if is_uploaded is false for the "conflicting" rows then it's allowed (useful for failed uploads that user wants to retry).
        // All the fields here are indexed already.
        $conflictingUploadedFile = File::query()
            ->where('user_id', $userId)
            ->when($parentFolderId === null, 
                fn($q) => $q->whereNull('parent_folder_id'),
                fn($q) => $q->where('parent_folder_id', $parentFolderId)
            )
            ->where('name', $name)
            ->where('is_uploaded', true)
            ->exists();
        // Leave the order so it better matches the UQ index on the DB to possibly better use the index.

        if ($conflictingUploadedFile) {
            throw new \Exception(GlobalConstants::get('DUPLICATE_NAME_ERR_MSG'));
        }
    }

    private function storeFileReferenceInDb(Request $request, int $userId): File
    {
        // Extension is not used in very important checks, so client-given name and extension may be better for UX as LimeDrive's security doesn't rely on it (balance security with user expectation)
        $name = $request['name'];
        $parentFolderDbId = $request['parentFolderId'] ?? null;

        return File::create([
            'name' => $name,
            'type' => $request['type'],
            'size' => $request['size'],
            'media_duration' => $request['mediaDuration'],
            'created_at' => now(),
            'is_uploaded' => false,
            'app_path' => $this->constructAppPath($name, $parentFolderDbId),
            'parent_folder_id' => $parentFolderDbId, // FK constraint prevents folder's parent_folder_id from being saved as its own id
            'user_id' => $userId,
        ]);
    }

    private function getUploadUrl(File $newFile): string
    {
        $s3Client = new S3Client([
            'credentials' => [
                'key' => config('filesystems.disks.s3.key'),
                'secret' => config('filesystems.disks.s3.secret'),
            ],
            'endpoint' => config('filesystems.disks.s3.endpoint'),
            'region' => config('filesystems.disks.s3.region'),
            'version' => 'latest',
        ]);

        // cloudPath format for user files on bucket: user_files/<fileId>.<extension>
        $newFilePathOnBucket = $newFile->getCloudPath();

        // A user spamming very large number of requests to same PutObject url would lead to mostly UNbilled class A operations
        // Cloudflare has DDoS protection
        $command = $s3Client->getCommand('PutObject', [
            'Bucket' => config('filesystems.disks.s3.bucket'),
            'Key' => $newFilePathOnBucket,
            // File must be exactly this large. If the client-side size mimatches once the url is passed to it then the request will be rejected
            'ContentLength' => $newFile->size, 
            // Even though this isn't enforced by the bucket unlike ContentLength, still set it
            'ContentType' => $newFile->type,
            // IfNoneMatch wouldn't prevent class A ops if requests fail due to it
            // Commented out md5 validation (tried to use frontend to generate but was possible inaccurate, may revisit in future)
            // When uploading, a supplied md5 will be checked by cloudflare to make sure it matches (helps with making sure that file was not corrupted)
            // 'ContentMD5' => base64_encode(hex2bin($newFile->md5)),
            // Don't store the metadata here of the File that's already stored on the LimeDrive database - no point in doing so.
        ]);
        
        // If url expires during upload then it will still allow the ongoing upload to continue. 
        // Expiration is short to reduce chance of misuse. For multipart upload each step however 
        // would need to be started before expiration
        $presignedRequest = $s3Client->createPresignedRequest($command, '+10 seconds'); 

        return $presignedRequest->getUri();
    }

    private function createFileMetadataSuccessResponse(File $newFile, string $uploadUrl): JsonResponse
    {
        return response()->json([
            'id' => $newFile->id,
            'uploadUrl' => $uploadUrl,
        ]); 
    }

    private function createExceptionResponse(Exception $e): JsonResponse
    {
        Log::error($e);

        // Don't use $e->errorInfo[1] in case it changes
        if (($e instanceof QueryException && $e->getCode() === '23505') || $e->getMessage() === GlobalConstants::get('DUPLICATE_NAME_ERR_MSG')) {
            // Frontend UploadInfo component can handle matching the error with that specific file. 
            // Also there is already a conflict check beforehand on the frontend but a user may have 
            // moved a conflicting file to the same target folder just before it has finished uploading, 
            // so this is to inform them, likewise if they create folders with conflicting names in quick succession
            return response()->json(['message' => GlobalConstants::get('DUPLICATE_NAME_ERR_MSG')], 422); 
        } 
        elseif ($e->getMessage() === GlobalConstants::get('MAX_ITEM_NUM_ERR_MSG')) {
            return response()->json(['message' => GlobalConstants::get('MAX_ITEM_NUM_ERR_MSG')], 500);
        } 
        elseif ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException && $e->getModel() === \App\Models\Folder::class) {
            // This would only happen on a failed findOrFail on a parent folder
            return response()->json(['message' => 'Parent folder not found.'], 422);
        }
        elseif ($e instanceof StorageCapExceedableException && $e->getLimitType() === "Account storage cap") {
            return response()->json(['message' => GlobalConstants::get('ACCOUNT_STORAGE_CAP_ERR_MSG')], 422);
        }
        elseif ($e->getMessage() === 'Invalid item name.') { // Leave this for unit tests
            return response()->json(['message' => 'Invalid item name.'], 422);
        }
        else {
            return response()->json(['message' => "Something went wrong."], 500);
        }
    }

    public function confirmFileUploadToBucket(Request $request): JsonResponse
    {
        $request->validate([
            'fileId' => 'required|integer|ext_max_length',
        ]);

        try {
            $file = $this->findFile($request['fileId']);

            // Don't need to do anything else here, the file should be left alone on the DB and bucket in this case.
            // If it's an orphaned DB reference for whatever reason, then let the scheduled command handle that.
            // Throw exception so user's storage usage isn't updated.
            if ($file->is_uploaded) {
                throw New Exception("File was already marked as uploaded.");
            }

            // Handle case where file DOES exist on DB and NOT marked as uploaded (the expected situation).
            $this->confirmAndUpdateFile($file);
            
            // accountStorageUsed in frontend would be derived from fileSize
            return response()->json([
                Helpers::mapDbFilesForResponse(collect([$file]))->firstOrFail()
            ]); 
        }
        catch (Exception $e) {
            return $this->createExceptionResponse($e);
        }
    }

    private function findFile(int $fileId): File
    {
        return Helpers::authFindOrFailModel(
            $fileId, 
            File::class, 
            ['name', 'size', 'is_sample', 'app_path', 'created_at', 'type', 'media_duration', 'parent_folder_id', 'is_uploaded'],
            confirmUploadedFiles: false // If this arg was true it would be for confirming if uploaded, so leave it false and let ->is_uploaded check handle it after
        ); // Even though it won't be sample file, leave is_sample retrieval to not cause possible issues elsewhere. Some other columns are for frontend
    
        // Don't delete possible "orphaned" bucket object in case file not found from this endpoint 
        // (let scheduled command handled it), as it may otherwise lead to a race condition where 
        // user may be able to delete another user's bucket object if sending a request for a file higher 
        // than last auto-incremented id, which means during an orphan deletion if a new object was uploaded 
        // in that short time frame which would now be considered NOT orphaned then (since that auto-incremented id would now exist in the DB) 
        // it could cause that object to be deleted
    }

    private function confirmAndUpdateFile(File $file): void
    {
        try {
            $this->checkFileExistsInBucket($file);
            
            DB::beginTransaction();
        
            // Only updating this once upload to bucket is confirmed
            // DB constraints prevents qouta from exceeding
            $file->update(['is_uploaded' => 'true']);

            $this->updateStorageUsage($file['size']);
            
            DB::commit();
        } 
        catch (Exception $e) {
            DB::rollBack();
            // Removing data as if the file was never attempted to be uploaded
            // Don't need to update usage here as it would be rolled back if it was updated in the try
            $this->handleFailedConfirmation($file, $e);
            throw $e;
        }
    }

    private function checkFileExistsInBucket(File $file): void
    {
        if (!Storage::exists($file->getCloudPath())) {
            throw new Exception(self::FILE_NOT_FOUND_IN_BUCKET_ERR_MSG);
        }
    }

    private function handleFailedConfirmation(File $file, Exception $e): void
    {
        // Do bucket deletion first in case file DB reference deletion fails
        if ($e->getMessage() !== self::FILE_NOT_FOUND_IN_BUCKET_ERR_MSG) {
            // Don't use Helper::deleteFilesFromBucket() as it may update usage even though it would be rolled back at this point if updated, which could lead to inaccuracies
            Storage::delete($file->getCloudPath());
        }
        
        $file->delete();
    }

    private function updateStorageUsage(int $fileSize): void
    {
        $user = Helpers::getUserOrFail(auth()->id());
        $bucketStorage = Helpers::getBucketStorage();

        $user->increment('account_storage_used', $fileSize);
        $user->increment('user_bucket_storage_used', $fileSize);
        $bucketStorage->increment('used', $fileSize);
    }

    public function createFolder(Request $request): JsonResponse
    {
        $this->validateFolderRequest($request);

        /** @var int $userId (PHPStan) */
        $userId = auth()->id();

        try {
            $this->checkFolderCount($userId);

            DB::beginTransaction(); // Put in transaction as lock may be applied to parentFolder

            $newFolder = $this->storeFolderInDb($request, $userId);

            DB::commit();

            return response()->json([
                Helpers::mapDbFoldersForResponse(collect([$newFolder]))->firstOrFail()
            ]);
        } 
        catch (Exception $e) {
            DB::rollBack();
            return $this->createExceptionResponse($e);
        }
    }

    private function validateFolderRequest(Request $request): void
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'parentFolderId' => 'nullable|integer|ext_max_length',
        ]);

        $this->validateItemName($request['name']);
    }

    private function storeFolderInDb(Request $request, int $userId): Folder
    {
        $name = $request['name'];
        $parentFolderDbId = $request['parentFolderId'] ?? null;

        return Folder::create([
            'name' => $name,
            'created_at' => now(),
            'app_path' => $this->constructAppPath($name, $parentFolderDbId),
            'user_id' => $userId,
            'parent_folder_id' => $parentFolderDbId, // FK constraint prevents folder's parent_folder_id from being saved as its own id
        ]);
    }

    private function checkFolderCount(int $userId): void
    {
        $foldersCount = Folder::where('user_id', $userId)->count();
        if ($foldersCount >= GlobalConstants::get('MAX_USER_FOLDER_NUM')) {
            throw new \Exception(GlobalConstants::get('MAX_ITEM_NUM_ERR_MSG'));
        }
    }

    private function constructAppPath(string $itemName, ?int $parentFolderDbId): string 
    {
        if ($parentFolderDbId) {
            // Leave lock to prevent conflict. See relevant comment in uploadFile/createFolder functions
            $parentFolder = Helpers::authFindOrFailModel(
                $parentFolderDbId, 
                Folder::class, 
                ['app_path'], 
                sharedLock: true
            );

            $appPath = "$parentFolder->app_path/$itemName";
        } 
        else {
            $appPath = "LimeDrive/$itemName"; // For root
        }

        return $appPath; // Don't check for appPath limit reached here as DB and frontend has that check (in case I change it in the future and forget to change it here, best to let DB and frontend validation handle it)
    }
}