<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\Http\Request;
use Illuminate\Auth\AuthenticationException;

class CustomAuthenticateSession extends AuthenticateSession
{
    /**
     * The session key for storing the password hash.
     *
     * @var string
     */
    protected $passwordHashKey = 'auth_password_hash';

    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        if (! $request->hasSession() || ! $request->user() || ! $request->user()->getAuthPassword()) {
            return $next($request);
        }

        if (! $request->session()->has($this->passwordHashKey)) {
            $this->storePasswordHashInSession($request);
        }

        if (! hash_equals($request->session()->get($this->passwordHashKey), $request->user()->getAuthPassword())) {
            $this->logout($request);
        }

        return tap($next($request), function () use ($request) {
            if (! is_null($this->guard()->user())) {
                $this->storePasswordHashInSession($request);
            }
        });
    }

    /**
     * Store the user's current password hash in the session.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return void
     */
    protected function storePasswordHashInSession($request)
    {
        if (! $request->user()) {
            return;
        }

        $request->session()->put([
            $this->passwordHashKey => $request->user()->getAuthPassword(),
        ]);
    }

    /**
     * Log the user out of the application.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return void
     *
     * @throws \Illuminate\Auth\AuthenticationException
     */
    protected function logout($request)
    {
        auth()->guard('web')->logout();
        
        $request->session()->invalidate();
        
        $request->session()->regenerateToken();

        throw new AuthenticationException(
            'Unauthenticated.', ['web'], $this->redirectTo($request)
        );
    }

    /**
     * Had issue with this being undefined sometimes so define it and return false
     *
     * @return bool
     */
    protected function viaRemember()
    {
        return false;
    }
}