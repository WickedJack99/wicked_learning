<?php

use App\Models\Organization;
use App\Models\OrganizationIconReport;
use App\Models\OrganizationJoinRequest;
use App\Models\OrganizationMembership;
use App\Models\PlatformOrganizationSetting;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

test('users can create and browse organizations', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('organizations.store'), [
            'name' => 'Project Guild',
            'slogan' => 'Build useful things together.',
            'description' => 'A place for learners to coordinate.',
        ])
        ->assertRedirect(route('organizations.show', ['organization' => 'project-guild']));

    $organization = Organization::query()->where('slug', 'project-guild')->firstOrFail();

    expect($organization->memberships()->where('role', OrganizationMembership::ROLE_LEADER)->where('user_id', $user->id)->exists())
        ->toBeTrue();

    $this->actingAs($user)
        ->get(route('organizations.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/index')
            ->has('organizations', 1)
            ->where('organizations.0.slogan', 'Build useful things together.')
        );
});

test('the organization directory searches public identity fields before pagination', function () {
    $user = User::factory()->create();

    Organization::query()->create([
        'created_by_user_id' => $user->id,
        'name' => 'Quiet Archive',
        'slug' => 'quiet-archive',
        'slogan' => 'A place for careful notes.',
    ]);
    Organization::query()->create([
        'created_by_user_id' => $user->id,
        'name' => 'Pattern Guild',
        'slug' => 'pattern-guild',
        'description' => 'Explore patterns together.',
    ]);

    $this->actingAs($user)
        ->get(route('organizations.index', ['search' => 'PATTERN']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/index')
            ->where('search', 'PATTERN')
            ->where('pagination.currentPage', 1)
            ->where('pagination.lastPage', 1)
            ->where('pagination.total', 1)
            ->has('organizations', 1)
            ->where('organizations.0.name', 'Pattern Guild'));

    $this->actingAs($user)
        ->get(route('organizations.index', ['search' => 'CAREFUL']))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('pagination.total', 1)
            ->where('organizations.0.name', 'Quiet Archive'));

    $this->actingAs($user)
        ->get(route('organizations.index', ['search' => 'EXPLORE']))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('pagination.total', 1)
            ->where('organizations.0.name', 'Pattern Guild'));
});

