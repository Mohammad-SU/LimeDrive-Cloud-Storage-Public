<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Str;

class GenerateSecureRandomString extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:generate-secure-random-string';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Not for scheduler use. Generate secure random 32 char strings for api keys or whatever else.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info(Str::random(32));
    }
}
