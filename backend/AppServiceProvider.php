<?php

namespace App\Providers;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Validator;
use Monicahq\Cloudflare\LaravelCloudflare;
use Monicahq\Cloudflare\Facades\CloudflareProxies;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        if ($this->app->environment() === 'local') {
            $this->app->register(\Laravel\Telescope\TelescopeServiceProvider::class);
            $this->app->register(TelescopeServiceProvider::class);
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Validator::extend('ext_correct_password', function ($attribute, $value, $parameters, $validator) {
            $user = auth()->user();

            return Hash::check($value, $user->password);
        }, 'The :attribute is incorrect for the current user.');

        Validator::extend('ext_password_format', function ($attribute, $value, $parameters, $validator) {
            return preg_match('/^(?!\s+$).{8,72}$/', $value); // 8 min length, 72 max length due to bcrypt limit, regex to ensures password is NOT only whitespace characters (allowing only whitespace can lead to issues related to validator and trimming, however leading/trailing whitespace with non-whitespace characters are still valid passwords and work properly.)
        }, 'Invalid :attribute format.');

        Validator::extend('ext_max_length', function ($attribute, $value, $parameters, $validator) {
            $maxLength = isset($parameters[0]) ? $parameters[0] : 255;
            return strlen($value) <= $maxLength;
        }, ':attribute exceeds max character length.');
    }
}
