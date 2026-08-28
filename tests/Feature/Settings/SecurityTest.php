<?php

use App\Models\AccessChangeEvent;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;
use Laravel\Fortify\Events\TwoFactorAuthenticationEnabled;
use Laravel\Fortify\Features;
use Laravel\Passkeys\Events\PasskeyDeleted;
use Laravel\Passkeys\Events\PasskeyRegistered;
use Laravel\Passkeys\Passkey;

test('security page is displayed', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);
    Features::passkeys([
        'confirmPassword' => true,
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManagePasskeys', true)
            ->where('passkeys', [])
            ->where('canManageTwoFactor', true)
            ->where('twoFactorEnabled', false),
        );
});

test('security page requires password confirmation when enabled', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    $user = User::factory()->create();

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $response = $this->actingAs($user)
        ->get(route('security.edit'));

    $response->assertRedirect(route('password.confirm'));
});

test('security page renders without two factor when feature is disabled', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    config(['fortify.features' => []]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManagePasskeys', false)
            ->where('passkeys', [])
            ->where('canManageTwoFactor', false)
            ->missing('twoFactorEnabled')
            ->missing('requiresConfirmation'),
        );
});

test('password can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('security.edit'));

    expect(Hash::check('new-password', $user->refresh()->password))->toBeTrue();
    expect(AccessChangeEvent::query()
        ->where('target_user_id', $user->id)
        ->where('action', AccessChangeEvent::ACTION_PASSWORD_UPDATED)
        ->value('changes'))
        ->toBe([
            'credential' => [
                'before' => 'Password stored',
                'after' => 'Password updated',
            ],
        ]);
});

test('correct password must be provided to update password', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasErrors('current_password')
        ->assertRedirect(route('security.edit'));

    expect(AccessChangeEvent::query()
        ->where('target_user_id', $user->id)
        ->where('action', AccessChangeEvent::ACTION_PASSWORD_UPDATED)
        ->exists())->toBeFalse();
});

test('security factor changes are added to access history without secret material', function () {
    $user = User::factory()->create();
    $passkey = new Passkey([
        'name' => 'Personal laptop',
        'credential_id' => 'credential-id',
        'credential' => ['secret' => 'must-not-be-recorded'],
    ]);

    TwoFactorAuthenticationEnabled::dispatch($user);
    TwoFactorAuthenticationDisabled::dispatch($user);
    PasskeyRegistered::dispatch($user, $passkey);
    PasskeyDeleted::dispatch($user, $passkey);

    expect(AccessChangeEvent::query()
        ->where('target_user_id', $user->id)
        ->orderBy('id')
        ->pluck('action')
        ->all())
        ->toBe([
            AccessChangeEvent::ACTION_TWO_FACTOR_ENABLED,
            AccessChangeEvent::ACTION_TWO_FACTOR_DISABLED,
            AccessChangeEvent::ACTION_PASSKEY_REGISTERED,
            AccessChangeEvent::ACTION_PASSKEY_DELETED,
        ]);

    $events = AccessChangeEvent::query()
        ->where('target_user_id', $user->id)
        ->orderBy('id')
        ->get();

    expect($events[2]->changes)
        ->toBe([
            'security_factor' => [
                'before' => 'No passkey registered',
                'after' => 'Passkey registered',
            ],
        ])
        ->and(json_encode($events->toArray()))
        ->not->toContain('credential-id')
        ->not->toContain('must-not-be-recorded')
        ->not->toContain('Personal laptop');
});
