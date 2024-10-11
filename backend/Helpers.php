<?php
namespace App\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Crypt;
use App\Models\File;
use App\Models\Folder;
use Exception;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use App\Mail\NotifyAdmin;
use App\Models\BucketStorage;
use App\Models\User;
use App\Models\SampleFile;
use App\Models\SampleFolder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Http\Request;

class Helpers
{
    /** Valid formats are e.g. 62724 2938 1285099
     * @param int|string $id
     * @return bool
     */
    public static function isFileIdFormat($id)
    {
        return is_numeric($id);
    }

    /** Valid formats are e.g. d_3729 d_1193 d_41836.
     * Folder ids are int on the database. 
     * On the frontend they are string for differentiating from files on the backend controllers.
     * Root is handled with convertToParentFolderDbId helper, not with isFrontendFolderIdFormat helper.
     * @param int|string $id
     * @return bool
     */
    public static function isFrontendFolderIdFormat($id)
    {
        return preg_match('/^d_\d+$/', strval($id)) === 1;
    }

    /**
     * @param string $parentFolderId
     * @return int|null null is returned if null is passed in, which should be considered root folder id
     */
    public static function convertToParentFolderDbId($parentFolderId)
    {
        $parentFolderDbId = $parentFolderId === null ? 
            null
            : intval(Str::after($parentFolderId, "d_"));

        return $parentFolderDbId;
    }

    /**
     * @param int|null $dbParentFolderId
     * @return string|null null is returned if null is passed in, which should be considered root folder id
    */
    public static function convertToFrontendParentFolderId($dbParentFolderId)
    {
        $frontendParentFolderId = $dbParentFolderId === null ? 
            null
            : "d_" . $dbParentFolderId;

        return $frontendParentFolderId;
    }

    /**
     * @param string $folderId
     * @return int
     */
    public static function convertToFolderDbId($folderId)
    {
        $folderDbId = intval(Str::after($folderId, "d_"));

        return $folderDbId;
    }

    public static function convertFrontendItemIdsToDbIds(array $itemIds)
    {
        $fileIds = [];
        $folderIds = [];

        foreach ($itemIds as $id) {
            if (self::isFileIdFormat($id)) {
                $fileIds[] = intval($id);
            } elseif (self::isFrontendFolderIdFormat($id)) {
                $folderIds[] = self::convertToFolderDbId($id);
            } else {
                throw new Exception("Invalid id.");
            }
        }

        return [
            'fileIds' => $fileIds,
            'folderIds' => $folderIds
        ];
    }

    /** Convert array keys to snake_case
     * @param array<mixed> $array
     * @return array<mixed>
     */
    public static function arrToSnake($array)
    {
        $result = [];
        foreach ($array as $key => $value) {
            $result[Str::snake($key)] = $value;
        }
        return $result;
    }

    /** Convert array keys to camelCase
     * @param array<mixed> $array
     * @return array<mixed>
     */
    public static function arrToCamel($array)
    {
        $result = [];
        foreach ($array as $key => $value) {
            $result[Str::camel($key)] = $value;
        }
        return $result;
    }

    public static function isEnvLocal(): bool
    {
        return config('app.env') === "local";
    }
}
