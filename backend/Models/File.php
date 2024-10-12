<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Crypt;
use App\Http\Helpers;

/**
 * @property int $id
 * @property int $user_id
 * @property int $parent_folder_id
 * @property string $name
 * @property string $app_path
 * @property string $type
 * @property int $size
 * @property ?int $media_duration
 * @property string $created_at
 * @property ?string $enc_share_key
 * @property bool $is_sample
 * @property bool $is_uploaded
 */
class File extends Model
{
    use HasFactory;

    protected $table = 'files';

    protected $fillable = [
        'user_id',
        'parent_folder_id',
        'name',
        'app_path',
        'type',
        'size',
        'media_duration',
        'created_at',
        'is_sample', // Leave as fillable
        'is_uploaded',
        'enc_share_key'
    ];

    /** @var array<int, string> */
    protected $hidden = [
        'enc_share_key',
        'user_id',
        'is_sample',
        'md5',
        'is_uploaded'
    ];

    public $timestamps = false;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Get path to file on the bucket */
    public function getCloudPath(): string
    {
        $cloud_path = $this->is_sample ?
            "samples" . '/' . $this->name
            : "user_files" . '/' . $this->id . '.' . pathinfo($this->name, PATHINFO_EXTENSION);

        return $cloud_path;
    }

    /** 
     * Returns the file access token as urlEncodedFileName-fileId-shareKey
     * 
     * urlEncodedFileName might be truncated but would still have the extension if the original file name does.
     * Null is returned if shareKey decryption fails.
     */
    public function getAccessToken(): ?string
    {
        $fileNameNoExtension = pathinfo($this->name, PATHINFO_FILENAME); // PATHINFO_FILENAME gets the name without the file extension
        $substrFileName = substr($fileNameNoExtension, 0, 32);

        if ($fileNameNoExtension !== $substrFileName) {
            $substrFileName .= ".."; // Indicates to the user that it was truncated (an extra period is later added before the extension)
        }

        $extension = pathinfo($this->name, PATHINFO_EXTENSION);

        $encodedFileNameInToken = $extension ? // If no extension then don't add extra period
            urlencode($substrFileName) . '.' . $extension 
            : urlencode($substrFileName);

        try {
            $shareKey = Crypt::decryptString($this->enc_share_key);
        }
        catch (\Exception $e) { // Instead of failed decryption error, return null to let code that uses this helper handle it
            return null;
        }

        $fileAccessToken = $encodedFileNameInToken.'-'.$this->id.'-'.$shareKey;

        return $fileAccessToken;
    }

    /** Get temporary signed url to file on the bucket, hmac being generated within the function
     * @param string $userIp
     * @param \Illuminate\Support\Carbon $expiration
     * @param bool $isInline
     * @return string
    */
    public function getPresignedUrl($userIp, $expiration, $isInline = true)
    {
        // Inline is for viewing file in the viewer. Attachment is for file download
        // Setting content-type header is not necessary
        // Leave setting it here as setting it on the frontend it may not start a download otherwise if needed
        $dispositionType = $isInline ? 'inline' : 'attachment';
        $contentDisposition = $dispositionType . '; filename="' . $this->name . '"';
        
        $cloudPath = $this->getCloudPath();

        // May be null if link-share view
        $userId = auth()->id() ?? null; 

        // Getting IP during local dev kept getting 127.0.0.1 so this should force the actual IP in that case
        $userIp = Helpers::isEnvLocal() ? config('app.dev_ip') : $userIp; 
        
        // These are both Unix timestamps in seconds
        $generationTime = now()->getTimestamp();
        $expiry = $expiration->getTimestamp();

        // Contains all the data about the request that I want to be able to verify. DON'T include protocol here - not necessary
        // Although some users can share IP with cloudflare, adding IP in authentication is as a precaution
        // Leave leading slash
        $dataToAuthenticate = '/'.$cloudPath.$userId.$userIp.$generationTime.$expiry;

        $mac = hash_hmac(
            'sha256',
            mb_convert_encoding($dataToAuthenticate, 'UTF-8', 'auto'), 
            mb_convert_encoding(config('app.bucket_url_symmetric_key'), 'UTF-8', 'auto'),
            true
        );
        $base64Mac = base64_encode($mac); // base64 instead of hex so less chars are used (less data transfer, possibly more efficient). hash_hmac returns raw binary data so doesn't turn it into hex first

        $queryString = http_build_query([
            // The verify should be deconstructed in the same order on the cf worker
            'verify' => "$userId-$userIp-$generationTime-$expiry-$base64Mac",
            'content-disposition' => $contentDisposition
        ]);

        // Don't need to put host in HMAC.
        $workerHost = Helpers::isEnvLocal() ? 
            'http://localhost:8787' // Local worker is http
            : 'https://r2.limedrive.net';

        return $workerHost . '/' . $cloudPath . '?' . $queryString;
    }
}
