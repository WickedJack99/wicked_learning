<?php

namespace App\Http\Middleware;

use App\Localization\Services\UserLocaleResolver;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class SetRequestLocale
{
    public function __construct(private readonly UserLocaleResolver $localeResolver) {}

    /**
     * Apply the persisted user preference before Laravel renders messages or views.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        App::setLocale($this->localeResolver->forUser($request->user()));

        return $next($request);
    }
}
