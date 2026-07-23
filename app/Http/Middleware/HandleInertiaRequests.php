<?php

namespace App\Http\Middleware;

use App\Learning\Queries\LoadCurrentMenuMapTheme;
use App\Learning\Serializers\LearningItemSerializer;
use App\Learning\Serializers\LearningToolSerializer;
use App\Learning\Serializers\PlatformJournalSettingsSerializer;
use App\Localization\Services\PlatformLocaleCatalog;
use App\Localization\Services\UserLocaleResolver;
use App\Models\LearningItem;
use App\Models\LearningTool;
use App\Models\PlatformJournalSetting;
use App\Models\PlatformPresentationSetting;
use App\Settings\Serializers\SoundPreferenceSerializer;
use App\Support\Appearance;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    public function __construct(
        private readonly LearningToolSerializer $toolSerializer,
        private readonly LearningItemSerializer $itemSerializer,
        private readonly LoadCurrentMenuMapTheme $loadCurrentMenuMapTheme,
        private readonly PlatformJournalSettingsSerializer $journalSettings,
        private readonly PlatformLocaleCatalog $localeCatalog,
        private readonly UserLocaleResolver $localeResolver,
        private readonly SoundPreferenceSerializer $soundPreferences,
    ) {}

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
                'items' => $request->user()
                    ? $request->user()
                        ->learningItems()
                        ->get()
                        ->map(fn (LearningItem $item): array => $this->itemSerializer->serialize($item))
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
            'soundPreferences' => $this->soundPreferences->serialize($request->user()?->preference),
            'journalTheme' => fn (): array => $this->journalSettings
                ->serialize(PlatformJournalSetting::current())['theme'],
            'publicPresentation' => PlatformPresentationSetting::current(),
            'menuTheme' => $this->loadCurrentMenuMapTheme->handle($request->user()),
            'localization' => [
                'locale' => $this->localeResolver->forUser($request->user()),
                // This catalog deliberately contains platform UI copy only.
                'translations' => $this->localeCatalog->translations(
                    $this->localeResolver->forUser($request->user()),
                ),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
