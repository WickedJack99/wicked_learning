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
        ->get(route('settings.index', [
            'panel' => 'personal',
            'personal' => 'language',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('personalSettings.initialSection', 'profile')
            ->where('personalSettings.locale', 'en')
            ->has('personalSettings.availableLanguages', 2)
            ->has('personalSettings.passwordRules')
            ->has('personalSettings.passkeys')
            ->where('personalSettings.soundPreferences.muted', false)
            ->where('personalSettings.soundPreferences.effectsVolume', 100)
            ->where('personalSettings.soundPreferences.ambienceVolume', 100)
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
