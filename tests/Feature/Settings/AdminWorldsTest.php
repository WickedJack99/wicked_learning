<?php

use App\Models\ActivityTransition;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerNodeDiscovery;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningTool;
use App\Models\NpcDialogueAnswer;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use App\Models\User;
use App\Models\UserPreference;
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
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('worldGraph.world.slug', 'demo-learning-world')
            ->has('worldGraph.maps', 2)
            ->has('worldGraph.portalCandidates', 5)
            ->has('worldGraph.portalLinks', 1)
            ->where('worldGraph.portalLinks.0.sourceNode.slug', 'portal-foundation')
            ->where('worldGraph.portalLinks.0.targetNode.slug', 'return-gate')
        );

    $this->actingAs($admin)
        ->get(route('settings.worlds.index'))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
        ]));
});

test('admin users can open world builder map configuration and node inside settings workspace', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'configure',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('selectedWorldMap.canDeleteWorldMaps', true)
            ->where('selectedWorldMap.editableMap.map.slug', 'first-sector')
            ->has('selectedWorldMap.learningGroups')
        );

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('selectedWorldMap.editableMap.map.slug', 'first-sector')
            ->where('selectedWorldNode.activityGraph.map.slug', 'first-sector')
            ->where('selectedWorldNode.activityGraph.node.slug', 'signal-gate')
            ->has('selectedWorldNode.activityGraph.activities', 6)
            ->where('selectedWorldNode.activityGraph.activities.1.slug', 'guided-signal-dialogue')
            ->where('selectedWorldNode.activityGraph.activities.1.type', 'npc_dialogue')
            ->has('selectedWorldNode.activityGraph.transitions', 6)
            ->has('selectedWorldNode.activityGraph.portalCandidates')
            ->has('selectedWorldNode.activityGraph.activityTypes')
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
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'nodes',
        ]));
});

test('admin users can open the full map configuration screen', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.worlds.maps.configure', $map))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'configure',
        ]));
});

test('admin users can delete map tiles and related authoring state', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $sourceNode = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $targetNode = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'temporary-tile',
        'title' => 'Temporary tile',
        'description' => 'This tile can be removed.',
        'position_q' => 4,
        'position_r' => 0,
        'state' => 'available',
        'visual_config' => [],
    ]);
    $sourceActivity = LearningActivity::query()->where('learning_node_id', $sourceNode->id)->firstOrFail();
    $targetActivity = LearningActivity::query()->create([
        'learning_node_id' => $targetNode->id,
        'slug' => 'temporary-activity',
        'title' => 'Temporary activity',
        'type' => 'reflection',
        'config' => [],
        'sort_order' => 10,
    ]);
    $transition = ActivityTransition::query()->create([
        'from_activity_id' => $sourceActivity->id,
        'to_activity_id' => $targetActivity->id,
        'from_connector' => 'completed',
        'to_connector' => 'in',
        'trigger' => 'completed',
    ]);

    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $targetNode->id,
        'learning_activity_id' => $targetActivity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now(),
        'completed_at' => now(),
    ]);

    $sourceNode->forceFill([
        'visual_config' => [
            'unlock' => [
                'requiredNodeIds' => [$targetNode->id],
                'rules' => [
                    'type' => 'group',
                    'operator' => 'and',
                    'rules' => [
                        [
                            'type' => 'node_completed',
                            'nodeId' => $targetNode->id,
                        ],
                    ],
                ],
            ],
        ],
    ])->save();

    $this->actingAs($admin)
        ->delete(route('settings.worlds.nodes.destroy', $targetNode))
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    expect(LearningNode::query()->whereKey($targetNode->id)->exists())->toBeFalse()
        ->and(LearningActivity::query()->whereKey($targetActivity->id)->exists())->toBeFalse()
        ->and(ActivityTransition::query()->whereKey($transition->id)->exists())->toBeFalse()
        ->and(LearnerActivityProgress::query()->where('learning_node_id', $targetNode->id)->exists())->toBeFalse();

    $sourceNode->refresh();

    expect($sourceNode->visual_config['unlock']['requiredNodeIds'])->toBe([])
        ->and($sourceNode->visual_config['unlock']['rules']['rules'])->toBe([]);
});

