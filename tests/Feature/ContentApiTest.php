<?php

use App\Models\LearningMap;
use App\Models\LearningWorld;
use App\Models\User;

test('the content contract is available only to authorized administrators', function () {
    $admin = contentApiUser(User::ROLE_ADMIN);
    $learner = contentApiUser(User::ROLE_USER);

    $this->actingAs($admin)
        ->getJson(route('api.content.contract'))
        ->assertOk()
        ->assertJsonPath('data.version', '1.1')
        ->assertJsonPath('data.basePath', '/api/content/v1')
        ->assertJsonPath('data.contentPlan.version', '1.1')
        ->assertJsonPath('data.contentPlan.humanApprovalRequired', true)
        ->assertJsonCount(7, 'data.operations');

    $this->actingAs($learner)
        ->getJson(route('api.content.contract'))
        ->assertForbidden();
});

test('administrators can create maps map assets and activities through the content contract', function () {
    $admin = contentApiUser(User::ROLE_ADMIN);
    contentApiWorld();

    $mapResponse = $this->actingAs($admin)
        ->postJson(route('api.content.maps.store'), [
            'title' => 'Engine Bay',
            'slug' => 'engine-bay',
            'description' => 'Explore connected vehicle systems.',
        ])
        ->assertCreated()
        ->assertJsonPath('data.slug', 'engine-bay');
    $mapId = $mapResponse->json('data.id');
    $map = LearningMap::query()->findOrFail($mapId);

    $assetResponse = $this->actingAs($admin)
        ->postJson(route('api.content.map-assets.store', $map), [
            'title' => 'Alternator',
            'description' => 'Converts mechanical energy into electrical energy.',
            'image_url' => null,
            'text' => 'Alternator',
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 14,
            'opacity' => 1,
            'locked' => false,
            'interaction_mode' => 'focusable',
            'interaction_config' => null,
            'visual_config' => null,
            'sound_config' => null,
        ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Alternator')
        ->assertJsonPath('data.activityCount', 0);
    $assetId = $assetResponse->json('data.id');

    $this->actingAs($admin)
        ->postJson(route('api.content.activities.store', $assetId), [
            'title' => 'Explain the energy conversion',
            'slug' => 'explain-energy-conversion',
            'type' => 'reflection',
            'introduction' => 'Connect the visible parts to the flow of energy.',
            'reflection_prompt' => 'How does energy change form inside this component?',
            'reflection_note' => 'Name the input and output forms of energy.',
            'reflection_topic' => 'Vehicle electrics',
            'reflection_subtopic' => 'Alternator',
            'graph_position_x' => 120,
            'graph_position_y' => 80,
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'reflection')
        ->assertJsonPath('data.config.prompt', 'How does energy change form inside this component?');

    $this->actingAs($admin)
        ->getJson(route('api.content.maps.index'))
        ->assertOk()
        ->assertJsonFragment(['slug' => 'engine-bay']);

    $this->actingAs($admin)
        ->getJson(route('api.content.map-assets.index', $map))
        ->assertOk()
        ->assertJsonPath('data.0.activityCount', 1);

    $this->actingAs($admin)
        ->getJson(route('api.content.activities.index', $assetId))
        ->assertOk()
        ->assertJsonPath('data.0.title', 'Explain the energy conversion');
});

test('content api validation returns actionable field errors without partial creation', function () {
    $admin = contentApiUser(User::ROLE_ADMIN);
    contentApiWorld();

    $this->actingAs($admin)
        ->postJson(route('api.content.maps.store'), [
            'title' => '',
            'slug' => 'invalid map slug',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title']);

    expect(LearningMap::query()->count())->toBe(0);
});

function contentApiUser(string $role): User
{
    return User::factory()->create([
        'role' => $role,
        'roles' => [$role],
    ]);
}

function contentApiWorld(): LearningWorld
{
    return LearningWorld::query()->create([
        'slug' => 'demo-learning-world',
        'title' => 'Learning World',
    ]);
}
