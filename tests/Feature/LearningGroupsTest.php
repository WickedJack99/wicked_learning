<?php

use App\Models\LearningGroup;
use App\Models\LearningMap;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;

test('admins can see groups inside access management settings', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $group = LearningGroup::query()->create([
        'name' => 'Design Team',
        'slug' => 'design-team',
    ]);
    $group->members()->attach($admin->id, ['joined_at' => now()]);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->has('accessGroups', 1)
            ->where('accessGroups.0.name', 'Design Team')
            ->has('accessGroupUsers', 1)
        );
});

test('old groups settings url redirects into access management', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->get(route('settings.groups.index'))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]));
});

test('admins can create groups and assign several users', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $members = User::factory()->count(3)->create();

    $this->actingAs($admin)
        ->post(route('settings.groups.store'), [
            'name' => 'Design Team',
            'description' => 'Build a topic world together.',
        ])
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]));

    $group = LearningGroup::query()->where('slug', 'design-team')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.groups.members.update', $group), [
            'user_ids' => $members->pluck('id')->all(),
        ])
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]));

    expect($group->refresh()->members()->pluck('users.id')->sort()->values()->all())
        ->toBe($members->pluck('id')->sort()->values()->all());
});

test('group members can chat and vote to let admins view chat history', function () {
    [$first, $second] = User::factory()->count(2)->create();
    $group = LearningGroup::query()->create([
        'name' => 'Project Pair',
        'slug' => 'project-pair',
    ]);
    $group->members()->attach([
        $first->id => ['joined_at' => now()],
        $second->id => ['joined_at' => now()],
    ]);

    $this->actingAs($first)
        ->postJson(route('learning.groups.messages.store', $group), [
            'body' => 'Let us design the first map.',
        ])
        ->assertOk()
        ->assertJsonPath('group.messages.0.body', 'Let us design the first map.');

    $this->actingAs($first)
        ->postJson(route('learning.groups.admin-chat-vote', $group))
        ->assertOk()
        ->assertJsonPath('group.adminChatVisible', false);

    $this->actingAs($second)
        ->postJson(route('learning.groups.admin-chat-vote', $group))
        ->assertOk()
        ->assertJsonPath('group.adminChatVisible', true);

    expect($group->refresh()->admin_chat_visible_enabled)->toBeTrue();
});

test('group chat blocks a third consecutive message inside one minute', function () {
    Carbon::setTestNow('2026-07-21 12:00:00');

    [$first, $second] = User::factory()->count(2)->create();
    $group = LearningGroup::query()->create([
        'name' => 'Quick Chat',
        'slug' => 'quick-chat',
    ]);
    $group->members()->attach([
        $first->id => ['joined_at' => now()],
        $second->id => ['joined_at' => now()],
    ]);

    $this->actingAs($first)
        ->postJson(route('learning.groups.messages.store', $group), [
            'body' => 'First.',
        ])
        ->assertOk();

    $this->actingAs($first)
        ->postJson(route('learning.groups.messages.store', $group), [
            'body' => 'Second.',
        ])
        ->assertOk();

    $this->actingAs($first)
        ->postJson(route('learning.groups.messages.store', $group), [
            'body' => 'Third.',
        ])
        ->assertSessionHasErrors('body');

    $this->actingAs($second)
        ->postJson(route('learning.groups.messages.store', $group), [
            'body' => 'I can answer.',
        ])
        ->assertOk();

    $this->actingAs($first)
        ->postJson(route('learning.groups.messages.store', $group), [
            'body' => 'Now I can answer too.',
        ])
        ->assertOk();

    expect($group->messages()->count())->toBe(4);

    Carbon::setTestNow();
});

test('new group members reset future admin chat visibility but preserve the prior cutoff', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    [$first, $second, $third] = User::factory()->count(3)->create();
    $group = LearningGroup::query()->create([
        'name' => 'Project Trio',
        'slug' => 'project-trio',
        'admin_chat_visible_enabled' => true,
    ]);
    $group->members()->attach([
        $first->id => ['joined_at' => now()->subMinutes(2)],
        $second->id => ['joined_at' => now()->subMinutes(2)],
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.groups.members.update', $group), [
            'user_ids' => [$first->id, $second->id, $third->id],
        ])
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]));

    $group->refresh();

    expect($group->admin_chat_visible_enabled)->toBeFalse()
        ->and($group->admin_chat_visible_until)->not->toBeNull()
        ->and($group->adminChatVotes()->count())->toBe(0);
});

test('assigned group members can configure a map but cannot delete it', function () {
    $world = LearningWorld::query()->create([
        'title' => 'Project World',
        'slug' => 'project-world',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'title' => 'Assigned Map',
        'slug' => 'assigned-map',
    ]);
    $member = User::factory()->create();
    $group = LearningGroup::query()->create([
        'name' => 'Map Editors',
        'slug' => 'map-editors',
    ]);
    $group->members()->attach($member->id, ['joined_at' => now()]);
    $group->editableMaps()->attach($map->id);

    $this->actingAs($member)
        ->get(route('settings.worlds.maps.configure', $map))
        ->assertOk();

    $this->actingAs($member)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'title' => 'Assigned Map Updated',
            'description' => 'Edited by a group member.',
        ])
        ->assertRedirect();

    $this->actingAs($member)
        ->delete(route('settings.worlds.maps.destroy', $map))
        ->assertForbidden();

    expect($map->refresh()->title)->toBe('Assigned Map Updated');
});
