<?php

use App\Models\AccessLink;
use App\Models\LearningItem;
use App\Models\LearningTool;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

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

test('users without user-management permission cannot change access-link status', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $user = User::factory()->create();
    AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_REGISTRATION,
        ['roles' => [User::ROLE_USER]],
        now()->addDay(),
    );
    $link = AccessLink::query()->firstOrFail();

    $this->actingAs($user)
        ->patch(route('settings.access-links.status.update', ['accessLink' => $link]), [
            'enabled' => false,
        ])
        ->assertForbidden();

    expect($link->fresh()->is_enabled)->toBeTrue();
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
        ->and($link->usage_policy)
        ->toBe(AccessLink::USAGE_ONE_TIME)
        ->and($link->is_enabled)
        ->toBeTrue()
        ->and($link->payload)
        ->toBe(['toolId' => $tool->id])
        ->and(strlen($link->token_hash))
        ->toBe(64);

    $firstToken = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_TEMPORARY_LOGIN,
        [],
        now()->addDay(),
    );
    $secondToken = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_TEMPORARY_LOGIN,
        [],
        now()->addDay(),
    );

    expect($firstToken)
        ->toHaveLength(32)
        ->not->toBe($secondToken);

    $this->actingAs($admin)
        ->get(route('settings.index', ['panel' => 'admin-access', 'access' => 'links']))
        ->assertInertia(fn ($page) => $page
            ->where('accessLinks.0.purpose', AccessLink::PURPOSE_GRANT_TOOL)
            ->where('accessLinks.0.note', 'Workshop demo')
            ->where('accessLinks.0.usagePolicy', AccessLink::USAGE_ONE_TIME)
            ->where('accessLinks.0.isEnabled', true)
            ->missing('accessLinks.0.token_hash'));
});

test('administrators can create registration and temporary login links from the admin page', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

    foreach ([AccessLink::PURPOSE_REGISTRATION, AccessLink::PURPOSE_TEMPORARY_LOGIN] as $purpose) {
        $this->actingAs($admin)
            ->post(route('settings.access-links.store'), [
                'purpose' => $purpose,
                'expires_at' => now()->addDay()->format('Y-m-d H:i:s'),
                'usage_policy' => $purpose === AccessLink::PURPOSE_REGISTRATION
                    ? AccessLink::USAGE_PER_USER
                    : AccessLink::USAGE_ONE_TIME,
                'roles' => $purpose === AccessLink::PURPOSE_REGISTRATION
                    ? [User::ROLE_USER]
                    : [],
            ])
            ->assertRedirect(route('settings.index', [
                'panel' => 'admin-access',
                'access' => 'links',
            ]));
    }

    expect(AccessLink::query()->orderBy('id')->pluck('purpose')->all())
        ->toBe([
            AccessLink::PURPOSE_REGISTRATION,
            AccessLink::PURPOSE_TEMPORARY_LOGIN,
        ])
        ->and(AccessLink::query()->orderBy('id')->pluck('usage_policy')->all())
        ->toBe([
            AccessLink::USAGE_PER_USER,
            AccessLink::USAGE_ONE_TIME,
        ]);
});

test('access-link management paginates the list in the database and clamps stale pages', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

    foreach (range(1, 9) as $index) {
        AccessLink::createFor(
            $admin,
            AccessLink::PURPOSE_REGISTRATION,
            ['roles' => [User::ROLE_USER]],
            now()->addDay(),
            "Invite {$index}",
        );

        AccessLink::query()
            ->latest('id')
            ->firstOrFail()
            ->forceFill(['created_at' => now()->addSeconds($index)])
            ->save();
    }

    $pageQuery = null;
    DB::listen(function (QueryExecuted $query) use (&$pageQuery): void {
        if (str_contains($query->sql, 'from "access_links"') && preg_match('/limit 8 offset 8/', $query->sql) === 1) {
            $pageQuery = $query;
        }
    });

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'links',
            'access_link_page' => 2,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('settings/index')
            ->where('accessLinksPagination.currentPage', 2)
            ->where('accessLinksPagination.lastPage', 2)
            ->where('accessLinksPagination.perPage', 8)
            ->where('accessLinksPagination.total', 9)
            ->has('accessLinks', 1)
            ->where('accessLinks.0.note', 'Invite 1'));

    expect($pageQuery)->toBeInstanceOf(QueryExecuted::class);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'links',
            'access_link_page' => 99,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('accessLinksPagination.currentPage', 2)
            ->has('accessLinks', 1)
            ->where('accessLinks.0.note', 'Invite 1'));
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