test('admin users can delete world maps and related map state', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();
    $deletedNode = LearningNode::query()
        ->where('learning_map_id', $map->id)
        ->where('slug', 'portal-foundation')
        ->firstOrFail();
    $externalNode = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();

    UserPreference::query()->create([
        'user_id' => $learner->id,
        'appearance' => 'dark',
        'settings' => [
            'learning' => [
                'lastMapId' => $map->id,
                'lastMapSlug' => $map->slug,
            ],
        ],
    ]);

    $externalNode->forceFill([
        'visual_config' => [
            'unlock' => [
                'requiredNodeIds' => [$deletedNode->id],
                'rules' => [
                    'type' => 'group',
                    'operator' => 'and',
                    'rules' => [
                        [
                            'type' => 'node_completed',
                            'nodeId' => $deletedNode->id,
                        ],
                    ],
                ],
            ],
        ],
    ])->save();

    $this->actingAs($admin)
        ->delete(route('settings.worlds.maps.destroy', $map))
        ->assertRedirect(route('settings.worlds.index'));

    $externalNode->refresh();
    $preference = $learner->refresh()->preference;

    expect(LearningMap::query()->whereKey($map->id)->exists())->toBeFalse()
        ->and(LearningNode::query()->where('learning_map_id', $map->id)->exists())->toBeFalse()
        ->and(LearningPortalLink::query()
            ->where('source_learning_node_id', $deletedNode->id)
            ->orWhere('target_learning_node_id', $deletedNode->id)
            ->exists())->toBeFalse()
        ->and($externalNode->visual_config['unlock']['requiredNodeIds'])->toBe([])
        ->and($externalNode->visual_config['unlock']['rules']['rules'])->toBe([])
        ->and($preference?->settings['learning']['lastMapId'] ?? null)->toBeNull()
        ->and($preference?->settings['learning']['lastMapSlug'] ?? null)->toBeNull();
});

test('admin users can manage map access permissions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedWorldMap.editableMap.map.accessRoles', [User::ROLE_USER, User::ROLE_ADMIN])
            ->where('selectedWorldMap.accessGroups.0.slug', 'public')
        );

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.access.update', $map), [
            'access_roles' => ['public', User::ROLE_ADMIN],
        ])
        ->assertRedirect(route('settings.index', [
            'map' => $map->id,
            'panel' => 'admin-world-builder',
            'worldView' => 'nodes',
        ]));

    $map->refresh();

    expect($map->access_roles)->toBe(['public', User::ROLE_ADMIN]);

    $this->app['auth']->forgetGuards();

    $this->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->has('world.maps', 1)
            ->where('world.maps.0.slug', 'first-sector')
        );

    $this->getJson(route('learning.search', ['query' => 'Quiet Library']))
        ->assertOk()
        ->assertJsonCount(0, 'results');
});

test('admin users can open the activity graph editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.worlds.nodes.activities.edit', $node))
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $node->map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]));
});

test('admin users can persist activity graph special node positions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.activities.layout.update', $node), [
            'node' => 'start',
            'position' => ['x' => -360, 'y' => 140],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $node->refresh();

    expect($node->activity_graph_layout['start'])->toBe([
        'x' => -360,
        'y' => 140,
    ]);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $node->map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedWorldNode.activityGraph.node.graphLayout.start.x', -360)
            ->where('selectedWorldNode.activityGraph.node.graphLayout.start.y', 140)
        );
});

