<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;

class DeleteInactiveEmptyAccounts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:delete-inactive-empty-accounts';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Will delete inactive accounts that do not have any bucket storage usage.';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $usersToDelete = User::query()->where('updated_at', '<=', now()->subMonths(3))
                ->where('bucket_storage_used', '=', 0)
                ->get();
            
        foreach ($usersToDelete as $user) {
            $user->deleteAccount();
        }
    }
}