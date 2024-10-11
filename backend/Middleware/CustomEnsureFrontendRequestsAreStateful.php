<?php

namespace App\Http\Middleware;

use Illuminate\Support\Str;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

class CustomEnsureFrontendRequestsAreStateful extends EnsureFrontendRequestsAreStateful
{
    protected function configureSecureCookieSessions()
    {
        config([
            'session.same_site' => config('session.same_site'), // Original middleware wasn't always respecting the config value
        ]);
    }
}