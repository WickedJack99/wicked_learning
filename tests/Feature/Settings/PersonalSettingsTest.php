<?php

use App\Models\PlatformLanguage;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('personal settings compose profile, language and security data', function () {
    $user = User::factory()->create();
    PlatformLanguage::query()->create([
        'code' => 'ja',
        'name' => 'Japanese',
        'native_name' => 'Japanese',
        'is_enabled' => true,
    ]);

    $this->actingAs($user)
        ->get(route('settings.personal.edit', ['section' => 'language']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/personal')
            ->where('initialSection', 'language')
            ->where('locale', 'en')
            ->has('availableLanguages', 2)
            ->has('passwordRules')
            ->has('passkeys')
            ->where('soundPreferences.muted', false)
            ->where('soundPreferences.effectsVolume', 100)
            ->where('soundPreferences.ambienceVolume', 100)
        );
});

test('users can update sound preferences', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('settings.sound-preferences.update'), [
            'muted' => true,
            'effectsVolume' => 35,
            'ambienceVolume' => 60,
        ])
        ->assertRedirect();

    expect($user->fresh()->preference->settings['sound'])->toMatchArray([
        'muted' => true,
        'effectsVolume' => 35,
        'ambienceVolume' => 60,
    ]);
});
