<?php

use App\Models\RegistrationToken;
use App\Models\User;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register', function () {
    $token = RegistrationToken::createFor(User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]));

    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'appearance' => 'dark',
        'registration_token' => $token,
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('world', absolute: false));

    $user = User::where('email', 'test@example.com')->first();

    expect($user?->preference)
        ->appearance->toBe('dark')
        ->and($user?->registrationToken)
        ->not->toBeNull()
        ->and($user?->registrationToken?->used_at)
        ->not->toBeNull();
});

test('new users get a light preference when registration has no appearance', function () {
    $token = RegistrationToken::createFor(User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]));

    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'registration_token' => $token,
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    expect(User::where('email', 'test@example.com')->first()?->preference)
        ->appearance->toBe('light');
});

test('registration requires a valid unused token', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'registration_token' => 'not-a-real-token',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertSessionHasErrors('registration_token');
    $this->assertGuest();
});

test('new users receive the role granted by the registration token', function () {
    $token = RegistrationToken::createFor(
        User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]),
        User::ROLE_ADMIN,
    );

    $this->post(route('register.store'), [
        'name' => 'Admin User',
        'email' => 'admin@example.com',
        'registration_token' => $token,
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    expect(User::where('email', 'admin@example.com')->first()?->role)
        ->toBe(User::ROLE_ADMIN);
});

test('expired registration tokens can not be used', function () {
    $token = RegistrationToken::createFor(
        User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]),
        User::ROLE_USER,
        now()->subMinute(),
    );

    $response = $this->post(route('register.store'), [
        'name' => 'Late User',
        'email' => 'late@example.com',
        'registration_token' => $token,
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertSessionHasErrors('registration_token');
    expect(User::where('email', 'late@example.com')->exists())->toBeFalse();
});

test('registration tokens can only be used once', function () {
    $token = RegistrationToken::createFor(User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]));

    $this->post(route('register.store'), [
        'name' => 'First User',
        'email' => 'first@example.com',
        'registration_token' => $token,
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    auth()->logout();

    $response = $this->post(route('register.store'), [
        'name' => 'Second User',
        'email' => 'second@example.com',
        'registration_token' => $token,
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertSessionHasErrors('registration_token');
    expect(User::where('email', 'second@example.com')->exists())->toBeFalse();
});
