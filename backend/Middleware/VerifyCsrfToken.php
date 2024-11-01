<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     *
     * @var array<int, string>
     */
    protected $except = [
        'api/verifyEmail',
        'api/getLinkShareFileViewingUrl',
        'api/getLinkShareFileDownload',
    ];

    // For some reason axios doesn't always send the X-XSRF-TOKEN as a *header* but sends it as a cookie
    // so this function is to check for that
    protected function getTokenFromRequest($request): string|null
    {
        // Keep default behavior, use parent method first
        $token = parent::getTokenFromRequest($request);

        // If token not found then look for token in cookie
        if (!$token){
            $token = $request->cookie('XSRF-TOKEN');
            if (is_array($token)) {
                return null;
            }
        }
        return $token;
    }
}