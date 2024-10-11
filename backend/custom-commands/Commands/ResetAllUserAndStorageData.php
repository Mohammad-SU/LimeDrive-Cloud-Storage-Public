<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use App\Models\File;
use App\Models\Folder;
use App\Models\User;
use Exception;
use App\Http\Helpers;

class ResetAllUserAndStorageData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:reset-all-user-and-storage-data {password}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Resets all dev user and storage data and deletes files from the dev bucket if there are any.';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        if (!Helpers::isEnvLocal()) {
            $this->error('Cannot run this in production.');
            return;
        }

        $password = $this->argument('password');

        if ($password !== config('app.command_password')) {
            $this->error('Incorrect password. Operation canceled.');
            return;
        }

        if (!$this->confirm('Are you sure you want to reset all user and storage data? This is irreversible.')) {
            $this->info('Operation canceled. No files were deleted.');
            return;
        }

        $users = User::all();
        $deletedUserCount = 0;

        try {
            if (count($users) === 0) {
                $this->info("No user accounts to delete.");
                return;
            }

            foreach ($users as $user) {
                $user->deleteAccount();
                ++$deletedUserCount;
            }

            $this->info("Deleted $deletedUserCount user accounts and any associated file/folder and bucket data.");
        }
        catch (Exception $e) {
            $this->error("Failed to reset data.");
        }
    }
}