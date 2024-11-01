<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Aws\S3\S3Client;
use App\Models\File;
use Illuminate\Support\Collection;
use Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class DeleteOrphanedOrUnconfirmedFiles extends Command
{
    protected $signature = 'app:delete-orphaned-or-unconfirmed-files';
    protected $description = 'Delete orphaned or unconfirmed files on DB and bucket';

    // DELETES DB records AND bucket object for files found in bucket IF is_uploaded was false.
    // This deletes instead of updates so that aren't issues with name conflicts on the DB + balancing user expectations
    // The user should only expect files to appear on the list if it was confirmed uploaded on the frontend UI, which
    // should only happen if is_uploaded was true. Also it would need to handle updating storage usage if it was an update
    // instead of delete, which is unnecessary complexity.

    // DELETES DB records for files NOT found in the bucket only if
    // is_uploaded was false and some time has passed since that DB record was added 
    // OR if is_uploaded was true and NOT is_sample. Sample files have their own path in the bucket.
    
    // DELETES bucket objects that don't have corresponding DB records, if some time has passed since the object
    // was created (to prevent race conditions such as an object being added during listing/deletion).

    // This is quite thorough and handles rare edge cases, but multiple runnings of the command may be needed to handle them all
    // if the edge case involves objects with same name (file name + extension being the same for multiple objects) due to associative array.

    // Regarding the case where is_uploaded = true and corresponding object not found on bucket (which should be a very rare case)
    // It may lead to inaccuracy regarding database calculations for bucket usage and user storage usage, i.e. the usage being
    // considered higher that it should be, but won't ever be lower that in should be in that case. For now, leave the code as is
    // (NOT updating usage in that case if file records filling those conditions are deleted) to not cause usages to be lower
    // records to be lower than they are as that could cause costs to me, and due to the extra complexity it could require
    // as fileAgeThresholdMinutes would need to be considered for objects not deleted in that case and other complexites.
    // On top of this, if the usage is inaccurate for any reason then it could be updated accuratly by disabling uploads for an
    // hour and then using cloudflare analytics to get the updated value
    // Later the handling of the case would be changed if this becomes a monetary service which would have backups, where if an
    // orphaned is_uploaded = true file is found then a corresponding object would be attempted to silently restore from the 
    // backup/infrequent access bucket instead of deleting the file record, which means usages wouldn't even need to be updated.

    private S3Client $s3Client;
    private int $batchSize = 1000;

     // Required age in minutes of the file/object before it can be deleted.
     // Don't put entire date at start as it may need to be refreshed during loops/batching to account
     // for the runnning time of the command
    private int $fileAgeThresholdMinutes = 2;

    public function __construct()
    {
        parent::__construct();

        $this->s3Client = new S3Client([
            'version' => 'latest',
            'region'  => config('filesystems.disks.s3.region'),
            'endpoint' => config('filesystems.disks.s3.endpoint'),
            'credentials' => [
                'key'    => config('filesystems.disks.s3.key'),
                'secret' => config('filesystems.disks.s3.secret'),
            ],
        ]);
    }

    public function handle(): void
    {
        $this->info('Starting cleaning process...');

        // DO NOT WRAP IN TRANSACTION. Can't reverse bucket deletions anyways, and no point in reversing updates/deletion that already happened.
        // As of writing, changes to bucket/database include one action each (deletion OR update on DB, deletion on bucket) which don't depend on each other, 
        // so no need to reverse successful actions.

        $initialMinId = null;
        $lastProcessedId = 0;

        do {
            $files = $this->getRelevantDbFileRecords($lastProcessedId); // files in this batch would start after the lastProcessedId
            if ($files->isEmpty()) {
                break;
            }

            // $files is already sorted by ascending so this should work
            $batchMinId = $files->first()->id;
            $lastProcessedId = $files->last()->id;
    
            if ($initialMinId === null) { // So that only the first batch sets the initialMinId
                $initialMinId = $batchMinId;
            }

            $bucketObjects = $this->listBucketObjectsToCompare($batchMinId, $lastProcessedId);
            $this->deleteOrphanedAndUncomfirmedFiles($files, $bucketObjects);
        } while (true);

        // This is for deleting the bucket objects that are beyond the range of any 
        // DB file record ids, which are considered orphans.
        // Leave this as it can help deal with objects that have an incorrect 
        // name format for any reason due to alphabetical order of object names.
        // Deletions also work for things in descendant folders in user_files/

        // for below initialMinId (min id of first batch in the loop above). First param is 
        // null in case any items appear before numbers alphabetically with incorrect format
        $this->deleteOrphanedBucketObjectsOutsideRange(null, $initialMinId - 1); 
        
        // For beyond lastProcessedId (max id of last batch)
        $this->deleteOrphanedBucketObjectsOutsideRange($lastProcessedId + 1); 

        $this->info('Process completed successfully.');
    }

    /**
     * Retrieves IDs and upload status of files where:
     * (is_uploaded = false and were created more than the time given),
     * OR (is_uploaded = true and is_sample = false).
     * @return Collection<int, File>
     */
    private function getRelevantDbFileRecords(int $lastProcessedId): Collection
    {
        $fileAgeThreshold = $this->getFileAgeThreshold()->toDateTimeString();

        return File::where('id', '>', $lastProcessedId) // use > so no overlap
            ->where(function ($query) use ($fileAgeThreshold) {
                $query->where(function ($q) use ($fileAgeThreshold) {
                    $q->where('is_uploaded', false) // automatically won't include sample files (since they always have is_uploaded set to true)
                      ->where('created_at', '<', $fileAgeThreshold);
                })->orWhere(function ($q) {
                    $q->where('is_uploaded', true)
                      ->where('is_sample', false);
                });
            })
            ->orderBy('id')
            ->limit($this->batchSize)
            ->get(['id', 'is_uploaded', 'name']);
    }

    /**
     * @return array<string|array{dirname: string, basename: string, extension: string, filename: string}, array{key: string, lastModified: mixed}>
     */
    private function listBucketObjectsToCompare(int $minId, int $maxId): array
    {
        $objects = [];
        $continuationToken = null;

        do {
            $result = $this->getResultFromListObjects($minId, $continuationToken);

            // associative array (hash table) (array key is object name, val is object path/'key' and lastModifiedVal)
            // e.g. ['19281298.png' => ['key': 'user_files/19281298.png', 'lastModified': lastModfiedVal]]
            // For array key, the entire file name with extension is there in case duplicate object ids with different extensions
            // so that the later function can delete duplicates.
            // For array value, the entire path is there instead of just extension for dealing with rarer edge cases
            // such as incorrect path formats with subfolders/files with matching ids that should be deleted.
            // invalid object names on bucket would also be dealt with.
            // Some objects may not be included in the deletion if they all have the same object name (incl. extension)
            // as associative array key values are unique, although later iterations of the command would eventually delete them,
            // depending on how many of those duplicate objects there are.
            foreach ($result['Contents'] ?? [] as $object) {
                $decodedObjKey = urldecode($object['Key']);
                $objectId = pathinfo($decodedObjKey, PATHINFO_FILENAME); // without extension is object id
                $objectName = pathinfo($decodedObjKey, PATHINFO_BASENAME); // the file name (with extension) is same as file id + extension from database records
                
                if ($objectId > $maxId) { // break to prevent accidental deletions
                    break 2;
                }

                $objects[$objectName] = [
                    'key' => $decodedObjKey,
                    'lastModified' => $object['LastModified'] // Only Carbon parse later when needed
                ];
            }

            $continuationToken = $result['NextContinuationToken'] ?? null;
        } while ($continuationToken);

        return $objects;
    }

    /**
     * @param array<string, array{key: string, lastModified: mixed}> $bucketObjects
     */
    private function deleteOrphanedAndUncomfirmedFiles(Collection $files, array $bucketObjects): void
    {
        $idsToDeleteFromDb = [];
        $fileAgeThreshold = $this->getFileAgeThreshold();

        foreach ($files as $file) {
            $extension = pathinfo($file->name, PATHINFO_EXTENSION);
            $fileReferenceName = "$file->id.$extension";
            $correspondingObject = $bucketObjects[$fileReferenceName] ?? null; 

            // If the file is not marked as uploaded then it would not appear in the user's UI so 
            // for them this would not cause a file to unexpectedly dissappear on their list.
            // Refer to comment at start of command.
            if (($correspondingObject && !$file->is_uploaded) || !$correspondingObject) {
                $idsToDeleteFromDb[] = $file->id;
                // Don't update usages here - refer to final paragraph at start of command 
            } 
            else {
                $keyIsValid = pathinfo($correspondingObject['key'], PATHINFO_DIRNAME) === "user_files";
                if ($keyIsValid) {
                    // Don't need to do anything specifically here other than removing this 
                    // file ID from the set of bucket objects to see if any remain later for deletion
                    // Efficient as it's hash table
                    unset($bucketObjects[$fileReferenceName]);
                }
            }
        }

        // Any remaining items in $bucketObjects reference uncomfirmed files OR are orphaned objects since objectId 
        // is supposed to match a fileId in DB and if they don't then it's an orphan, these types of objects should be deleted,
        // if some time has passed since the object's creation (to prevent race conditions). 
        // DONT put this in deleteBucketObjects() as that function is also used for deleting objects outside id range.
        $keysToDeleteFromBucket = [];

        foreach ($bucketObjects as $objectName => $objectData) {
            $lastModified = Carbon::parse($objectData['lastModified']);

            if ($lastModified < $fileAgeThreshold) {
                $keysToDeleteFromBucket[] = $objectData['key'];
            }
        }

        $this->deleteFileRecords($idsToDeleteFromDb);
        $this->deleteBucketObjects($keysToDeleteFromBucket);
    }

    /**
     * @param array<int> $idsToDeleteFromDb
     */
    private function deleteFileRecords(array $idsToDeleteFromDb): void
    {
        if (!empty($idsToDeleteFromDb)) {
            File::whereIn('id', $idsToDeleteFromDb)->delete();
            $this->info("Orphaned/unconfirmed file records (ID) deleted from DB: " . json_encode($idsToDeleteFromDb));
        }
    }

    /**
     * @param array<string> $keysToDelete
     */
    private function deleteBucketObjects(array $keysToDelete): void
    {
        // Don't update bucket usage in database - the bucket deletion helper function deals with updating usage as needed.
        // These orphan/unconfirmed deletions are more for unexpected cases.
        // In fact, deleting these objects would likely lead to higher accuracy for bucket usage.
        if (!empty($keysToDelete)) {
            $chunks = array_chunk($keysToDelete, 1000);

            foreach ($chunks as $chunk) {
                Storage::delete($chunk); // Don't need to urlencode before deletion
            }
            $this->info("Orphaned/unreferenced objects (keys) deleted from bucket: " . json_encode($keysToDelete));
        }
    }

    private function deleteOrphanedBucketObjectsOutsideRange(?int $startId, ?int $endId = null): void
    {
        $continuationToken = null;

        do {
             // Don't put this before the "do" to account for time it takes to list the objects
            $fileAgeThreshold = $this->getFileAgeThreshold();
            $pathsToDelete = [];

            $result = $this->getResultFromListObjects($startId, $continuationToken);

            foreach ($result['Contents'] ?? [] as $object) {
                $decodedObjKey = urldecode($object['Key']);

                $objectId = pathinfo($decodedObjKey, PATHINFO_FILENAME);

                if ($endId !== null && is_numeric($objectId) && $objectId > $endId) {
                     // added here to not go over end id but still delete remaining, even though deleteBucketObjects is called later
                    $this->deleteBucketObjects($pathsToDelete);
                    break 2;
                }

                $lastModified = Carbon::parse($object['LastModified']);

                if ($lastModified < $fileAgeThreshold) {
                    $pathsToDelete[] = $decodedObjKey;
                }
            }

            $this->deleteBucketObjects($pathsToDelete); // Leave this in case there is no endId

            $continuationToken = $result['NextContinuationToken'] ?? null;
        } while ($continuationToken);
    }

    /**
     * @return \Aws\Result<array<string, mixed>>
     */
    private function getResultFromListObjects(?int $startId, ?string $continuationToken): \Aws\Result
    {
        $params = [ 
            'Bucket' => config('filesystems.disks.s3.bucket'),
            'MaxKeys' => 1000,
            'EncodingType' => 'url', // encode in case orphans include special chars
            'Prefix' => 'user_files/',
            'StartAfter' => "user_files/$startId", // Don't need to encode the id. It can still list objects that follow an incorrect key format in order to delete them
        ];

        if ($continuationToken) {
            $params['ContinuationToken'] = $continuationToken;
        }

        return $this->s3Client->listObjectsV2($params);
    }

    private function getFileAgeThreshold(): Carbon
    {
        return now()->subMinutes($this->fileAgeThresholdMinutes);
    }
}
