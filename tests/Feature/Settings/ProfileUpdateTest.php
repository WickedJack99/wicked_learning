<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('profile page is displayed', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('profile.edit'));

    $response->assertRedirect(route('settings.personal.edit', ['section' => 'profile']));
});

test('profile information can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'username' => 'test_user',
            'profile_image' => '/storage/profiles/images/avatar.webp',
            'email' => 'test@example.com',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.personal.edit', ['section' => 'profile']));

    $user->refresh();

    expect($user->name)->toBe('Test User');
    expect($user->username)->toBe('test_user');
    expect($user->profile_image)->toBe('/storage/profiles/images/avatar.webp');
    expect($user->avatar)->toBe('/storage/profiles/images/avatar.webp');
    expect($user->email)->toBe('test@example.com');
    expect($user->email_verified_at)->toBeNull();
});

test('public username must be unique', function () {
    User::factory()->create(['username' => 'taken_name']);
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'username' => 'taken_name',
            'email' => $user->email,
        ]);

    $response->assertSessionHasErrors('username');
});

test('profile image can be uploaded', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->postJson(route('profile.image.store'), [
            'file' => UploadedFile::fake()->create('avatar.png', 12, 'image/png'),
        ]);

    $response
        ->assertOk()
        ->assertJsonStructure(['durationSeconds', 'url']);

    expect($response->json('url'))->toStartWith('/storage/profiles/images/');
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.personal.edit', ['section' => 'profile']));

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('user can delete their account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('correct password must be provided to delete account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh())->not->toBeNull();
});
