<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Http\Helpers;
use App\Models\BucketStorage;

class DeleteAccountsForSpace extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:delete-accounts-for-space';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Runs helper function to delete accounts for space based on buffer, for saving space on Neon.';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        Helpers::deleteAccountsForSpace(BucketStorage::query()->firstOrFail());

        $this->info("Command run successfully.");
    }
}