test('admin users configure portal destinations from portal activities', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $sourceNode = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $targetActivity = LearningActivity::query()->where('slug', 'arrive-through-the-gate')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $sourceNode), [
            'title' => 'Open archive portal',
            'type' => 'portal',
            'portal_mode' => 'output',
            'portal_background_dark' => '/storage/learning/nodes/portal-dark.webp',
            'portal_background_light' => '/storage/learning/nodes/portal-light.webp',
            'portal_assets' => [
                [
                    'id' => 'destination-view',
                    'imageDark' => '/storage/learning/nodes/archive-dark.webp',
                    'imageLight' => '/storage/learning/nodes/archive-light.webp',
                    'label' => 'Destination view',
                    'layer' => 'above-background',
                    'mirrored' => true,
                    'opacity' => 82,
                    'width' => 48,
                    'x' => 56,
                    'y' => 42,
                ],
            ],
            'portal_bubble_text' => 'Before you lies an unexplored archive.',
            'portal_bubble_typing_speed' => 32,
            'portal_bubble_color_dark' => '#0f172a',
            'portal_bubble_color_light' => '#ffffff',
            'portal_bubble_border_color_dark' => '#8f64dd',
            'portal_bubble_border_color_light' => '#7c3aed',
            'portal_bubble_text_color_dark' => '#f8fafc',
            'portal_bubble_text_color_light' => '#111827',
            'portal_duration_seconds' => 2.5,
            'portal_foreground_dark' => '/storage/learning/nodes/swirl-dark.svg',
            'portal_foreground_light' => '/storage/learning/nodes/swirl-light.svg',
            'portal_foreground_width' => 36,
            'portal_foreground_x' => 42,
            'portal_foreground_y' => 58,
            'portal_show_on_arrival' => true,
            'portal_swirl_enabled' => false,
            'portal_wait_for_enter' => true,
            'target_portal_activity_id' => $targetActivity->id,
            'introduction' => 'Travel toward the archive.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $sourceNode));

    $activity = LearningActivity::query()->where('slug', 'open-archive-portal')->firstOrFail();
    $link = LearningPortalLink::query()
        ->where('source_learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($link->source_learning_node_id)->toBe($sourceNode->id)
        ->and($link->target_learning_node_id)->toBe($targetActivity->learning_node_id)
        ->and($link->target_learning_activity_id)->toBe($targetActivity->id);
    expect($activity->config['portalBackgroundDark'])->toBe('/storage/learning/nodes/portal-dark.webp')
        ->and($activity->config['portalBackgroundLight'])->toBe('/storage/learning/nodes/portal-light.webp')
        ->and($activity->config['portalAssets'][0]['id'])->toBe('destination-view')
        ->and($activity->config['portalAssets'][0]['imageDark'])->toBe('/storage/learning/nodes/archive-dark.webp')
        ->and($activity->config['portalAssets'][0]['imageLight'])->toBe('/storage/learning/nodes/archive-light.webp')
        ->and($activity->config['portalAssets'][0]['layer'])->toBe('above-background')
        ->and($activity->config['portalAssets'][0]['mirrored'])->toBeTrue()
        ->and((float) $activity->config['portalAssets'][0]['opacity'])->toBe(82.0)
        ->and((float) $activity->config['portalAssets'][0]['width'])->toBe(48.0)
        ->and((float) $activity->config['portalAssets'][0]['x'])->toBe(56.0)
        ->and((float) $activity->config['portalAssets'][0]['y'])->toBe(42.0)
        ->and($activity->config['portalBubbleText'])->toBe('Before you lies an unexplored archive.')
        ->and($activity->config['portalBubbleTypingSpeed'])->toBe(32)
        ->and($activity->config['portalBubbleColorDark'])->toBe('#0f172a')
        ->and($activity->config['portalBubbleColorLight'])->toBe('#ffffff')
        ->and($activity->config['portalBubbleBorderColorDark'])->toBe('#8f64dd')
        ->and($activity->config['portalBubbleBorderColorLight'])->toBe('#7c3aed')
        ->and($activity->config['portalBubbleTextColorDark'])->toBe('#f8fafc')
        ->and($activity->config['portalBubbleTextColorLight'])->toBe('#111827')
        ->and($activity->config['portalDurationSeconds'])->toBe(2.5)
        ->and($activity->config['portalForegroundDark'])->toBe('/storage/learning/nodes/swirl-dark.svg')
        ->and($activity->config['portalForegroundLight'])->toBe('/storage/learning/nodes/swirl-light.svg')
        ->and((float) $activity->config['portalForegroundWidth'])->toBe(36.0)
        ->and($activity->config['portalForegroundX'])->toBe(42)
        ->and($activity->config['portalForegroundY'])->toBe(58)
        ->and($activity->config['portalShowOnArrival'])->toBeTrue()
        ->and($activity->config['portalSwirlEnabled'])->toBeFalse()
        ->and($activity->config['portalWaitForEnter'])->toBeTrue();

    $targetActivity->forceFill([
        'config' => [
            ...($targetActivity->config ?? []),
            'portalBackgroundLight' => '/storage/learning/nodes/old-exit-light.webp',
            'portalForegroundLight' => '/storage/learning/nodes/old-exit-swirl.svg',
        ],
    ])->save();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $targetActivity), [
            'title' => $targetActivity->title,
            'slug' => $targetActivity->slug,
            'type' => 'portal',
            'introduction' => 'Arrive back through the gate.',
            'portal_mode' => 'input',
            'portal_background_dark' => '/storage/learning/nodes/exit-dark.webp',
            'portal_background_light' => '',
            'portal_background_mirrored' => true,
            'portal_assets' => [
                [
                    'id' => 'arrival-mist',
                    'imageDark' => '/storage/learning/nodes/mist-dark.webp',
                    'imageLight' => '',
                    'label' => 'Arrival mist',
                    'layer' => 'front',
                    'mirrored' => false,
                    'opacity' => 64,
                    'width' => 72,
                    'x' => 50,
                    'y' => 60,
                ],
            ],
            'portal_duration_seconds' => 4,
            'portal_foreground_dark' => '/storage/learning/nodes/exit-swirl.svg',
            'portal_foreground_light' => '',
            'portal_foreground_mirrored' => true,
            'portal_foreground_width' => 44,
            'portal_foreground_x' => 46,
            'portal_foreground_y' => 54,
            'portal_show_on_arrival' => false,
            'portal_swirl_enabled' => true,
            'portal_wait_for_enter' => false,
            'target_portal_activity_id' => '',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $targetActivity->node));

    $targetActivity->refresh();

    expect($targetActivity->config['portalMode'])->toBe('input')
        ->and($targetActivity->config['portalBackgroundDark'])->toBe('/storage/learning/nodes/exit-dark.webp')
        ->and($targetActivity->config['portalBackgroundLight'])->toBe('')
        ->and($targetActivity->config['portalBackgroundMirrored'])->toBeTrue()
        ->and($targetActivity->config['portalAssets'][0]['id'])->toBe('arrival-mist')
        ->and($targetActivity->config['portalAssets'][0]['layer'])->toBe('front')
        ->and((float) $targetActivity->config['portalAssets'][0]['opacity'])->toBe(64.0)
        ->and((float) $targetActivity->config['portalDurationSeconds'])->toBe(4.0)
        ->and($targetActivity->config['portalForegroundDark'])->toBe('/storage/learning/nodes/exit-swirl.svg')
        ->and($targetActivity->config['portalForegroundLight'])->toBe('')
        ->and($targetActivity->config['portalForegroundMirrored'])->toBeTrue()
        ->and((float) $targetActivity->config['portalForegroundWidth'])->toBe(44.0)
        ->and($targetActivity->config['portalForegroundX'])->toBe(46)
        ->and($targetActivity->config['portalForegroundY'])->toBe(54)
        ->and($targetActivity->config['portalShowOnArrival'])->toBeFalse()
        ->and($targetActivity->config['portalSwirlEnabled'])->toBeTrue()
        ->and($targetActivity->config['portalWaitForEnter'])->toBeFalse();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $sourceNode->map->id,
            'node' => $sourceNode->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('selectedWorldNode.activityGraph.portalCandidates')
        );
});

