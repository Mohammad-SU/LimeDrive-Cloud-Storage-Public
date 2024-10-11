<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class PreventRenderSpindown extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:prevent-render-spindown';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Render free instance spins down with inactivity every "15" minutes but also possibly at other times, so this sends a request to prevent that.';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        Http::get('https://limedrive-backend.onrender.com');
    }
}
