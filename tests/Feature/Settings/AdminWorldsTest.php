<?php

use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

test('admin users can see the world graph with portal links', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->get(route('settings.worlds.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/worlds/index')
            ->where('worldGraph.world.slug', 'demo-cybersecurity')
            ->has('worldGraph.maps', 2)
            ->has('worldGraph.portalCandidates', 5)
            ->has('worldGraph.portalLinks', 1)
            ->where('worldGraph.portalLinks.0.sourceNode.slug', 'portal-foundation')
            ->where('worldGraph.portalLinks.0.targetNode.slug', 'return-gate')
        );
});

test('normal users can not open the world editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('settings.worlds.index'))
        ->assertForbidden();
});

test('admin users can create a map before it has portal links', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.store'), [
            'title' => 'Reflection Harbor',
            'description' => 'A prepared map that will be connected later.',
        ])
        ->assertRedirect(route('settings.worlds.index'));

    expect(LearningMap::query()
        ->where('slug', 'reflection-harbor')
        ->where('title', 'Reflection Harbor')
        ->exists())->toBeTrue()
        ->and(LearningPortalLink::query()->count())->toBe(1);
});

test('normal users can not create world maps', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('settings.worlds.maps.store'), [
            'title' => 'Hidden Harbor',
        ])
        ->assertForbidden();
});

test('admin users can create and delete portal links', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $target = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.portal-links.store'), [
            'source_learning_node_id' => $source->id,
            'target_learning_node_id' => $target->id,
            'label' => 'Notes to Archive',
            'description' => 'A test portal route.',
        ])
        ->assertRedirect(route('settings.worlds.index'));

    $link = LearningPortalLink::query()
        ->where('source_learning_node_id', $source->id)
        ->where('target_learning_node_id', $target->id)
        ->firstOrFail();

    expect($link->label)->toBe('Notes to Archive')
        ->and($link->description)->toBe('A test portal route.')
        ->and($link->config['travelMode'])->toBe('portal');

    $this->actingAs($admin)
        ->delete(route('settings.worlds.portal-links.destroy', $link))
        ->assertRedirect(route('settings.worlds.index'));

    expect(LearningPortalLink::query()->whereKey($link->id)->exists())->toBeFalse();
});

test('duplicate portal links are rejected', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $source = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $target = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.portal-links.store'), [
            'source_learning_node_id' => $source->id,
            'target_learning_node_id' => $target->id,
        ])
        ->assertSessionHasErrors('target_learning_node_id');
});

test('admin users can open the hex map editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.worlds.maps.edit', $map))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/worlds/edit-map')
            ->where('editableMap.map.slug', 'first-sector')
            ->has('editableMap.map.nodes', 4)
        );
});

test('admin users can open the activity graph editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.worlds.nodes.activities.edit', $node))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/worlds/edit-node-activities')
            ->where('activityGraph.node.slug', 'signal-gate')
            ->has('activityGraph.activities', 4)
            ->has('activityGraph.transitions', 4)
            ->has('activityGraph.activityTypes')
        );
});

test('admin users can create and connect activity graph nodes', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Choose a note path',
            'type' => 'placeholder',
            'introduction' => 'A branchable activity shell.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()->where('slug', 'choose-a-note-path')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $activity->id,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $node->refresh();

    expect($node->start_activity_id)->toBe($activity->id);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activity-transitions.store', $node), [
            'from_activity_id' => $activity->id,
            'to_activity_id' => null,
            'from_connector' => 'completed',
            'to_connector' => 'end',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $transition = $activity->transitions()->firstOrFail();

    expect($transition->to_activity_id)->toBeNull()
        ->and($transition->from_connector)->toBe('completed')
        ->and($transition->to_connector)->toBe('end');

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activity-transitions.destroy', $transition))
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->transitions()->exists())->toBeFalse();
});

test('admin users can edit and delete activity graph nodes', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->where('learning_node_id', $node->id)->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Updated Field Note',
            'slug' => 'updated-field-note',
            'type' => 'portal',
            'portal_mode' => 'output',
            'introduction' => 'Updated generic activity fields.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity->refresh();

    expect($activity->title)->toBe('Updated Field Note')
        ->and($activity->slug)->toBe('updated-field-note')
        ->and($activity->type)->toBe('portal')
        ->and($activity->config['portalMode'])->toBe('output');

    $node->forceFill(['start_activity_id' => $activity->id])->save();

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activities.destroy', $activity))
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $node->refresh();

    expect(LearningActivity::query()->whereKey($activity->id)->exists())->toBeFalse()
        ->and($node->start_activity_id)->toBeNull();
});

