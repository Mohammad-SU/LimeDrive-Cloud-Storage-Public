<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Mail;
use App\Mail\AccountDeleted;
use App\Http\Helpers;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

/**
 * @property int $id
 * @property string $username
 * @property string|null $email
 * @property string $password
 * @property bool $is_email_verified
 * @property string $enc_verify_email_key
 * @property int $account_storage_used
 * @property int $account_storage_cap
 * @property int $user_bucket_storage_used
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'users';
    
    /** The attributes that are mass assignable.
     * @var array<int, string>
     */
    protected $fillable = [
        'email',
        'username',
        'password',
        'is_email_verified', // Keep as separate column for best practice
        'enc_verify_email_key',
        'account_storage_used', // Storage used by the user including duplicate bucket object references.
        // 'account_storage_cap', // Storage limit for the user including duplicate bucket object references (commented out as does not need to be changed yet).
        'user_bucket_storage_used', // Bucket storage used by the user (so NOT including any duplicate bucket object references as these do not apply here).
        'has_consented',
    ]; // Check constraint in pgsql can't reference other table's columns.

    /** The attributes that should be hidden for serialization.
     * @var array<int, string>
     */
    protected $hidden = [
        'email',
        'password_hash', // Not used in DB (the hashed column is still called password)
        'password',
        'remember_token',
        'enc_verify_email_key',
        'user_bucket_storage_used',
    ];

    /** The attributes that should be cast.
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    /** Override viaRemember to always return false. */
    public function viaRemember(): bool
    {
        return false;
    }

    public function folders(): HasMany
    {
        return $this->hasMany(Folder::class, 'user_id');
    }

    public function files($excludeUploaded = false): HasMany
    {
        // The $query isn't ran straight away if you access this as $user->files(), 
        // but is ran if you access it as $user->files or $user->files()->get (so it's still efficient for excludeUploaded)
        $query = $this->hasMany(File::class, 'user_id'); 
    
        if ($excludeUploaded) {
            $query->where('is_uploaded', true);
        }
    
        return $query;
    }

    /** Transfer 'sample_folders' to 'folders' table and 'sample_files' to 'files' table, with some changes */
    public function transferSampleItems(bool $isRestore = false): JsonResponse|null
    {
        // Don't wrap in try catch, the parent should wrap instead and with DB transaction
        if (DB::transactionLevel() === 0) {
            throw new \Exception("This function must be ran inside a transaction.");
        }

        // Sort sample folders to ensure folder with 'sample_parent_folder_id' as null come first. Leave this
        $sampleFolders = SampleFolder::all()->sortBy(function($folder) { 
            return is_null($folder->sample_parent_folder_id) ? 0 : 1;
        });

        $folderMapping = [];
        $newFolders = collect();

        foreach ($sampleFolders as $sampleFolder) {
            $newParentFolderId = is_null($sampleFolder->sample_parent_folder_id) ? 
                null
                : $folderMapping[$sampleFolder->sample_parent_folder_id];

            $newFolder = Folder::create([
                'user_id' => $this->id,
                'parent_folder_id' => $newParentFolderId,
                'created_at' => now(),
                'is_sample' => true,
            ] + Arr::except($sampleFolder->toArray(), ['id', 'sample_parent_folder_id'])); // Removing id since it's auto-incremented in the new table, and sample_parent_folder_id is not needed in the new table
            
            $newFolders->push($newFolder);

            // [old sample id int => new auto-incremented id int] so that parent_folder_id is accurate with the new values
            $folderMapping[$sampleFolder->id] = $newFolder->id;
        }

        // Sort .zip and .mp3 files are created first so they appear possibly last on the user's list, 
        // so that users are more likely to view the sample files that look better in the in-browser viewer 
        // for a better impression. Although in production, if this function is called from register class in controller
        // it may not affect the order, so the frontend deals with that.
        $sampleFiles = SampleFile::all()->sortBy(function($file) {
            $extension = pathinfo($file->name, PATHINFO_EXTENSION);
            if ($extension === 'zip') {
                return 0;
            } elseif ($extension === 'mp3') { // make it so mp3 more likely to appear above zip in the list
                return 1;
            }
            return 2;
        });
        
        $newFiles = collect();
        $totalSizeOfSampleFiles = 0;

        foreach ($sampleFiles as $sampleFile) {            
            if (is_null($sampleFile->sample_parent_folder_id) && !$isRestore) {
                $newParentFolderId = null;
            } 
            else if (is_null($sampleFile->sample_parent_folder_id) && $isRestore) { // If restoring then all root files should be moved to Samples folder
                $rootSampleFolder = $sampleFolders->firstWhere('name', "Samples"); // Works because sampleFolders is the original/old collection
                
                $sampleFile->app_path = $rootSampleFolder->app_path . "/" . $sampleFile->name;
                $newParentFolderId = $folderMapping[$rootSampleFolder->id];
            } 
            else {
                $newParentFolderId = $folderMapping[$sampleFile->sample_parent_folder_id];
            }

            $newFile = File::create([ // Don't batch as may be needed for restoring (id is needed)
                'user_id' => $this->id,
                'parent_folder_id' => $newParentFolderId,
                'created_at' => now(),
                'is_sample' => true,
                'is_uploaded' => true, // These are already on the bucket
            ] + Arr::except($sampleFile->toArray(), ['id', 'sample_parent_folder_id'])); // Removing id since it's auto-incremented in the new table, and sample_parent_folder_id is not needed in the new table

            $newFiles->push($newFile);

            $totalSizeOfSampleFiles += $sampleFile->size;
        }

        $this->increment('account_storage_used', $totalSizeOfSampleFiles);

        if($isRestore) { // Don't batch get based on is_sample being true as user may keep sample items in a different folder
            return response()->json([
                'files' => Helpers::mapDbFilesForResponse($newFiles),
                'folders' => Helpers::mapDbFoldersForResponse($newFolders),
                'accountStorageUsed' => $this->account_storage_used
            ]);
        }
        else {
            return null;
        }
    }

    public function returnUserDataResponse(string $generatedPassword = null): JsonResponse
    {
        // generatedPassword is only for initial account generation if user used 'skip for now' option in authentication
        // so that they can save the generated password if they want. It will never be shown to them again afterwards.
        return response()->json([
            'user' => [
                'username' => $this->username,
                'email' => $this->email,
                'isEmailVerified' => $this->is_email_verified,
                'hasConsented' => $this->has_consented,
            ],
            'files' => Helpers::mapDbFilesForResponse($this->files(true)->get()),
            'folders' => Helpers::mapDbFoldersForResponse($this->folders),
            'accountStorageUsed' => $this->account_storage_used,
            'accountStorageCap' => $this->account_storage_cap,
        ] + ($generatedPassword ? ['generatedPassword' => $generatedPassword] : []));
    }

    /** Delete user account and associated data.
     * @return bool
     */
    public function deleteAccount()
    {
        // Don't prevent deleting account even if user has unuploaded files, in order to prevent issues

        $files = $this->files()->get()->all(); // Declare here so they are accessible after deletion
        // $email = $this->email; // Commented out for now to not use up email
        // $is_email_verified = $this->is_email_verified;

        $isCurrentAuthUser = $this->id === auth()->id();

        // It's possible for this to be called via command for cleanup
        // For now don't log user back in if deletion fails, for security reasons
        // Logs out current authenticated user. For logging out users that were remotely deleted (via command cleanup)
        // That happens when the user's sessions are deleted
        // Make sure isCurrentAuthUser is true otherwise exception would be thrown in helper due to session not being
        // set on request if user is deleted via command.
        if ($isCurrentAuthUser) { 
            Helpers::logoutCurrentUser();
        }

        try {
            DB::beginTransaction();

            // Don't need to delete api tokens (personal access tokens) as using sessions instead
            DB::table('sessions')->where('user_id', $this->id)->delete();

            $this->files()->delete(); // delete didn't work on $files directly for some reason. Use this.
            $this->folders()->delete();
            $this->delete();

            // Leave commented out due to email limits
            // if($is_email_verified) Mail::to($email)->send(new AccountDeleted()); // Leave mail inside transcation
            
            DB::commit();
            $isSuccessful = true; // Account deleted successfully
        } 
        catch (\Exception $e) {
            DB::rollBack();
            Log::error($e);
            $isSuccessful = false; // Something went wrong
        }

        if ($isSuccessful && count($files) > 0) { // Leave outside try catch. If successful file DB deletions and at least one file was deleted, then delete files from bucket, but still leave outside try catch since I dont have backups for bucket deletions failing, so if a bucket deletion fails it will be handled separatly and the user doesn't need to know
            Helpers::deleteFilesFromBucket($files);
        }

        return $isSuccessful;
    }
}