test('multiple-use links can be redeemed repeatedly', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $learner = User::factory()->create();
    $item = LearningItem::query()->create([
        'slug' => 'repeatable-item',
        'title' => 'Repeatable Item',
    ]);
    $token = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_GRANT_ITEMS,
        ['items' => [['itemId' => $item->id, 'quantity' => 2]]],
        now()->addDay(),
        null,
        AccessLink::USAGE_MULTIPLE,
    );

    $this->actingAs($learner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));
    $this->actingAs($learner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));

    expect($learner->fresh()->learningItems()->whereKey($item->id)->first()?->pivot?->quantity)
        ->toBe(4)
        ->and(AccessLink::query()->firstOrFail()->redemptions()->count())
        ->toBe(2);
});

test('per-user links allow one redemption for each learner but reject a replay', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $firstLearner = User::factory()->create();
    $secondLearner = User::factory()->create();
    $tool = LearningTool::query()->create([
        'slug' => 'per-user-tool',
        'title' => 'Per User Tool',
    ]);
    $token = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_GRANT_TOOL,
        ['toolId' => $tool->id],
        now()->addDay(),
        null,
        AccessLink::USAGE_PER_USER,
    );

    $this->actingAs($firstLearner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));
    $this->actingAs($firstLearner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertGone();
    $this->actingAs($secondLearner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));

    expect($firstLearner->fresh()->learningTools()->whereKey($tool->id)->exists())->toBeTrue()
        ->and($secondLearner->fresh()->learningTools()->whereKey($tool->id)->exists())->toBeTrue()
        ->and(AccessLink::query()->firstOrFail()->redemptions()->count())->toBe(2);
});

test('administrators can disable and re-enable an access link', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $learner = User::factory()->create();
    $token = AccessLink::createFor(
        $admin,
        AccessLink::PURPOSE_GRANT_TOOL,
        ['toolId' => LearningTool::query()->create([
            'slug' => 'toggle-tool',
            'title' => 'Toggle Tool',
        ])->id],
        now()->addDay(),
    );
    $link = AccessLink::query()->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.access-links.status.update', ['accessLink' => $link]), [
            'enabled' => false,
        ])
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'links',
        ]));

    $this->actingAs($learner)
        ->get(route('access-links.show', ['token' => $token]))
        ->assertGone();
    $this->actingAs($learner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertGone();

    $this->actingAs($admin)
        ->patch(route('settings.access-links.status.update', ['accessLink' => $link]), [
            'enabled' => true,
        ])
        ->assertRedirect();

    expect($link->fresh()->is_enabled)->toBeTrue();

    $this->actingAs($learner)
        ->post(route('access-links.redeem', ['token' => $token]))
        ->assertRedirect(route('home', absolute: false));
});

test('temporary login links reject the per-user policy', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

    $this->actingAs($admin)
        ->post(route('settings.access-links.store'), [
            'purpose' => AccessLink::PURPOSE_TEMPORARY_LOGIN,
            'usage_policy' => AccessLink::USAGE_PER_USER,
            'expires_at' => now()->addDay()->format('Y-m-d H:i:s'),
        ])
        ->assertSessionHasErrors('usage_policy');

    expect(AccessLink::query()->count())->toBe(0);
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
