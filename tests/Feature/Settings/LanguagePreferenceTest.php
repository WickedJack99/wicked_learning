<?php

use App\Models\PlatformLanguage;
use App\Models\User;

test('a user can persist an enabled language preference', function () {
    $user = User::factory()->create();
    PlatformLanguage::query()->create([
        'code' => 'ja',
        'name' => 'Japanese',
        'native_name' => '日本語',
        'is_enabled' => true,
    ]);

    $this->actingAs($user)
        ->patch(route('settings.language.update'), ['locale' => 'ja'])
        ->assertRedirect(route('settings.personal.edit', ['section' => 'language']));

    expect($user->refresh()->preference?->settings)->toMatchArray([
        'locale' => 'ja',
    ]);
});

test('a disabled language cannot be selected by a learner', function () {
    $user = User::factory()->create();
    PlatformLanguage::query()->create([
        'code' => 'ja',
        'name' => 'Japanese',
        'native_name' => '日本語',
        'is_enabled' => false,
    ]);

    $this->actingAs($user)
        ->patch(route('settings.language.update'), ['locale' => 'ja'])
        ->assertStatus(422);
});