test('the organization directory paginates in the database and clamps stale pages', function () {
    $user = User::factory()->create();

    foreach (range(1, 13) as $index) {
        Organization::query()->create([
            'created_by_user_id' => $user->id,
            'name' => 'Project Guild '.str_pad((string) $index, 2, '0', STR_PAD_LEFT),
            'slug' => 'project-guild-'.$index,
        ]);
    }

    Organization::query()
        ->where('slug', 'project-guild-13')
        ->firstOrFail()
        ->memberships()
        ->create([
            'user_id' => $user->id,
            'role' => OrganizationMembership::ROLE_MEMBER,
            'joined_at' => now(),
        ]);

    $pageQuery = null;
    $organizationQueries = [];
    $membershipQueries = [];
    $joinRequestQueries = [];
    DB::listen(function (QueryExecuted $query) use (&$pageQuery, &$organizationQueries, &$membershipQueries, &$joinRequestQueries): void {
        if (str_contains($query->sql, 'from "organizations"')
            && preg_match('/limit 12 offset 12/i', $query->sql) === 1) {
            $pageQuery = $query;
        }

        if (str_contains(strtolower($query->sql), 'from "organizations"')) {
            $organizationQueries[] = $query;
        }

        if (preg_match('/select \* from "organization_memberships"/i', $query->sql) === 1) {
            $membershipQueries[] = $query;
        }

        if (preg_match('/select \* from "organization_join_requests"/i', $query->sql) === 1) {
            $joinRequestQueries[] = $query;
        }
    });

    $this->actingAs($user)
        ->get(route('organizations.index', ['page' => 2]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/index')
            ->where('pagination.currentPage', 2)
            ->where('pagination.lastPage', 2)
            ->where('pagination.perPage', 12)
            ->where('pagination.total', 13)
            ->has('organizations', 1)
            ->where('organizations.0.name', 'Project Guild 13')
            ->where('organizations.0.viewerMembership.role', OrganizationMembership::ROLE_MEMBER));

    expect($pageQuery)->toBeInstanceOf(QueryExecuted::class)
        ->and($organizationQueries)->toHaveCount(2)
        ->and($membershipQueries)->toHaveCount(1)
        ->and($joinRequestQueries)->toHaveCount(1);

    $this->actingAs($user)
        ->get(route('organizations.index', ['page' => 99]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('pagination.currentPage', 2)
            ->has('organizations', 1)
            ->where('organizations.0.name', 'Project Guild 13'));
});

test('organization chat paginates recent messages in the database', function () {
    $user = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $user->id,
        'name' => 'Message Lab',
        'slug' => 'message-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $user->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    foreach (range(1, 9) as $index) {
        $message = $organization->messages()->create([
            'user_id' => $user->id,
            'body' => 'Message '.$index,
        ]);
        $message->forceFill([
            'created_at' => Carbon::create(2026, 8, 1, 12, $index),
        ])->saveQuietly();
    }

    $messagePageQuery = null;
    DB::listen(function (QueryExecuted $query) use (&$messagePageQuery): void {
        if (str_contains($query->sql, 'from "organization_messages"')
            && preg_match('/limit 8 offset 8/i', $query->sql) === 1) {
            $messagePageQuery = $query;
        }
    });

    $this->actingAs($user)
        ->get(route('organizations.show', [
            'organization' => $organization,
            'messages_page' => 2,
            'section' => 'chat',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/show')
            ->where('organization.messagesPagination.currentPage', 2)
            ->where('organization.messagesPagination.lastPage', 2)
            ->where('organization.messagesPagination.perPage', 8)
            ->where('organization.messagesPagination.total', 9)
            ->has('organization.messages', 1)
            ->where('organization.messages.0.body', 'Message 1'));

    expect($messagePageQuery)->toBeInstanceOf(QueryExecuted::class);

    $this->actingAs($user)
        ->get(route('organizations.show', [
            'organization' => $organization,
            'messages_page' => 99,
            'section' => 'chat',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('organization.messagesPagination.currentPage', 2)
            ->has('organization.messages', 1)
            ->where('organization.messages.0.body', 'Message 1'));
});

test('organization member lists paginate in the database and preserve the leader count', function () {
    $leader = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Member Lab',
        'slug' => 'member-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    foreach (range(1, 8) as $index) {
        $organization->memberships()->create([
            'user_id' => User::factory()->create()->id,
            'role' => OrganizationMembership::ROLE_MEMBER,
            'joined_at' => now(),
        ]);
    }

    $memberPageQuery = null;
    DB::listen(function (QueryExecuted $query) use (&$memberPageQuery): void {
        if (str_contains($query->sql, 'from "organization_memberships"')
            && preg_match('/limit 8 offset 8/i', $query->sql) === 1) {
            $memberPageQuery = $query;
        }
    });

    $this->actingAs($leader)
        ->get(route('organizations.show', [
            'organization' => $organization,
            'members_page' => 2,
            'section' => 'members',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/show')
            ->where('organization.membersPagination.currentPage', 2)
            ->where('organization.membersPagination.lastPage', 2)
            ->where('organization.membersPagination.perPage', 8)
            ->where('organization.membersPagination.total', 9)
            ->where('organization.leaderCount', 1)
            ->has('organization.members', 1));

    expect($memberPageQuery)->toBeInstanceOf(QueryExecuted::class);

    $this->actingAs($leader)
        ->get(route('organizations.show', [
            'organization' => $organization,
            'members_page' => 99,
            'section' => 'members',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('organization.membersPagination.currentPage', 2)
            ->has('organization.members', 1)
            ->where('organization.leaderCount', 1));
});

test('leaders receive only pending join requests for the requested server page', function () {
    $leader = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Request Lab',
        'slug' => 'request-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->joinRequests()->create([
        'user_id' => User::factory()->create()->id,
        'status' => OrganizationJoinRequest::STATUS_APPROVED,
    ]);

    foreach (range(1, 5) as $index) {
        $organization->joinRequests()->create([
            'user_id' => User::factory()->create()->id,
            'status' => OrganizationJoinRequest::STATUS_PENDING,
            'message' => 'Request '.$index,
        ]);
    }

    $joinRequestPageQuery = null;
    DB::listen(function (QueryExecuted $query) use (&$joinRequestPageQuery): void {
        if (str_contains($query->sql, 'from "organization_join_requests"')
            && preg_match('/limit 4 offset 4/i', $query->sql) === 1) {
            $joinRequestPageQuery = $query;
        }
    });

    $this->actingAs($leader)
        ->get(route('organizations.show', [
            'organization' => $organization,
            'join_requests_page' => 2,
            'section' => 'join-requests',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/show')
            ->where('organization.joinRequestsPagination.currentPage', 2)
            ->where('organization.joinRequestsPagination.lastPage', 2)
            ->where('organization.joinRequestsPagination.perPage', 4)
            ->where('organization.joinRequestsPagination.total', 5)
            ->has('organization.joinRequests', 1)
            ->where('organization.joinRequests.0.status', OrganizationJoinRequest::STATUS_PENDING)
            ->where('organization.joinRequests.0.message', 'Request 5'));

    expect($joinRequestPageQuery)->toBeInstanceOf(QueryExecuted::class);
});

test('organization chat stays private from non-members', function () {
    $leader = User::factory()->create();
    $outsider = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Private Chat Lab',
        'slug' => 'private-chat-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->messages()->create([
        'user_id' => $leader->id,
        'body' => 'Private message.',
    ]);

    $messageQueryCount = 0;
    DB::listen(function (QueryExecuted $query) use (&$messageQueryCount): void {
        if (str_contains($query->sql, 'from "organization_messages"')) {
            $messageQueryCount++;
        }
    });

    $this->actingAs($outsider)
        ->get(route('organizations.show', $organization))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('organization.messages', 0)
            ->where('organization.messagesPagination', null)
            ->where('organization.canSendMessages', false));

    expect($messageQueryCount)->toBe(0);
});

test('users choose an organization governance type during creation', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('organizations.store'), [
            'name' => 'Open Assembly',
            'governance_type' => Organization::GOVERNANCE_ANARCHY,
        ])
        ->assertRedirect();

    $organization = Organization::query()->where('slug', 'open-assembly')->firstOrFail();

    expect($organization->governance_type)->toBe(Organization::GOVERNANCE_ANARCHY)
        ->and($organization->memberships()->where('user_id', $user->id)->value('role'))
        ->toBe(OrganizationMembership::ROLE_LEADER);
});

test('organization membership limit is enforced and configurable by admins', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $user = User::factory()->create();
    PlatformOrganizationSetting::current()->forceFill([
        'max_memberships_per_user' => 1,
    ])->save();

    $this->actingAs($user)
        ->post(route('organizations.store'), ['name' => 'First'])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('organizations.store'), ['name' => 'Second'])
        ->assertSessionHasErrors('organization');

    $this->actingAs($admin)
        ->patch(route('settings.admin-panel.organizations.update'), [
            'max_memberships_per_user' => 2,
        ])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('organizations.store'), ['name' => 'Second'])
        ->assertRedirect();

    expect(PlatformOrganizationSetting::current()->max_memberships_per_user)->toBe(2);
});