test('admin users can update obstacle activity images', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $activity = LearningActivity::query()
        ->where('slug', 'clear-the-noisy-gate')
        ->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'obstacle_background_dark' => '/storage/learning/nodes/mineshaft-dark.svg',
            'obstacle_background_light' => '/storage/learning/nodes/mineshaft-light.svg',
            'obstacle_image_dark' => '/storage/learning/nodes/rock-wall-dark.svg',
            'obstacle_image_light' => '/storage/learning/nodes/rock-wall-light.svg',
            'obstacle_x' => 23,
            'obstacle_y' => 64,
            'obstacle_width' => 12,
            'obstacle_revisit_background_dark' => '/storage/learning/nodes/cleared-mineshaft-dark.svg',
            'obstacle_revisit_background_light' => '/storage/learning/nodes/cleared-mineshaft-light.svg',
            'obstacle_revisit_image_dark' => '/storage/learning/nodes/cleared-rock-dark.svg',
            'obstacle_revisit_image_light' => '/storage/learning/nodes/cleared-rock-light.svg',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $activity->node));

    $activity->refresh();

    expect($activity->config['backgroundDark'])->toBe('/storage/learning/nodes/mineshaft-dark.svg')
        ->and($activity->config['backgroundLight'])->toBe('/storage/learning/nodes/mineshaft-light.svg')
        ->and($activity->config['obstacleImageDark'])->toBe('/storage/learning/nodes/rock-wall-dark.svg')
        ->and($activity->config['obstacleImageLight'])->toBe('/storage/learning/nodes/rock-wall-light.svg')
        ->and($activity->config['obstacleX'])->toBe(23)
        ->and($activity->config['obstacleY'])->toBe(64)
        ->and($activity->config['obstacleWidth'])->toBe(12)
        ->and($activity->config['revisitBackgroundDark'])->toBe('/storage/learning/nodes/cleared-mineshaft-dark.svg')
        ->and($activity->config['revisitBackgroundLight'])->toBe('/storage/learning/nodes/cleared-mineshaft-light.svg')
        ->and($activity->config['revisitImageDark'])->toBe('/storage/learning/nodes/cleared-rock-dark.svg')
        ->and($activity->config['revisitImageLight'])->toBe('/storage/learning/nodes/cleared-rock-light.svg');
});

test('admin users can create markdown page graph activities', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Read the briefing',
            'type' => 'markdown',
            'introduction' => 'A small page route.',
            'markdown_pages' => [
                [
                    'id' => 'page-a',
                    'title' => 'Briefing',
                    'body' => "# Briefing\n\n![Diagram](/storage/learning/nodes/diagram.svg)",
                    'position' => ['x' => 160, 'y' => 90],
                    'visual' => [
                        'pageColorDark' => '#0f172a',
                        'pageColorLight' => '#ffffff',
                        'borderColorDark' => '#2dd4bf',
                        'borderColorLight' => '#0891b2',
                        'headingColorDark' => '#67e8f9',
                        'headingColorLight' => '#0e7490',
                        'textColorDark' => '#f8fafc',
                        'textColorLight' => '#0f172a',
                    ],
                ],
            ],
            'markdown_transitions' => [
                ['id' => 'start-a', 'from' => 'start', 'to' => 'page-a'],
                ['id' => 'a-end', 'from' => 'page-a', 'to' => 'end'],
            ],
            'markdown_graph_layout' => [
                'start' => ['x' => -240, 'y' => 120],
                'end' => ['x' => 620, 'y' => 130],
            ],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'read-the-briefing')
        ->firstOrFail();

    expect($activity->type)->toBe('markdown')
        ->and($activity->config['markdownPages'][0]['title'])->toBe('Briefing')
        ->and($activity->config['markdownPages'][0]['body'])->toContain('![Diagram]')
        ->and($activity->config['markdownPages'][0]['visual']['borderColorDark'])->toBe('#2dd4bf')
        ->and($activity->config['markdownPages'][0]['visual']['headingColorDark'])->toBe('#67e8f9')
        ->and($activity->config['markdownTransitions'][0]['from'])->toBe('start')
        ->and($activity->config['markdownTransitions'][1]['to'])->toBe('end')
        ->and($activity->config['markdownGraphLayout']['start'])->toBe([
            'x' => -240,
            'y' => 120,
        ]);
});

