<?php

namespace App\Http\Middleware;

use App\Support\Appearance;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class HandleAppearance
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $browserAppearance = $request->cookie('appearance');
        $browserAppearance = is_string($browserAppearance) ? $browserAppearance : null;

        $appearance = $request->user()
            ? Appearance::forAuthenticatedUser(
                $request->user()->preference?->appearance,
                $browserAppearance,
            )
            : Appearance::forGuest();

        View::share('appearance', $appearance);

        return $next($request);
    }
}