test('users request membership and leaders approve requests', function () {
    $leader = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Open Lab',
        'slug' => 'open-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    $this->actingAs($member)
        ->post(route('organizations.join-requests.store', $organization), [
            'message' => 'I want to help.',
        ])
        ->assertRedirect();

    $request = OrganizationJoinRequest::query()->firstOrFail();

    $this->actingAs($leader)
        ->patch(route('organizations.join-requests.update', $request), [
            'approved' => true,
        ])
        ->assertRedirect();

    expect($organization->memberships()->where('user_id', $member->id)->exists())
        ->toBeTrue()
        ->and($request->refresh()->status)->toBe(OrganizationJoinRequest::STATUS_APPROVED);
});

test('anarchy organizations make every accepted member a leader', function () {
    $leader = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'governance_type' => Organization::GOVERNANCE_ANARCHY,
        'name' => 'Anarchy Lab',
        'slug' => 'anarchy-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $request = $organization->joinRequests()->create([
        'user_id' => $member->id,
        'status' => OrganizationJoinRequest::STATUS_PENDING,
    ]);

    $this->actingAs($leader)
        ->patch(route('organizations.join-requests.update', $request), [
            'approved' => true,
        ])
        ->assertRedirect();

    expect($organization->memberships()->where('user_id', $member->id)->value('role'))
        ->toBe(OrganizationMembership::ROLE_LEADER);
});

