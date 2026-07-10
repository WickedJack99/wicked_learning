<?php

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Models\AccessRole;
use App\Models\RegistrationToken;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('admin users can see the user management panel data', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();

    $this->actingAs($admin)
        ->get(route('settings.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('canManageUsers', true)
            ->has('adminUsers', 2)
            ->has('adminUsers.0.email')
            ->has('adminUsers.1.email')
        );
});

test('normal users do not receive admin user management data', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('settings.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('canManageUsers', false)
            ->has('adminUsers', 0)
        );
});

test('normal users can create user registration tokens', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->post(route('settings.registration-tokens.store'), [
            'roles' => [User::ROLE_USER],
            'expires_at' => null,
        ]);

    $response->assertRedirect(route('settings.index'));
    $response->assertSessionHas('created_registration_token');

    $token = RegistrationToken::query()->first();

    expect($token)
        ->not->toBeNull()
        ->and($token?->created_by_user_id)->toBe($user->id)
        ->and($token?->role)->toBe(User::ROLE_USER)
        ->and($token?->grantedRoles())->toBe([User::ROLE_USER]);
});

test('normal users can not create admin registration tokens', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('settings.registration-tokens.store'), [
            'roles' => [User::ROLE_ADMIN],
            'expires_at' => null,
        ])
        ->assertSessionHasErrors('roles.0');

    expect(RegistrationToken::query()->count())->toBe(0);
});

test('admins can create registration tokens for assignable roles', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $expiresAt = now()->addDay()->format('Y-m-d H:i:s');

    $response = $this->actingAs($admin)
        ->post(route('settings.registration-tokens.store'), [
            'roles' => [User::ROLE_USER, User::ROLE_ADMIN],
            'expires_at' => $expiresAt,
        ]);

    $response->assertRedirect(route('settings.index'));
    $response->assertSessionHas('created_registration_token');

    $token = RegistrationToken::query()->first();

    expect($token)
        ->not->toBeNull()
        ->and($token?->created_by_user_id)->toBe($admin->id)
        ->and($token?->role)->toBe(User::ROLE_ADMIN)
        ->and($token?->grantedRoles())->toBe([User::ROLE_USER, User::ROLE_ADMIN])
        ->and($token?->expires_at?->format('Y-m-d H:i:s'))->toBe($expiresAt)
        ->and($token?->used_at)->toBeNull();
});

test('admins can update another users access controls', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $banDate = now()->addWeek()->format('Y-m-d H:i:s');

    $this->actingAs($admin)
        ->patch(route('settings.admin.users.access.update', $learner), [
            'login_disabled' => true,
            'banned_until' => $banDate,
            'roles' => [User::ROLE_USER, User::ROLE_ADMIN],
        ])
        ->assertRedirect(route('settings.index'));

    $learner->refresh();

    expect($learner->login_disabled_at)
        ->not->toBeNull()
        ->and($learner->banned_until?->format('Y-m-d H:i:s'))
        ->toBe($banDate)
        ->and($learner->assignedRoles())
        ->toBe([User::ROLE_USER, User::ROLE_ADMIN]);
});

test('admins can not lock their own account from the panel', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.admin.users.access.update', $admin), [
            'login_disabled' => true,
            'banned_until' => null,
            'roles' => [User::ROLE_ADMIN],
        ])
        ->assertSessionHasErrors('user');

    expect($admin->refresh()->login_disabled_at)->toBeNull();
});

test('admins can delete another user', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();

    $this->actingAs($admin)
        ->delete(route('settings.admin.users.destroy', $learner))
        ->assertRedirect(route('settings.index'));

    expect(User::query()->whereKey($learner->id)->exists())->toBeFalse();
});

test('admins can create and update configurable roles', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.admin.roles.store'), [
            'slug' => 'editor',
            'name' => 'Editor',
            'description' => 'Can prepare learning content.',
            'level' => 50,
            'permissions' => [
                PermissionCatalog::USERS => AccessLevel::READ,
                PermissionCatalog::ROLES => AccessLevel::READ,
                PermissionCatalog::WORLDS => AccessLevel::UPDATE,
                PermissionCatalog::ASSETS => AccessLevel::UPDATE,
                PermissionCatalog::SOUNDS => AccessLevel::UPDATE,
                PermissionCatalog::PRESENTATION => AccessLevel::READ,
            ],
        ])
        ->assertRedirect(route('settings.index', ['panel' => 'admin-access']));

    $role = AccessRole::query()->where('slug', 'editor')->firstOrFail();

    expect($role->permissionMap()[PermissionCatalog::WORLDS])
        ->toBe(AccessLevel::UPDATE);

    $this->actingAs($admin)
        ->patch(route('settings.admin.roles.update', $role), [
            'name' => 'Content editor',
            'description' => 'Can prepare and remove learning content.',
            'level' => 60,
            'permissions' => [
                PermissionCatalog::USERS => AccessLevel::READ,
                PermissionCatalog::ROLES => AccessLevel::READ,
                PermissionCatalog::WORLDS => AccessLevel::DELETE,
                PermissionCatalog::ASSETS => AccessLevel::UPDATE,
                PermissionCatalog::SOUNDS => AccessLevel::UPDATE,
                PermissionCatalog::PRESENTATION => AccessLevel::READ,
            ],
        ])
        ->assertRedirect(route('settings.index', ['panel' => 'admin-access']));

    expect($role->refresh()->name)
        ->toBe('Content editor')
        ->and($role->permissionMap()[PermissionCatalog::WORLDS])
        ->toBe(AccessLevel::DELETE);
});

test('users without role update permission cannot create roles', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('settings.admin.roles.store'), [
            'slug' => 'blocked',
            'name' => 'Blocked',
            'description' => null,
            'level' => 10,
            'permissions' => [
                PermissionCatalog::USERS => AccessLevel::READ,
                PermissionCatalog::ROLES => AccessLevel::READ,
                PermissionCatalog::WORLDS => AccessLevel::READ,
                PermissionCatalog::ASSETS => AccessLevel::READ,
                PermissionCatalog::SOUNDS => AccessLevel::READ,
                PermissionCatalog::PRESENTATION => AccessLevel::READ,
            ],
        ])
        ->assertForbidden();

    expect(AccessRole::query()->where('slug', 'blocked')->exists())->toBeFalse();
});
