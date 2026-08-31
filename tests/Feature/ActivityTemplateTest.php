<?php

use App\Models\LearningActivity;
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