test('random organizations rotate to one new leader each month', function () {
    Carbon::setTestNow('2026-07-10 12:00:00');

    $leader = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'governance_type' => Organization::GOVERNANCE_RANDOM,
        'leadership_rotated_at' => now(),
        'name' => 'Random Lab',
        'slug' => 'random-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->memberships()->create([
        'user_id' => $member->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    Carbon::setTestNow('2026-08-01 09:00:00');

    $this->actingAs($leader)
        ->get(route('organizations.show', $organization))
        ->assertOk();

    expect($organization->memberships()->where('role', OrganizationMembership::ROLE_LEADER)->count())
        ->toBe(1)
        ->and($organization->memberships()->where('user_id', $leader->id)->value('role'))
        ->toBe(OrganizationMembership::ROLE_MEMBER)
        ->and($organization->memberships()->where('user_id', $member->id)->value('role'))
        ->toBe(OrganizationMembership::ROLE_LEADER);

    Carbon::setTestNow();
});

test('random organization leaders can leave when another member can replace them', function () {
    $leader = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'governance_type' => Organization::GOVERNANCE_RANDOM,
        'leadership_rotated_at' => now(),
        'name' => 'Random Exit',
        'slug' => 'random-exit',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->memberships()->create([
        'user_id' => $member->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    $this->actingAs($leader)
        ->delete(route('organizations.membership.destroy', $organization))
        ->assertRedirect(route('organizations.show', $organization));

    expect($organization->memberships()->where('user_id', $leader->id)->exists())
        ->toBeFalse()
        ->and($organization->memberships()->where('user_id', $member->id)->value('role'))
        ->toBe(OrganizationMembership::ROLE_LEADER);
});

test('leaders can leave an organization when another leader remains', function () {
    $leader = User::factory()->create();
    $otherLeader = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Shared Leadership',
        'slug' => 'shared-leadership',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->memberships()->create([
        'user_id' => $otherLeader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    $this->actingAs($leader)
        ->delete(route('organizations.membership.destroy', $organization))
        ->assertRedirect(route('organizations.show', $organization));

    expect($organization->memberships()->where('user_id', $leader->id)->exists())
        ->toBeFalse()
        ->and($organization->memberships()->where('user_id', $otherLeader->id)->exists())
        ->toBeTrue();
});

test('the last organization leader must delete instead of leaving', function () {
    $leader = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Solo Leadership',
        'slug' => 'solo-leadership',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    $this->actingAs($leader)
        ->delete(route('organizations.membership.destroy', $organization))
        ->assertSessionHasErrors('organization');

    expect($organization->memberships()->where('user_id', $leader->id)->exists())
        ->toBeTrue();
});

test('leaders can promote organization members to leaders', function () {
    $leader = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Promotion Lab',
        'slug' => 'promotion-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $membership = $organization->memberships()->create([
        'user_id' => $member->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    $this->actingAs($leader)
        ->patch(route('organizations.memberships.promote', $membership))
        ->assertRedirect();

    expect($membership->refresh()->role)->toBe(OrganizationMembership::ROLE_LEADER);
});

test('leaders can remove another organization member but cannot remove themselves through moderation', function () {
    $leader = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Moderation Lab',
        'slug' => 'moderation-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $memberMembership = $organization->memberships()->create([
        'user_id' => $member->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    $this->actingAs($leader)
        ->delete(route('organizations.memberships.destroy', $memberMembership))
        ->assertRedirect();

    expect($organization->memberships()->whereKey($memberMembership->id)->exists())
        ->toBeFalse();

    $leaderMembership = $organization->memberships()->where('user_id', $leader->id)->firstOrFail();

    $this->actingAs($leader)
        ->delete(route('organizations.memberships.destroy', $leaderMembership))
        ->assertSessionHasErrors('organization');

    expect($leaderMembership->refresh()->exists)->toBeTrue();
});

test('regular organization members cannot remove another member', function () {
    $leader = User::factory()->create();
    $member = User::factory()->create();
    $otherMember = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Removal Guard',
        'slug' => 'removal-guard',
    ]);
    $organization->memberships()->createMany([
        [
            'user_id' => $leader->id,
            'role' => OrganizationMembership::ROLE_LEADER,
            'joined_at' => now(),
        ],
        [
            'user_id' => $member->id,
            'role' => OrganizationMembership::ROLE_MEMBER,
            'joined_at' => now(),
        ],
    ]);
    $otherMembership = $organization->memberships()->create([
        'user_id' => $otherMember->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    $this->actingAs($member)
        ->delete(route('organizations.memberships.destroy', $otherMembership))
        ->assertForbidden();

    expect($otherMembership->refresh()->exists)->toBeTrue();
});

test('regular organization members cannot promote other members', function () {
    $leader = User::factory()->create();
    $member = User::factory()->create();
    $otherMember = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Promotion Guard',
        'slug' => 'promotion-guard',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->memberships()->create([
        'user_id' => $member->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);
    $membership = $organization->memberships()->create([
        'user_id' => $otherMember->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    $this->actingAs($member)
        ->patch(route('organizations.memberships.promote', $membership))
        ->assertForbidden();

    expect($membership->refresh()->role)->toBe(OrganizationMembership::ROLE_MEMBER);
});

test('only organization members can send internal chat messages', function () {
    $leader = User::factory()->create();
    $outsider = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Chat Lab',
        'slug' => 'chat-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    $this->actingAs($outsider)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'Nope.',
        ])
        ->assertSessionHasErrors('organization');

    $this->actingAs($leader)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'Welcome inside.',
        ])
        ->assertRedirect();

    expect($organization->messages()->value('body'))->toBe('Welcome inside.');
});

test('organization chat blocks a third consecutive message inside one minute', function () {
    Carbon::setTestNow('2026-07-21 12:00:00');

    $first = User::factory()->create();
    $second = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $first->id,
        'name' => 'Rate Limit Lab',
        'slug' => 'rate-limit-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $first->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->memberships()->create([
        'user_id' => $second->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    $this->actingAs($first)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'First message.',
        ])
        ->assertRedirect();

    $this->actingAs($first)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'Second message.',
        ])
        ->assertRedirect();

    $this->actingAs($first)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'Third message.',
        ])
        ->assertSessionHasErrors('body');

    expect($organization->messages()->count())->toBe(2);

    $this->actingAs($second)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'Another member answers.',
        ])
        ->assertRedirect();

    $this->actingAs($first)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'Now I can answer.',
        ])
        ->assertRedirect();

    expect($organization->messages()->count())->toBe(4);

    Carbon::setTestNow();
});

