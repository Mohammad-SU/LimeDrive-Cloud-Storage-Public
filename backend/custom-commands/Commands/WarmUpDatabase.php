<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use Exception;

class WarmUpDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:warm-up-database';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Warm up database primary branch compute';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        // Don't need to disable for local env as main branch is used for both dev db and prod db

        $firstUser = User::first();
        $firstUser ?
            $this->info('Database compute warmed up. First user retrieved successfully.')
            : $this->info('Database compute warmed up. No users found in the database.');
    }
}