test('admin users can open and save the markdown page editor', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'markdown-route',
        'title' => 'Markdown route',
        'type' => 'markdown',
        'config' => [
            'markdownPages' => [
                [
                    'id' => 'page-a',
                    'title' => 'Old page',
                    'body' => 'Old text',
                    'position' => ['x' => 100, 'y' => 80],
                    'visual' => [
                        'pageColorDark' => '#0f172a',
                        'pageColorLight' => '#ffffff',
                        'borderColorDark' => '#2dd4bf',
                        'borderColorLight' => '#0891b2',
                        'headingColorDark' => '#67e8f9',
                        'headingColorLight' => '#0e7490',
                        'textColorDark' => '#f8fafc',
                        'textColorLight' => '#0f172a',
                    ],
                ],
            ],
            'markdownTransitions' => [
                ['id' => 'start-a', 'from' => 'start', 'to' => 'page-a'],
                ['id' => 'a-end', 'from' => 'page-a', 'to' => 'end'],
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->get(route('settings.worlds.activities.markdown.edit', $activity))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/worlds/edit-markdown-activity')
            ->where('markdownActivity.node.slug', 'field-notes')
            ->where('markdownActivity.activity.slug', 'markdown-route')
            ->where('markdownActivity.activity.config.markdownPages.0.title', 'Old page')
        );

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'title' => 'Markdown route',
            'type' => 'markdown',
            'return_to_markdown' => true,
            'markdown_pages' => [
                [
                    'id' => 'page-a',
                    'title' => 'Updated page',
                    'body' => "# Updated\n\n![Video](/storage/learning/nodes/intro.webm)",
                    'position' => ['x' => 140, 'y' => 120],
                    'visual' => [
                        'pageColorDark' => '#111827',
                        'pageColorLight' => '#f8fafc',
                        'borderColorDark' => '#22d3ee',
                        'borderColorLight' => '#0284c7',
                        'headingColorDark' => '#a5f3fc',
                        'headingColorLight' => '#0369a1',
                        'textColorDark' => '#f9fafb',
                        'textColorLight' => '#111827',
                    ],
                ],
            ],
            'markdown_transitions' => [
                ['id' => 'start-a', 'from' => 'start', 'to' => 'page-a'],
                ['id' => 'a-end', 'from' => 'page-a', 'to' => 'end'],
            ],
            'markdown_graph_layout' => [
                'start' => ['x' => -320, 'y' => 110],
                'end' => ['x' => 680, 'y' => 110],
            ],
        ])
        ->assertRedirect(route('settings.worlds.activities.markdown.edit', $activity));

    $activity->refresh();

    expect($activity->config['markdownPages'][0]['title'])->toBe('Updated page')
        ->and($activity->config['markdownPages'][0]['body'])->toContain('intro.webm')
        ->and($activity->config['markdownPages'][0]['visual']['headingColorLight'])->toBe('#0369a1')
        ->and($activity->config['markdownGraphLayout']['end'])->toBe([
            'x' => 680,
            'y' => 110,
        ]);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.graph-layout.update', $activity), [
            'node' => 'start',
            'position' => ['x' => -420, 'y' => 160],
        ])
        ->assertRedirect(route('settings.worlds.activities.markdown.edit', $activity));

    $activity->refresh();

    expect($activity->config['markdownGraphLayout']['start'])->toBe([
        'x' => -420,
        'y' => 160,
    ]);
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
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $activity->id,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect(LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_id', $activity->id)
        ->exists())->toBeTrue();

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

