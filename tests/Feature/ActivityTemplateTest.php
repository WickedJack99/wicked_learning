<?php

use App\Models\LearningActivity;
use App\Models\LearningActivityTemplate;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;

test('authors can save and retrieve a private activity template', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()
        ->where('type', 'obstacle')
        ->firstOrFail();

    $response = $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.templates.store', $activity), [
            'name' => 'Noisy gate starting point',
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('template.name', 'Noisy gate starting point')
        ->assertJsonPath('template.type', 'obstacle');

    $templateId = $response->json('template.id');

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.activity-templates.index', [
            'page' => 1,
            'per_page' => 8,
        ]))
        ->assertOk()
        ->assertJsonPath('items.0.id', $templateId)
        ->assertJsonPath('pagination.total', 1)
        ->assertJsonMissingPath('items.0.snapshot');

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.activity-templates.show', $templateId))
        ->assertOk()
        ->assertJsonPath('template.snapshot.title', $activity->title)
        ->assertJsonPath('template.snapshot.config.promptText', data_get($activity->config, 'promptText'));
});

test('authors cannot inspect another authors activity template', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $owner = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $otherAdmin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()->where('type', 'obstacle')->firstOrFail();

    $template = $this->actingAs($owner)
        ->postJson(route('settings.worlds.activities.templates.store', $activity), [
            'name' => 'Private gate',
        ])
        ->assertCreated()
        ->json('template.id');

    $this->actingAs($otherAdmin)
        ->getJson(route('settings.worlds.activity-templates.show', $template))
        ->assertNotFound();

    $this->actingAs($otherAdmin)
        ->getJson(route('settings.worlds.activity-templates.index'))
        ->assertOk()
        ->assertJsonPath('pagination.total', 0);

    $this->actingAs($otherAdmin)
        ->patchJson(route('settings.worlds.activity-templates.update', $template), [
            'name' => 'Stolen name',
        ])
        ->assertNotFound();

    $this->actingAs($otherAdmin)
        ->deleteJson(route('settings.worlds.activity-templates.destroy', $template))
        ->assertNotFound();
});

test('authors can rename and delete their private activity templates', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()->where('type', 'obstacle')->firstOrFail();

    $template = $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.templates.store', $activity), [
            'name' => 'Original gate template',
        ])
        ->assertCreated()
        ->json('template.id');

    $this->actingAs($admin)
        ->patchJson(route('settings.worlds.activity-templates.update', $template), [
            'name' => '  Renamed gate template  ',
        ])
        ->assertOk()
        ->assertJsonPath('template.name', 'Renamed gate template');

    expect(LearningActivityTemplate::query()->findOrFail($template)->name)
        ->toBe('Renamed gate template');

    $this->actingAs($admin)
        ->deleteJson(route('settings.worlds.activity-templates.destroy', $template))
        ->assertNoContent();

    expect(LearningActivityTemplate::query()->find($template))->toBeNull();
});

test('authors can share a template with organization members without exposing private templates', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $owner = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $member = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $outsider = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $organization = Organization::query()->create([
        'created_by_user_id' => $owner->id,
        'name' => 'Pattern Lab',
        'slug' => 'pattern-lab',
    ]);
    $organization->memberships()->createMany([
        [
            'user_id' => $owner->id,
            'role' => OrganizationMembership::ROLE_LEADER,
            'joined_at' => now(),
        ],
        [
            'user_id' => $member->id,
            'role' => OrganizationMembership::ROLE_MEMBER,
            'joined_at' => now(),
        ],
    ]);
    $activity = LearningActivity::query()->where('type', 'obstacle')->firstOrFail();

    $template = $this->actingAs($owner)
        ->postJson(route('settings.worlds.activities.templates.store', $activity), [
            'name' => 'Shared gate template',
        ])
        ->assertCreated()
        ->json('template.id');

    $this->actingAs($outsider)
        ->patchJson(route('settings.worlds.activity-templates.sharing.update', $template), [
            'organization_id' => $organization->id,
        ])
        ->assertNotFound();

    $this->actingAs($owner)
        ->getJson(route('settings.worlds.activity-templates.index'))
        ->assertOk()
        ->assertJsonPath('items.0.canManage', true)
        ->assertJsonPath('items.0.organization', null)
        ->assertJsonPath('shareTargets.0.id', $organization->id);

    $this->actingAs($owner)
        ->patchJson(route('settings.worlds.activity-templates.sharing.update', $template), [
            'organization_id' => $organization->id,
        ])
        ->assertOk()
        ->assertJsonPath('template.organization.id', $organization->id)
        ->assertJsonPath('template.organization.name', $organization->name);

    $this->actingAs($member)
        ->getJson(route('settings.worlds.activity-templates.index'))
        ->assertOk()
        ->assertJsonPath('pagination.total', 1)
        ->assertJsonPath('items.0.canManage', false)
        ->assertJsonPath('items.0.organization.id', $organization->id);

    $this->actingAs($member)
        ->getJson(route('settings.worlds.activity-templates.show', $template))
        ->assertOk()
        ->assertJsonPath('template.snapshot.title', $activity->title);

    $this->actingAs($member)
        ->patchJson(route('settings.worlds.activity-templates.update', $template), [
            'name' => 'Changed by member',
        ])
        ->assertNotFound();

    $this->actingAs($outsider)
        ->getJson(route('settings.worlds.activity-templates.index'))
        ->assertOk()
        ->assertJsonPath('pagination.total', 0);

    $this->actingAs($outsider)
        ->getJson(route('settings.worlds.activity-templates.show', $template))
        ->assertNotFound();

    $this->actingAs($owner)
        ->patchJson(route('settings.worlds.activity-templates.sharing.update', $template), [
            'organization_id' => null,
        ])
        ->assertOk()
        ->assertJsonPath('template.organization', null);

    expect(LearningActivityTemplate::query()->findOrFail($template)->organization_id)
        ->toBeNull();

    $this->actingAs($member)
        ->getJson(route('settings.worlds.activity-templates.index'))
        ->assertOk()
        ->assertJsonPath('pagination.total', 0);
});

test('npc dialogue graph activities cannot be saved as flat templates', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()
        ->where('type', 'npc_dialogue')
        ->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.activities.templates.store', $activity), [
            'name' => 'Dialogue template',
        ])
        ->assertStatus(422);
});