test('organization chat allows another consecutive message after one minute', function () {
    Carbon::setTestNow('2026-07-21 12:00:00');

    $user = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $user->id,
        'name' => 'Slow Chat Lab',
        'slug' => 'slow-chat-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $user->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    $this->actingAs($user)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'First message.',
        ])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'Second message.',
        ])
        ->assertRedirect();

    Carbon::setTestNow('2026-07-21 12:01:01');

    $this->actingAs($user)
        ->post(route('organizations.messages.store', $organization), [
            'body' => 'One minute later.',
        ])
        ->assertRedirect();

    expect($organization->messages()->count())->toBe(3);

    Carbon::setTestNow();
});

test('organization members can delete their own chat messages', function () {
    $author = User::factory()->create();
    $otherMember = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $author->id,
        'name' => 'Delete Chat Lab',
        'slug' => 'delete-chat-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $author->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $organization->memberships()->create([
        'user_id' => $otherMember->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);
    $message = $organization->messages()->create([
        'user_id' => $author->id,
        'body' => 'I can remove this.',
    ]);

    $this->actingAs($otherMember)
        ->delete(route('organizations.messages.destroy', $message))
        ->assertForbidden();

    expect($message->fresh())->not->toBeNull();

    $this->actingAs($author)
        ->delete(route('organizations.messages.destroy', $message))
        ->assertRedirect();

    expect($message->fresh())->toBeNull();
});