test('admin users can author npc dialogue activity graphs', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'title' => 'Meet the Archivist',
            'type' => 'npc_dialogue',
            'introduction' => 'A branching conversation with an archivist.',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'meet-the-archivist')
        ->firstOrFail();
    $endNode = NpcDialogueNode::query()
        ->where('learning_activity_id', $activity->id)
        ->where('type', 'end')
        ->firstOrFail();

    expect($endNode->config['connectorSymbol'])->toBe('A')
        ->and($endNode->config['connectorColor'])->toBe('#0ea5e9');

    $this->actingAs($admin)
        ->get(route('settings.worlds.activities.npc-dialogue.edit', $activity))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/worlds/edit-npc-dialogue')
            ->where('dialogueGraph.activity.slug', 'meet-the-archivist')
            ->has('dialogueGraph.dialogueNodes', 1)
        );

    $this->actingAs($admin)
        ->post(route('settings.worlds.activities.npc-dialogue.nodes.store', $activity), [
            'body' => 'Welcome to the archive. Let us follow the useful trace.',
            'config' => [
                'backgroundDark' => '/storage/learning/dialogue/archive-dark.webp',
                'bubbleColorDark' => '#0f172a',
                'npcX' => 48,
                'typingSpeed' => 24,
            ],
            'title' => 'Archivist greeting',
            'type' => 'npc_monologue',
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $interaction = NpcDialogueNode::query()
        ->where('learning_activity_id', $activity->id)
        ->where('type', 'npc_monologue')
        ->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.activities.npc-dialogue.transitions.store', $activity), [
            'from_connector' => 'start',
            'from_dialogue_node_id' => null,
            'to_connector' => 'in',
            'to_dialogue_node_id' => $interaction->id,
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $this->actingAs($admin)
        ->post(route('settings.worlds.activities.npc-dialogue.transitions.store', $activity), [
            'from_connector' => 'out',
            'from_dialogue_node_id' => $interaction->id,
            'to_connector' => 'in',
            'to_dialogue_node_id' => $endNode->id,
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    expect(NpcDialogueTransition::query()
        ->where('learning_activity_id', $activity->id)
        ->count())->toBe(2);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.npc-dialogue-nodes.update', $endNode), [
            'config' => [
                'connectorColor' => '#ef4444',
                'connectorSymbol' => 'Z',
            ],
            'title' => 'Needs review',
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $endNode->refresh();

    expect($endNode->title)->toBe('Needs review')
        ->and($endNode->config['connectorColor'])->toBe('#ef4444')
        ->and($endNode->config['connectorSymbol'])->toBe('Z');

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.graph-layout.update', $activity), [
            'node' => 'start',
            'position' => ['x' => -300, 'y' => 140],
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $activity->refresh();

    expect($activity->config['dialogueGraphLayout']['start'])->toBe([
        'x' => -300,
        'y' => 140,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activity-transitions.store', $node), [
            'from_activity_id' => $activity->id,
            'from_connector' => 'dialogue-end-'.$endNode->id,
            'to_activity_id' => null,
            'to_connector' => 'end',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->transitions()->where('from_connector', 'dialogue-end-'.$endNode->id)->exists())->toBeTrue();
});

test('learners can answer npc dialogue questions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $learner = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'spot-the-signal',
        'type' => 'npc_dialogue',
        'title' => 'Spot the Signal',
        'introduction' => 'A small dialogue question.',
        'sort_order' => 20,
        'config' => [],
    ]);
    $questionNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_question',
        'title' => 'Mira',
        'body' => 'Which observation is useful?',
        'config' => [
            'questionOutputCount' => 2,
        ],
    ]);
    $guessAnswer = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'answer',
        'title' => 'Guess',
        'body' => 'A dramatic guess.',
        'config' => [
            'answerLabel' => 'A',
            'isCorrect' => false,
        ],
    ]);
    $patternAnswer = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'answer',
        'title' => 'Pattern',
        'body' => 'A repeated event pattern.',
        'config' => [
            'answerLabel' => 'B',
            'isCorrect' => true,
        ],
    ]);
    NpcDialogueTransition::query()->create([
        'learning_activity_id' => $activity->id,
        'from_dialogue_node_id' => $questionNode->id,
        'to_dialogue_node_id' => $guessAnswer->id,
        'from_connector' => 'answer-1',
        'to_connector' => 'in',
    ]);
    NpcDialogueTransition::query()->create([
        'learning_activity_id' => $activity->id,
        'from_dialogue_node_id' => $questionNode->id,
        'to_dialogue_node_id' => $patternAnswer->id,
        'from_connector' => 'answer-2',
        'to_connector' => 'in',
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.npc-dialogue-nodes.answer', $questionNode), [
            'answer_key' => (string) $patternAnswer->id,
        ])
        ->assertOk()
        ->assertJsonPath('answer.answerKey', (string) $patternAnswer->id)
        ->assertJsonPath('answer.answerNodeId', $patternAnswer->id)
        ->assertJsonPath('answer.isCorrect', true)
        ->assertJsonPath('answer.feedback', null);

    expect(NpcDialogueAnswer::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->where('npc_dialogue_node_id', $questionNode->id)
        ->where('answer_key', (string) $patternAnswer->id)
        ->where('is_correct', true)
        ->exists())->toBeTrue();
});

