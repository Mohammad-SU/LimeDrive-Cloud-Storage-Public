<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Monicahq\Cloudflare\LaravelCloudflare;
use Illuminate\Support\Facades\Cache;

class ReloadProxies extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:reload-proxies';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reload cloudflare proxies/check for new proxies and then put in cache so that $proxies in TrustedProxies middleware is up-to-date.';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        Artisan::call('cloudflare:reload');

        Cache::put('trusted_proxies', LaravelCloudflare::getProxies(), now()->addHours(25)); // 25 hours as buffer time. It will be overwritten before expiry if the command finishes earlier anyways

        $this->info('Proxies reloaded successfully.');
    }
}