<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use App\Models\BucketStorage;
use Illuminate\Support\Facades\Mail;
use App\Mail\NotifyAdmin;
use App\Http\Helpers;

class CheckBucketMetrics extends Command
{
    private const MAX_ALLOWED_CLASS_A_OPS = 8E5;
    private const MAX_ALLOWED_CLASS_B_OPS = 8E6;
    private const BUCKET_HARD_STORAGE_CAP = 9.8 * 1000 * 1000 * 1000; // (bucket limits are in decimal). Hard cap is slightly higher than the cap that was put in DB - helps allow sample files and dev files and limedrive showcase file that aren't accounted for in the DB-recorded usage
    
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:check-bucket-metrics';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check bucket metrics using Cloudflare API and take appropriate actions based on the metric and thresholds.';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $storageResponse = Http::withHeaders([
            'X-AUTH-EMAIL' => config('app.cloud_email'),
            'Authorization' => 'Bearer ' . config('app.bucket_analytics_token'),
            'Content-Type' => 'application/json',
        ])->post('https://api.cloudflare.com/client/v4/graphql', [
            'query' => '{
                viewer {
                    accounts(filter: { accountTag: "' . config('app.cloud_account_id') . '" }) {
                        r2OperationsAdaptiveGroups(
                            limit: 9999
                            filter: { 
                                datetime_geq: "' . now()->startOfMonth()->toIso8601String() . '"
                            }
                        ) { 
                            dimensions {
                                actionType
                            }
                            sum {
                                requests
                            }
                        }
                        r2StorageAdaptiveGroups(
                            limit: 9999
                            filter: { 
                                datetime_geq: "' . now()->startOfMonth()->toIso8601String() . '"
                            }
                        ) { 
                            max {
                                payloadSize
                            }
                        }
                    }
                }
            }',
        ])->throw()->json();

        $classAOps = ["ListBuckets", "PutBucket", "ListObjects", "PutObject", "CopyObject", "CompleteMultipartUpload", "CreateMultipartUpload", "ListMultipartUploads", "UploadPart", "UploadPartCopy", "ListParts", "PutBucketEncryption", "PutBucketCors", "PutBucketLifecycleConfiguration"];
        $totalClassAOps = 0;
        $maxAllowedClassAOps = self::MAX_ALLOWED_CLASS_A_OPS;

        $classBOps = ["HeadBucket", "HeadObject", "GetObject", "UsageSummary", "GetBucketEncryption", "GetBucketLocation", "GetBucketCors", "GetBucketLifecycleConfiguration"];
        $totalClassBOps = 0;
        $maxAllowedClassBOps = self::MAX_ALLOWED_CLASS_B_OPS;

        foreach ($storageResponse['data']['viewer']['accounts'][0]['r2OperationsAdaptiveGroups'] as $item) {
            if (in_array($item['dimensions']['actionType'], $classAOps)) {
                $totalClassAOps += $item['sum']['requests'];
            } else if (in_array($item['dimensions']['actionType'], $classBOps)) {
                $totalClassBOps += $item['sum']['requests'];
            }
        }

        $this->info("The following information is based on the last analytics update:");

        $this->line('');

        if ($totalClassAOps < $maxAllowedClassAOps) {
            $this->info("Max allowed class A operations ($maxAllowedClassAOps) NOT reached. Approx current = $totalClassAOps. Allowing usage.");
            config(['app.class_A_operations_limit_reached' => false]);
        }
        else if ($totalClassAOps >= $maxAllowedClassAOps) {
            $this->warn("Max allowed class A operations ($maxAllowedClassAOps) reached. Approx current = $totalClassAOps. Server will prevent new file uploads until usage reset is detected.");
            config(['app.class_A_operations_limit_reached' => true]);

            Mail::send(new NotifyAdmin(
                "LimeDrive bucket class A operations limit reached",
                "Max allowed class A operations ($maxAllowedClassAOps) reached. Approx current = $totalClassAOps."
            ));
        }

        $this->line('');

        if ($totalClassBOps < $maxAllowedClassBOps) {
            $this->info("Max allowed class B operations ($maxAllowedClassBOps) NOT reached. Approx current = $totalClassBOps. Allowing usage.");
            config(['app.class_B_operations_limit_reached' => false]);
        }
        else if ($totalClassBOps >= $maxAllowedClassBOps) {
            $this->warn("Max allowed class B operations ($maxAllowedClassBOps) reached. Approx current = $totalClassBOps. Server will prevent new presigned urls from being generated until usage reset is detected.");
            config(['app.class_B_operations_limit_reached' => true]);

            Mail::send(new NotifyAdmin(
                "LimeDrive bucket class B operations limit reached.",
                "Max allowed class B operations ($maxAllowedClassBOps) reached. Approx current = $totalClassBOps."
            ));
        }

        $this->line('');

        $bucketUsageFromAPI = $storageResponse['data']['viewer']['accounts'][0]['r2StorageAdaptiveGroups'][0]['max']['payloadSize'];
        $bucketHardStorageCap = self::BUCKET_HARD_STORAGE_CAP;

        if ($bucketUsageFromAPI < $bucketHardStorageCap) {
            $this->info("Bucket hard storage cap ($bucketHardStorageCap) NOT reached. Approx current = $bucketUsageFromAPI. Allowing uploads.");
            config(['app.bucket_hard_storage_cap_reached' => false]);
        } 
        else if ($bucketUsageFromAPI > $bucketHardStorageCap) {
            $bucketStorageFromDB = Helpers::getBucketStorage();
            $bucketStorageCapFromDB = $bucketStorageFromDB->cap;

            $this->error("
                CRITCAL: Bucket hard storage cap ($bucketHardStorageCap) reached. Approx current = $bucketUsageFromAPI. Server will prevent uploads until usage is below it. 
                This should not have happened and indicates a possible issue in the backend code or DB or bucket. Usage should automatically be freed
                by the code if the database-defined bucket storage cap ($bucketStorageCapFromDB) is reached and should be done
                by deleting the oldest user accounts that have uploaded their own files (not old accounts that only have sample files) (i.e. with the scheduled DeleteAccountsForSpace command)
                if this service is still intended to be part of a portfolio project. This would allow seamless usage for new users and cost savings.
            ");
            config(['app.bucket_hard_storage_cap_reached' => true]);

            Mail::send(new NotifyAdmin(
                "CRITICAL: LimeDrive bucket hard storage cap reached.",
                "Bucket hard storage cap ($bucketStorageCapFromDB) reached. Approx current = $bucketUsageFromAPI."
            ));
        }

        $this->line('');

        $this->info("It can take some minutes for the analytics to update to the most recent values.");
    }
}