test('admin users can configure multiple independent start routes for a node', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $easyRoute = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'easy-field-route',
        'type' => 'placeholder',
        'title' => 'Easy field route',
        'sort_order' => 100,
    ]);
    $hardRoute = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'hard-field-route',
        'type' => 'placeholder',
        'title' => 'Hard field route',
        'sort_order' => 110,
    ]);
    $exitPortal = LearningActivity::query()->create([
        'config' => ['portalMode' => 'input'],
        'learning_node_id' => $node->id,
        'slug' => 'exit-field-route',
        'type' => 'portal',
        'title' => 'Exit field route',
        'sort_order' => 120,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $exitPortal->id,
        ])
        ->assertSessionHasErrors('activity_id');

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $easyRoute->id,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.start.update', $node), [
            'activity_id' => $hardRoute->id,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect(LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->pluck('learning_activity_id')
        ->all())->toContain($easyRoute->id, $hardRoute->id)
        ->not->toContain($exitPortal->id);

    LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $exitPortal->id,
        'label' => null,
        'sort_order' => 120,
    ]);

    $easyStart = LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_id', $easyRoute->id)
        ->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activity-starts.update', $easyStart), [
            'button_border_color_dark' => '#334155',
            'button_border_color_light' => '#e2e8f0',
            'button_color_dark' => '#0f172a',
            'button_color_light' => '#ffffff',
            'image_dark' => '/images/routes/easy-dark.svg',
            'image_light' => '/images/routes/easy-light.svg',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $easyStart->refresh();

    expect($easyStart->button_border_color_dark)->toBe('#334155')
        ->and($easyStart->button_border_color_light)->toBe('#e2e8f0')
        ->and($easyStart->button_color_dark)->toBe('#0f172a')
        ->and($easyStart->button_color_light)->toBe('#ffffff')
        ->and($easyStart->image_dark)->toBe('/images/routes/easy-dark.svg')
        ->and($easyStart->image_light)->toBe('/images/routes/easy-light.svg');

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $node->map->id,
            'node' => $node->id,
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('selectedWorldNode.activityGraph.node.startRoutes', 3)
            ->where('selectedWorldNode.activityGraph.node.startRoutes.1.buttonColorDark', '#0f172a')
            ->where('selectedWorldNode.activityGraph.node.startRoutes.1.buttonBorderColorLight', '#e2e8f0')
            ->where('selectedWorldNode.activityGraph.node.startRoutes.1.imageDark', '/images/routes/easy-dark.svg')
        );

    $this->actingAs($admin)
        ->delete(route('settings.worlds.activity-starts.destroy', $easyStart))
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect(LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_id', $easyRoute->id)
        ->exists())->toBeFalse()
        ->and(LearningActivityStart::query()
            ->where('learning_node_id', $node->id)
            ->where('learning_activity_id', $hardRoute->id)
            ->exists())->toBeTrue();
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
                'label' => 'Practice',
                'tooltip' => 'Created from the admin editor.',
                'dark' => [
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                ],
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
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
                'label' => 'First Tile',
                'tooltip' => 'Starting tile for this map.',
                'dark' => [
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                ],
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
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
            'title' => 'Pattern Gate Revised',
            'slug' => 'signal-gate',
            'description' => 'Updated from the admin editor.',
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'available',
            'visual_config' => [
                'label' => 'Pattern Gate',
                'hideImage' => true,
                'hideLabel' => true,
                'tooltip' => 'Edited tile.',
                'dark' => [
                    'tileColor' => '#082f49',
                    'foregroundColor' => '#bae6fd',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#38bdf8',
                    'imageUrl' => '/storage/learning/nodes/dark.svg',
                ],
                'light' => [
                    'tileColor' => '#e0f2fe',
                    'foregroundColor' => '#0369a1',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#0284c7',
                    'imageUrl' => '/storage/learning/nodes/light.svg',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    $node->refresh();

    expect($node->title)->toBe('Pattern Gate Revised')
        ->and($node->description)->toBe('Updated from the admin editor.')
        ->and($node->visual_config['hideImage'])->toBeTrue()
        ->and($node->visual_config['hideLabel'])->toBeTrue()
        ->and($node->visual_config['tooltip'])->toBe('Edited tile.')
        ->and($node->visual_config['dark']['imageUrl'])->toBe('/storage/learning/nodes/dark.svg')
        ->and($node->visual_config['light']['tileColor'])->toBe('#e0f2fe');
});

test('admin users can configure a tile to be revealed by a tool', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $tool = LearningTool::query()->create([
        'slug' => 'survey-scanner',
        'title' => 'Survey scanner',
    ]);
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.nodes.update', $node), [
            'title' => $node->title,
            'slug' => $node->slug,
            'description' => $node->description,
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'hidden',
            'visual_config' => [
                'label' => 'Pattern Gate',
                'reveal' => [
                    'enabled' => true,
                    'toolId' => $tool->id,
                ],
                'dark' => [
                    'tileColor' => '#082f49',
                    'foregroundColor' => '#bae6fd',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#38bdf8',
                ],
                'light' => [
                    'tileColor' => '#e0f2fe',
                    'foregroundColor' => '#0369a1',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#0284c7',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    $node->refresh();

    expect($node->state)->toBe('hidden')
        ->and($node->visual_config['reveal']['enabled'])->toBeTrue()
        ->and((int) $node->visual_config['reveal']['toolId'])->toBe($tool->id);
});

test('admin users can reset node tool unlocks for all learners', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();

    $discovery = LearnerNodeDiscovery::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'discovered_at' => now(),
        'metadata' => [
            'source' => 'test',
            'unlock' => [
                'source' => 'world-map-lock-tool',
                'toolId' => 42,
                'unlockedAt' => now()->toIso8601String(),
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.unlocks.reset', $node))
        ->assertRedirect(route('settings.worlds.maps.edit', $node->map));

    $discovery->refresh();

    expect($discovery->metadata)->toBe([
        'source' => 'test',
    ]);
});

test('admin users can edit map details', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'title' => 'First Clearing',
            'description' => 'A quiet learning landscape for active practice.',
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    $map->refresh();

    expect($map->title)->toBe('First Clearing')
        ->and($map->description)->toBe('A quiet learning landscape for active practice.');

    $workspaceUrl = route('settings.index', [
        'panel' => 'admin-world-builder',
        'map' => $map->id,
        'worldView' => 'configure',
    ]);

    $this->actingAs($admin)
        ->from($workspaceUrl)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'title' => 'First Clearing',
            'description' => 'Still inside the settings workspace.',
        ])
        ->assertRedirect($workspaceUrl);
});

