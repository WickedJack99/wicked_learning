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
        );
});
