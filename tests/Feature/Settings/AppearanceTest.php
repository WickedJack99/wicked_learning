<?php

use App\Models\User;
use App\Models\UserPreference;
use Inertia\Testing\AssertableInertia;

test('appearance page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('appearance.edit'))
        ->assertOk();
});

test('appearance preference can be stored', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->patch(route('appearance.update'), [
            'appearance' => 'dark',
        ]);

    $response->assertNoContent();

    expect($user->preference()->first())
        ->appearance->toBe('dark');
});

test('appearance preference rejects unresolved system mode', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('appearance.update'), [
            'appearance' => 'system',
        ])
        ->assertSessionHasErrors('appearance');

    expect($user->preference()->first())->toBeNull();
});

test('appearance preference rejects unknown modes', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('appearance.update'), [
            'appearance' => 'sparkly',
        ])
        ->assertSessionHasErrors('appearance');
});

test('legacy authenticated system preference resolves before the page reaches react', function () {
    $user = User::factory()->create();

    UserPreference::query()->create([
        'user_id' => $user->id,
        'appearance' => 'system',
    ]);

    $this->actingAs($user)
        ->get(route('settings.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('appearance', 'light')
        );
});

test('authenticated appearance cookie wins while the stored preference catches up', function () {
    $user = User::factory()->create();

    UserPreference::query()->create([
        'user_id' => $user->id,
        'appearance' => 'dark',
    ]);

    $this->actingAs($user)
        ->withUnencryptedCookie('appearance', 'light')
        ->get(route('settings.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('appearance', 'light')
        );
});