test('admins can hide organization chat messages from members while admins still see them', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $otherAdmin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $member = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $member->id,
        'name' => 'Moderation Lab',
        'slug' => 'moderation-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $member->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $message = $organization->messages()->create([
        'user_id' => $member->id,
        'body' => 'This should be hidden from members.',
    ]);

    $this->actingAs($member)
        ->patch(route('organizations.messages.hide', $message))
        ->assertForbidden();

    $this->actingAs($admin)
        ->patch(route('organizations.messages.hide', $message))
        ->assertRedirect();

    expect($message->refresh()->hidden_by_user_id)->toBe($admin->id)
        ->and($message->hidden_at)->not->toBeNull();

    $this->actingAs($member)
        ->get(route('organizations.show', $organization))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/show')
            ->has('organization.messages', 0)
        );

    $this->actingAs($otherAdmin)
        ->get(route('organizations.show', $organization))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/show')
            ->has('organization.messages', 1)
            ->where('organization.messages.0.body', 'This should be hidden from members.')
            ->where('organization.messages.0.hiddenBy.name', $admin->name)
            ->where('organization.messages.0.canHide', false)
            ->where('organization.canModerateMessages', true)
            ->where('organization.canSendMessages', false)
        );
});

test('authors cannot delete organization chat messages after an admin hides them', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $organization = Organization::query()->create([
        'created_by_user_id' => $admin->id,
        'name' => 'Hidden Author Lab',
        'slug' => 'hidden-author-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $admin->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);
    $message = $organization->messages()->create([
        'user_id' => $admin->id,
        'body' => 'An admin should not be able to erase this after hiding it.',
    ]);

    $this->actingAs($admin)
        ->patch(route('organizations.messages.hide', $message))
        ->assertRedirect();

    $this->actingAs($admin)
        ->delete(route('organizations.messages.destroy', $message))
        ->assertForbidden();

    expect($message->fresh())->not->toBeNull();

    $this->actingAs($admin)
        ->get(route('organizations.show', $organization))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('organizations/show')
            ->where('organization.messages.0.canDelete', false)
            ->where('organization.messages.0.hiddenBy.name', $admin->name)
        );
});

test('icon reports keep the user who set the icon and admins can remove it', function () {
    Storage::fake('public');

    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $leader = User::factory()->create();
    $reporter = User::factory()->create();
    $organization = Organization::query()->create([
        'created_by_user_id' => $leader->id,
        'name' => 'Icon Lab',
        'slug' => 'icon-lab',
    ]);
    $organization->memberships()->create([
        'user_id' => $leader->id,
        'role' => OrganizationMembership::ROLE_LEADER,
        'joined_at' => now(),
    ]);

    $this->actingAs($leader)
        ->postJson(route('organizations.icon.store', $organization), [
            'file' => UploadedFile::fake()->image('icon.png', 128, 128),
        ])
        ->assertOk()
        ->assertJsonStructure(['url']);

    $organization->refresh();

    $this->actingAs($reporter)
        ->post(route('organizations.icon-reports.store', $organization), [
            'reason' => 'This icon needs review.',
        ])
        ->assertRedirect();

    $report = OrganizationIconReport::query()->firstOrFail();

    expect($report->icon_set_by_user_id)->toBe($leader->id);

    $this->actingAs($admin)
        ->patch(route('settings.admin-panel.organization-icon-reports.resolve', $report), [
            'remove_icon' => true,
        ])
        ->assertRedirect();

    expect($report->refresh()->status)->toBe(OrganizationIconReport::STATUS_RESOLVED)
        ->and($organization->refresh()->icon_url)->toBeNull();
});
