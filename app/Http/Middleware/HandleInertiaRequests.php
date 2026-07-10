<?php

namespace App\Http\Middleware;

use App\Learning\Serializers\LearningToolSerializer;
use App\Models\LearningTool;
use App\Models\PlatformPresentationSetting;
use App\Support\Appearance;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    public function __construct(private readonly LearningToolSerializer $toolSerializer) {}

    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $appearanceCookie = $request->cookie('appearance');
        $browserAppearance = is_string($appearanceCookie) ? $appearanceCookie : null;

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                'tools' => $request->user()
                    ? $request->user()
                        ->learningTools()
                        ->get()
                        ->map(fn (LearningTool $tool): array => $this->toolSerializer->serialize($tool))
                        ->values()
                        ->all()
                    : [],
            ],
            'appearance' => $request->user()
                ? Appearance::forAuthenticatedUser(
                    $request->user()->preference?->appearance,
                    $browserAppearance,
                )
                : Appearance::forGuest(),
            'publicPresentation' => PlatformPresentationSetting::current(),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