test('admin users can add a tile to a map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.nodes.store', $map), [
            'title' => 'Practice Node',
            'description' => 'A new editable tile.',
            'position_q' => 2,
            'position_r' => -1,
            'state' => 'available',
            'visual_config' => [
                'icon' => 'map',
                'label' => 'Practice',
                'tileColor' => '#253047',
                'foregroundColor' => '#bfdbfe',
                'labelColor' => '#ffffff',
                'highlightColor' => '#7dd3fc',
                'tooltip' => 'Created from the admin editor.',
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    expect(LearningNode::query()
        ->where('learning_map_id', $map->id)
        ->where('slug', 'practice-node')
        ->exists())->toBeTrue()
        ->and(LearningPortalLink::query()->count())->toBe(1);
});

test('admin users can add the first tile to an empty map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => LearningMap::query()->where('slug', 'first-sector')->firstOrFail()->learning_world_id,
        'slug' => 'empty-map',
        'title' => 'Empty Map',
        'description' => 'A prepared map without nodes.',
        'background_config' => [],
        'grid_config' => [],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.maps.nodes.store', $map), [
            'title' => 'First Tile',
            'description' => 'The first tile on a prepared empty map.',
            'position_q' => 0,
            'position_r' => 0,
            'state' => 'available',
            'visual_config' => [
                'icon' => 'map',
                'label' => 'First Tile',
                'tileColor' => '#253047',
                'foregroundColor' => '#bfdbfe',
                'labelColor' => '#ffffff',
                'highlightColor' => '#7dd3fc',
                'tooltip' => 'Starting tile for this map.',
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    expect(LearningNode::query()
        ->where('learning_map_id', $map->id)
        ->where('slug', 'first-tile')
        ->where('position_q', 0)
        ->where('position_r', 0)
        ->exists())->toBeTrue();
});

test('admin users can edit an existing tile', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => 'Signal Gate Revised',
            'slug' => 'signal-gate',
            'description' => 'Updated from the admin editor.',
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'available',
            'visual_config' => [
                'icon' => 'radio-tower',
                'imageUrl' => '/storage/learning/nodes/custom.svg',
                'label' => 'Signal Gate',
                'tileColor' => '#0f3f46',
                'foregroundColor' => '#9cf5df',
                'labelColor' => '#ffffff',
                'highlightColor' => '#40f08a',
                'hideLabel' => true,
                'tooltip' => 'Edited tile.',
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    $node->refresh();

    expect($node->title)->toBe('Signal Gate Revised')
        ->and($node->description)->toBe('Updated from the admin editor.')
        ->and($node->visual_config['imageUrl'])->toBe('/storage/learning/nodes/custom.svg')
        ->and($node->visual_config['hideLabel'])->toBeTrue()
        ->and($node->visual_config['tooltip'])->toBe('Edited tile.');
});

test('admin users can upload a node image', function () {
    Storage::fake('public');
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    $response = $this->actingAs($admin)
        ->postJson(route('settings.worlds.node-images.store'), [
            'image' => UploadedFile::fake()->create('tile.svg', 4, 'image/svg+xml'),
        ])
        ->assertOk()
        ->assertJsonStructure(['url']);

    $url = $response->json('url');

    expect($url)->toStartWith('/storage/learning/nodes/');
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $url));
});

test('admin users can swap neighboring tiles', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $portal = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $signalGate = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $portalStart = [$portal->position_q, $portal->position_r];
    $signalGateStart = [$signalGate->position_q, $signalGate->position_r];

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.swap', $portal), [
            'direction_q' => $signalGate->position_q - $portal->position_q,
            'direction_r' => $signalGate->position_r - $portal->position_r,
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $portal->map));

    $portal->refresh();
    $signalGate->refresh();

    expect([$portal->position_q, $portal->position_r])->toBe($signalGateStart)
        ->and([$signalGate->position_q, $signalGate->position_r])->toBe($portalStart);
});

test('admin users can insert a tile between neighboring tiles', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $portal = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $signalGate = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $signalGateStart = [$signalGate->position_q, $signalGate->position_r];
    $direction = [
        $signalGate->position_q - $portal->position_q,
        $signalGate->position_r - $portal->position_r,
    ];

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.insert', $portal), [
            'title' => 'Inserted Node',
            'description' => 'A tile inserted between two existing tiles.',
            'state' => 'available',
            'direction_q' => $direction[0],
            'direction_r' => $direction[1],
            'visual_config' => [
                'icon' => 'map',
                'label' => 'Inserted',
                'tileColor' => '#253047',
                'foregroundColor' => '#bfdbfe',
                'labelColor' => '#ffffff',
                'highlightColor' => '#7dd3fc',
                'tooltip' => 'Inserted from the edge control.',
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $portal->map));

    $insertedNode = LearningNode::query()->where('slug', 'inserted-node')->firstOrFail();
    $signalGate->refresh();

    expect([$insertedNode->position_q, $insertedNode->position_r])->toBe($signalGateStart)
        ->and([$signalGate->position_q, $signalGate->position_r])->toBe([
            $signalGateStart[0] + $direction[0],
            $signalGateStart[1] + $direction[1],
        ]);
});
