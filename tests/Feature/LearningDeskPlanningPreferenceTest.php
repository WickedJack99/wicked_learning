<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('a learner can remember a private learning desk planning choice', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('home'))
        ->patch(route('learning.desk.preferences.update'), [
            'purposeFilter' => 'retrieve',
            'timeBudget' => 15,
        ])
        ->assertRedirect(route('home'));

    expect($user->refresh()->preference?->settings['learning']['deskPlanning'] ?? null)
        ->toBe([
            'purposeFilter' => 'retrieve',
            'timeBudget' => 15,
        ]);

    $this->actingAs($user)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('home')
            ->where('desk.planningPreference', [
                'isSaved' => true,
                'purposeFilter' => 'retrieve',
                'timeBudget' => 15,
            ]));
});

test('learning desk planning choices reject unsupported values', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('home'))
        ->patch(route('learning.desk.preferences.update'), [
            'purposeFilter' => 'invent',
            'timeBudget' => 60,
        ])
        ->assertSessionHasErrors(['purposeFilter', 'timeBudget']);

    expect($user->refresh()->preference)->toBeNull();
});
