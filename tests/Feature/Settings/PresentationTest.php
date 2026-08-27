<?php

use App\Models\PlatformPresentationSetting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

test('public pages receive presentation defaults', function () {
    $this->get(route('welcome'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('welcome')
            ->where('publicPresentation.branding.logo', '/images/logo.png')
            ->where('publicPresentation.auth.backgroundImages.login.dark', '')
            ->where('publicPresentation.cursors.default.image', '/images/cursors/fantasy-cursor.png')
            ->where('publicPresentation.cursors.action.image', '/images/cursors/fantasy-pointer.png')
            ->where('publicPresentation.cursors.grab.image', '/images/cursors/fantasy-grab-backhand.png')
            ->where('publicPresentation.cursors.grab.size', 40)
            ->where('publicPresentation.welcome.pages.0.title', 'Learning Worlds')
            ->where('publicPresentation.learnerPalette.dark.pageBackground', '#08111b')
            ->where('publicPresentation.learnerPalette.light.actionAccent', '#0e7490')
        );
});

test('admins can update public presentation settings', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.presentation.update'), [
            'branding' => [
                'logo' => '/images/custom-logo.png',
            ],
            'auth' => [
                'backgroundImages' => [
                    'login' => [
                        'dark' => '/images/themes/custom-login-dark.svg',
                        'light' => '/images/themes/custom-login-light.svg',
                    ],
                    'register' => [
                        'dark' => '/images/themes/custom-register-dark.svg',
                        'light' => '',
                    ],
                    'welcome' => [
                        'dark' => '/images/themes/custom-welcome-dark.svg',
                        'light' => '/images/themes/custom-welcome-light.svg',
                    ],
                ],
            ],
            'cursors' => [
                'default' => [
                    'image' => '/images/cursors/custom-cursor.svg',
                    'hotspotX' => 5,
                    'hotspotY' => 6,
                    'size' => 36,
                    'fallback' => 'default',
                ],
                'action' => [
                    'image' => '/images/cursors/custom-pointer.svg',
                    'hotspotX' => 10,
                    'hotspotY' => 3,
                    'size' => 42,
                    'fallback' => 'pointer',
                ],
                'grab' => [
                    'image' => '/images/cursors/custom-grab.svg',
                    'hotspotX' => 11,
                    'hotspotY' => 12,
                    'size' => 48,
                    'fallback' => 'grab',
                ],
            ],
            'welcome' => [
                'pages' => [
                    [
                        'eyebrow' => 'Custom intro',
                        'title' => 'Custom Learning Worlds',
                        'body' => 'A configurable welcome page.',
                        'primaryLabel' => 'Start',
                    ],
                ],
            ],
            'sourceLinks' => [
                'origin' => [
                    'label' => 'Origin',
                    'url' => 'https://github.com/WickedJack99/wicked_learning',
                ],
                'custom' => [],
            ],
        ])
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-presentation-localization',
            'presentation' => 'public',
        ]));

    $settings = PlatformPresentationSetting::current();

    expect($settings['auth']['backgroundImages']['login']['dark'])
        ->toBe('/images/themes/custom-login-dark.svg')
        ->and($settings['branding']['logo'])
        ->toBe('/images/custom-logo.png')
        ->and($settings['cursors']['action']['image'])
        ->toBe('/images/cursors/custom-pointer.svg')
        ->and($settings['cursors']['grab']['hotspotY'])
        ->toBe(12)
        ->and($settings['cursors']['grab']['size'])
        ->toBe(48)
        ->and($settings['welcome']['pages'][0]['title'])
        ->toBe('Custom Learning Worlds');
});

test('normal users can not update public presentation settings', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('settings.presentation.update'), [
            'auth' => [
                'backgroundImages' => [
                    'login' => ['dark' => '/no.svg', 'light' => ''],
                    'register' => ['dark' => '/no.svg', 'light' => ''],
                    'welcome' => ['dark' => '/no.svg', 'light' => ''],
                ],
            ],
            'welcome' => [
                'pages' => [
                    [
                        'eyebrow' => 'No',
                        'title' => 'No',
                        'body' => 'No',
                        'primaryLabel' => 'No',
                    ],
                ],
            ],
        ])
        ->assertForbidden();

    expect(PlatformPresentationSetting::query()->count())->toBe(0);
});

test('settings page shares platform color palette with normal users', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $user = User::factory()->create();

    PlatformPresentationSetting::updateCurrent([
        'settingsPalette' => [
            'dark' => [
                'accent' => '#ff4fd8',
                'inputBackground' => '#180a24',
                'inputBorderColor' => '#b46cff',
                'sidebarBackground' => '#101820',
            ],
            'light' => [
                'accent' => '#0f766e',
            ],
        ],
    ], $admin);

    $this->actingAs($user)
        ->get(route('settings.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('publicPresentation.settingsPalette.dark.accent', '#ff4fd8')
            ->where('publicPresentation.settingsPalette.dark.inputBackground', '#180a24')
            ->where('publicPresentation.settingsPalette.dark.inputBorderColor', '#b46cff')
            ->where('publicPresentation.settingsPalette.dark.sidebarBackground', '#101820')
        );
});

test('admins can update learner interface palette settings', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.color-palette.update'), [
            'publicPresentation' => [
                'learnerPalette' => [
                    'dark' => [
                        'accent' => '#f0abfc',
                        'pageBackground' => '#12101f',
                    ],
                    'light' => [
                        'actionAccent' => '#155e75',
                    ],
                ],
            ],
        ])
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-presentation-localization',
            'presentation' => 'palette',
        ]));

    $settings = PlatformPresentationSetting::current();

    expect($settings['learnerPalette']['dark']['accent'])
        ->toBe('#f0abfc')
        ->and($settings['learnerPalette']['dark']['pageBackground'])
        ->toBe('#12101f')
        ->and($settings['learnerPalette']['light']['actionAccent'])
        ->toBe('#155e75');
});

test('admins can upload public presentation background images', function () {
    Storage::fake('public');

    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.presentation.background-images.store'), [
            'image' => UploadedFile::fake()->image('login-background.png', 1200, 800),
        ])
        ->assertOk()
        ->assertJsonPath('url', fn (string $url): bool => str_starts_with($url, '/storage/presentation/backgrounds/'));

    $storedFiles = Storage::disk('public')->allFiles('presentation/backgrounds');

    expect($storedFiles)->toHaveCount(1);
    Storage::disk('public')->assertExists($storedFiles[0]);
});

test('normal users can not upload public presentation background images', function () {
    Storage::fake('public');

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('settings.presentation.background-images.store'), [
            'image' => UploadedFile::fake()->image('login-background.png'),
        ])
        ->assertForbidden();

    expect(Storage::disk('public')->allFiles('presentation/backgrounds'))->toBe([]);
});
