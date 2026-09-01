<?php

use App\Models\AccessLink;
use App\Models\LearningItem;
use App\Models\LearningTool;
use App\Models\User;

test('users without user-management permission cannot create access links', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('settings.access-links.store'), [
            'purpose' => AccessLink::PURPOSE_REGISTRATION,
            'expires_at' => now()->addDay()->toDateTimeString(),
        ])
        ->assertForbidden();

    expect(AccessLink::query()->count())->toBe(0);
});

test('administrators can create and view access links without receiving the token back in listings', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $tool = LearningTool::query()->create([
        'slug' => 'pattern-lens',
        'title' => 'Pattern Lens',
    ]);

    $response = $this->actingAs($admin)->post(route('settings.access-links.store'), [
        'purpose' => AccessLink::PURPOSE_GRANT_TOOL,
        'tool_id' => $tool->id,
        'expires_at' => now()->addDay()->format('Y-m-d H:i:s'),
        'note' => 'Workshop demo',
    ]);

    $response->assertRedirect(route('settings.index', [
        'panel' => 'admin-access',
        'access' => 'links',
    ]));
    $response->assertSessionHas('created_access_link');

    $link = AccessLink::query()->firstOrFail();

    expect($link->purpose)
        ->toBe(AccessLink::PURPOSE_GRANT_TOOL)
        ->and($link->payload)
        ->toBe(['toolId' => $tool->id])
        ->and(strlen($link->token_hash))
        ->toBe(64);

    $this->actingAs($admin)
        ->get(route('settings.index', ['panel' => 'admin-access', 'access' => 'links']))
        ->assertInertia(fn ($page) => $page
            ->where('accessLinks.0.purpose', AccessLink::PURPOSE_GRANT_TOOL)
            ->where('accessLinks.0.note', 'Workshop demo')
            ->missing('accessLinks.0.token_hash'));
});

test('a logged-in learner can redeem a tool link once', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $learner = User::factory()->create();
    $tool = LearningTool::query()->create([
        'slug' => 'field-notes',
        'title' => 'Field Notes',
    ]);
    $token = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_GRANT_TOOL,
        ['toolId' => $tool->id],
        now()->addDay(),
    );

    $this->actingAs($learner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));

    expect($learner->fresh()->learningTools()->whereKey($tool->id)->exists())->toBeTrue()
        ->and(AccessLink::query()->firstOrFail()->redeemed_by_user_id)->toBe($learner->id);

    $this->actingAs($learner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertGone();
});

test('item links grant their configured quantities and reject an expired link', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $learner = User::factory()->create();
    $item = LearningItem::query()->create([
        'slug' => 'curiosity-card',
        'title' => 'Curiosity Card',
    ]);
    $token = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_GRANT_ITEMS,
        ['items' => [['itemId' => $item->id, 'quantity' => 3]]],
        now()->addDay(),
    );

    $this->actingAs($learner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));

    expect($learner->fresh()->learningItems()->whereKey($item->id)->first()?->pivot?->quantity)
        ->toBe(3);

    $expiredToken = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_GRANT_ITEMS,
        ['items' => [['itemId' => $item->id, 'quantity' => 1]]],
        now()->subMinute(),
    );

    $this->actingAs($learner)
        ->get(route('access-links.show', ['token' => $expiredToken]))
        ->assertGone();
});

test('registration links enter the existing registration flow and are consumed when the account is created', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $token = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_REGISTRATION,
        ['roles' => [User::ROLE_USER]],
        now()->addDay(),
    );

    $this->get(route('access-links.show', ['token' => $token]))
        ->assertRedirect(route('register', ['registration_token' => $token], absolute: false));

    $this->post(route('register.store'), [
        'name' => 'Linked learner',
        'email' => 'linked@example.com',
        'appearance' => 'dark',
        'registration_token' => $token,
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('home', absolute: false));

    $linkedUser = User::query()->where('email', 'linked@example.com')->firstOrFail();

    expect(AccessLink::query()->firstOrFail()->redeemed_by_user_id)->toBe($linkedUser->id);
});

test('temporary login links create a learner-role account and cannot be replayed', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $token = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_TEMPORARY_LOGIN,
        [],
        now()->addDay(),
    );

    $this->get(route('access-links.show', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));

    $temporary = auth()->user();

    expect($temporary)
        ->not->toBeNull()
        ->and($temporary?->hasRole(User::ROLE_TEMPORARY))
        ->toBeTrue()
        ->and($temporary?->hasRole(User::ROLE_ADMIN))
        ->toBeFalse();

    auth()->logout();

    $this->get(route('access-links.show', ['token' => $token]))
        ->assertGone();
});

test('example', function () {
    $response = $this->get('/');

    $response->assertStatus(200);
});
