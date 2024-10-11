<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\Log;
use App\Http\Helpers;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Doppler not currently used in prod
        $prefix = Helpers::isEnvLocal() ? 
            'doppler run --'
            : null;

        // Cloudflare analytics don't update straight away, but this should be good enough.
        $schedule->command("$prefix app:check-bucket-metrics")->everyFiveMinutes()->sendOutputTo('/dev/stdout'); 
        $schedule->command("$prefix app:reload-proxies")->daily(); // Is also ran in deployment script

        // In Neon DB free tier the primary compute goes idle every 5 mins which would require a cold start to use it 
        // again which can take time, so this keeps the compute active. In Neon free tier the primary compute is always 
        // available (not limited to set amount of active hours - only other branch computes have a hard limit each month) 
        // so don't need to worry about the warm up preventing the database from being usable.
        $schedule->command("$prefix app:warm-up-database")->everyThreeMinutes(); 
        $schedule->command("$prefix app:prevent-render-spindown")->everyThreeMinutes();

        // Not using sanctum api tokens (using session instead) but leave command for future just in case.
        // If a token is expired based on expiration value in config (expiration not explicitly stored on database) then this should delete them
        $schedule->command("$prefix sanctum:prune-expired")->daily(); 
        
        $schedule->command("$prefix app:delete-accounts-for-space")->everyMinute();
        $schedule->command("$prefix app:delete-inactive-empty-accounts")->daily();
        $schedule->command("$prefix app:delete-orphaned-or-unconfirmed-files")->everyFiveMinutes();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}