test('admin users can edit map visual theme variants', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $map = LearningMap::query()->where('slug', 'first-sector')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.update', $map), [
            'background_config' => [
                'dark' => [
                    'imageUrl' => '/storage/learning/maps/dark.webp',
                    'overlay' => 'rgba(1, 8, 14, 0.72)',
                    'pageBackground' => '#020617',
                    'panelBackground' => 'rgba(8, 17, 26, 0.78)',
                    'panelBorderColor' => 'rgba(226, 232, 240, 0.12)',
                    'panelTextColor' => '#f8fafc',
                    'panelMutedTextColor' => 'rgba(226, 232, 240, 0.82)',
                    'accentColor' => '#5eead4',
                    'sidePanelBackground' => '#111820',
                    'sidePanelBorderColor' => 'rgba(255, 255, 255, 0.1)',
                    'sidePanelTextColor' => '#f8fafc',
                    'sidePanelMutedTextColor' => 'rgba(226, 232, 240, 0.72)',
                    'bottomNavBackground' => 'rgba(8, 17, 26, 0.78)',
                    'bottomNavBorderColor' => 'rgba(226, 232, 240, 0.12)',
                    'bottomNavIconColor' => '#cbd5e1',
                    'bottomNavTextColor' => '#e2e8f0',
                    'bottomNavActiveBackground' => '#5eead4',
                    'bottomNavActiveIconColor' => '#020617',
                    'bottomNavActiveTextColor' => '#020617',
                    'bottomNavExitIconColor' => '#ef4444',
                    'sideControlBackground' => 'rgba(8, 17, 26, 0.78)',
                    'sideControlBorderColor' => 'rgba(226, 232, 240, 0.12)',
                    'sideControlIconColor' => '#cbd5e1',
                    'sideControlTextColor' => '#e2e8f0',
                    'sideControlActiveBackground' => '#5eead4',
                    'sideControlActiveIconColor' => '#020617',
                    'sideControlActiveTextColor' => '#020617',
                    'assets' => [
                        [
                            'id' => 'moon',
                            'imageUrl' => '/images/map-assets/moon.png',
                            'x' => 72,
                            'y' => 18,
                            'width' => 16,
                            'opacity' => 82,
                        ],
                    ],
                ],
                'light' => [
                    'imageUrl' => '/storage/learning/maps/light.webp',
                    'overlay' => 'rgba(240, 253, 250, 0.74)',
                    'pageBackground' => '#ecfeff',
                    'panelTextColor' => '#0f172a',
                    'accentColor' => '#0e7490',
                ],
            ],
        ])
        ->assertRedirect(route('settings.worlds.maps.edit', $map));

    $map->refresh();

    expect($map->background_config)->not->toHaveKey('imageUrl')
        ->and($map->background_config['dark']['imageUrl'])->toBe('/storage/learning/maps/dark.webp')
        ->and($map->background_config['dark']['panelBorderColor'])->toBe('rgba(226, 232, 240, 0.12)')
        ->and($map->background_config['dark']['bottomNavBackground'])->toBe('rgba(8, 17, 26, 0.78)')
        ->and($map->background_config['dark']['bottomNavIconColor'])->toBe('#cbd5e1')
        ->and($map->background_config['dark']['bottomNavActiveIconColor'])->toBe('#020617')
        ->and($map->background_config['dark']['bottomNavExitIconColor'])->toBe('#ef4444')
        ->and($map->background_config['dark']['sideControlBackground'])->toBe('rgba(8, 17, 26, 0.78)')
        ->and($map->background_config['dark']['sideControlIconColor'])->toBe('#cbd5e1')
        ->and($map->background_config['dark']['sideControlActiveIconColor'])->toBe('#020617')
        ->and($map->background_config['dark']['assets'][0]['imageUrl'])->toBe('/images/map-assets/moon.png')
        ->and($map->background_config['light']['pageBackground'])->toBe('#ecfeff');
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
                'label' => 'Inserted',
                'tooltip' => 'Inserted from the edge control.',
                'dark' => [
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                ],
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
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
