<?php

use App\Models\PlatformPresentationSetting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

test('public pages receive presentation defaults', function () {
    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('welcome')
            ->where('publicPresentation.auth.backgroundImages.login.dark', '/images/themes/mentor-calm.svg')
            ->where('publicPresentation.welcome.pages.0.title', 'Learning Worlds')
        );
});

test('admins can update public presentation settings', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.presentation.update'), [
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
        ])
        ->assertRedirect(route('settings.index', ['panel' => 'admin-presentation']));

    $settings = PlatformPresentationSetting::current();

    expect($settings['auth']['backgroundImages']['login']['dark'])
        ->toBe('/images/themes/custom-login-dark.svg')
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
