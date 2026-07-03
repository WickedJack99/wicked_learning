<?php

use App\Models\User;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('world'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the world map', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('world'));
    $response->assertOk();
});

test('the old dashboard route redirects to the world map', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('world'));
});
