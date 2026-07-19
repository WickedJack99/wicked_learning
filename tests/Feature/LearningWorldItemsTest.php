<?php

use App\Learning\Services\ItemGrantActivityConfiguration;
use App\Models\ActivityTransition;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningItem;
use App\Models\LearningNode;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;

test('item grant activity configuration stores themed backgrounds', function () {
    $config = app(ItemGrantActivityConfiguration::class)->fromData([
        'item_grant_background_dark' => '/storage/learning/items/grant-dark.webp',
        'item_grant_background_light' => '/storage/learning/items/grant-light.webp',
        'item_grant_items' => [
            ['itemId' => 12, 'quantity' => 3],
        ],
        'item_grant_probability_percent' => 72.5,
    ]);

    expect($config['backgroundDark'])->toBe('/storage/learning/items/grant-dark.webp')
        ->and($config['backgroundLight'])->toBe('/storage/learning/items/grant-light.webp')
        ->and($config['items'])->toBe([
            ['itemId' => 12, 'quantity' => 3],
        ])
        ->and($config['probabilityPercent'])->toBe(72.5);
});

test('item grant activities persist the roll and do not grant repeatedly', function () {
    $learner = User::factory()->create([
        'email' => 'items@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'portal-key',
        'title' => 'Portal key',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'receive-portal-key',
        'type' => 'item_grant',
        'title' => 'Receive portal key',
        'config' => [
            'items' => [
                ['itemId' => $item->id, 'quantity' => 2],
            ],
            'probabilityPercent' => 100,
        ],
        'sort_order' => 110,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity))
        ->assertOk()
        ->assertJsonPath('result.success', true)
        ->assertJsonPath('inventory.0.quantity', 2);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity))
        ->assertOk()
        ->assertJsonPath('result.success', true)
        ->assertJsonPath('inventory.0.quantity', 2);

    $progress = LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($progress->metadata['itemGrant']['rolledAt'] ?? null)->toBeString()
        ->and($learner->learningItems()->whereKey($item->id)->first()?->pivot->quantity)->toBe(2);
});

test('item grant activities reuse existing progress rows', function () {
    $learner = User::factory()->create([
        'email' => 'reached-items@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'reached-portal-key',
        'title' => 'Reached portal key',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'reached-receive-portal-key',
        'type' => 'item_grant',
        'title' => 'Reached receive portal key',
        'config' => [
            'items' => [
                ['itemId' => $item->id, 'quantity' => 3],
            ],
            'probabilityPercent' => 100,
        ],
        'sort_order' => 112,
    ]);

    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'status' => 'reached',
        'attempt_count' => 1,
        'reached_at' => now(),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity))
        ->assertOk()
        ->assertJsonPath('result.success', true)
        ->assertJsonPath('inventory.0.quantity', 3);

    expect(LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->count())->toBe(1);

    $progress = LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($progress->status)->toBe('completed')
        ->and($progress->metadata['itemGrant']['inventoryAppliedAt'] ?? null)->toBeString();
});

test('stored successful item grants reconcile missing inventory once', function () {
    $learner = User::factory()->create([
        'email' => 'stored-items@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'stored-portal-key',
        'title' => 'Stored portal key',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'stored-receive-portal-key',
        'type' => 'item_grant',
        'title' => 'Stored receive portal key',
        'config' => [
            'items' => [
                ['itemId' => $item->id, 'quantity' => 2],
            ],
            'probabilityPercent' => 100,
        ],
        'sort_order' => 115,
    ]);

    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now(),
        'completed_at' => now(),
        'metadata' => [
            'itemGrant' => [
                'rolledAt' => now()->toIso8601String(),
                'roll' => 1,
                'chanceBasisPoints' => 10000,
                'success' => true,
                'items' => [
                    ['itemId' => $item->id, 'quantity' => 2],
                ],
                'grantedItemIds' => [$item->id],
            ],
        ],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity))
        ->assertOk()
        ->assertJsonPath('result.success', true)
        ->assertJsonPath('inventory.0.quantity', 2);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity))
        ->assertOk()
        ->assertJsonPath('inventory.0.quantity', 2);

    $progress = LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($progress->metadata['itemGrant']['inventoryAppliedAt'] ?? null)->toBeString()
        ->and($learner->learningItems()->whereKey($item->id)->first()?->pivot->quantity)->toBe(2);
});

test('item grant activities can grant again on a new play run', function () {
    $learner = User::factory()->create([
        'email' => 'replay-items@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'replay-portal-key',
        'title' => 'Replay portal key',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'replay-receive-portal-key',
        'type' => 'item_grant',
        'title' => 'Replay receive portal key',
        'config' => [
            'items' => [
                ['itemId' => $item->id, 'quantity' => 1],
            ],
            'probabilityPercent' => 100,
        ],
        'sort_order' => 116,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Replay route',
        'sort_order' => 200,
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $activity->id,
            'node' => $node,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));

    $firstRunId = currentPlayRunId($learner, $node, $start);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity), [
            'play_run_id' => $firstRunId,
        ])
        ->assertOk()
        ->assertJsonPath('inventory.0.quantity', 1);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity), [
            'play_run_id' => $firstRunId,
        ])
        ->assertOk()
        ->assertJsonPath('inventory.0.quantity', 1);

    $resetUrl = $this->actingAs($learner)
        ->postJson(route('learning.activity-starts.reset', $start))
        ->assertOk()
        ->json('url');

    $secondRunId = currentPlayRunId($learner, $node, $start);

    $this->actingAs($learner)
        ->get($resetUrl)
        ->assertOk();

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $activity->id,
            'node' => $node,
            'route' => $start->id,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));

    $resumedRunId = currentPlayRunId($learner, $node, $start);

    expect($resumedRunId)->toBe($secondRunId);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity), [
            'play_run_id' => $secondRunId,
        ])
        ->assertOk()
        ->assertJsonPath('inventory.0.quantity', 2);

    expect($firstRunId)->not->toBe($secondRunId)
        ->and($learner->learningItems()->whereKey($item->id)->first()?->pivot->quantity)->toBe(2);
});

test('item grant activities can grant again after a selected terminal transition completes the route', function () {
    $learner = User::factory()->create([
        'email' => 'terminal-replay-items@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'terminal-portal-key',
        'title' => 'Terminal portal key',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'terminal-replay-grant',
        'type' => 'item_grant',
        'title' => 'Terminal replay grant',
        'config' => [
            'items' => [
                ['itemId' => $item->id, 'quantity' => 1],
            ],
            'probabilityPercent' => 100,
        ],
        'sort_order' => 117,
    ]);
    $alternate = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'terminal-replay-alternate',
        'type' => 'markdown',
        'title' => 'Alternate branch',
        'config' => [],
        'sort_order' => 118,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Terminal replay route',
        'sort_order' => 201,
    ]);

    ActivityTransition::query()->create([
        'from_activity_id' => $activity->id,
        'to_activity_id' => null,
        'from_connector' => 'completed',
        'label' => 'Finish route',
        'trigger' => 'completed',
    ]);
    ActivityTransition::query()->create([
        'from_activity_id' => $activity->id,
        'to_activity_id' => $alternate->id,
        'from_connector' => 'alternate',
        'to_connector' => 'input',
        'label' => 'Continue elsewhere',
        'trigger' => 'completed',
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $activity->id,
            'node' => $node,
            'route' => $start->id,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));

    $firstRunId = currentPlayRunId($learner, $node, $start);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity), [
            'play_run_id' => $firstRunId,
        ])
        ->assertOk()
        ->assertJsonPath('inventory.0.quantity', 1);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'play_run_id' => $firstRunId,
            'status' => 'completed',
        ])
        ->assertOk();

    $routeProgress = LearnerRouteProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_start_id', $start->id)
        ->firstOrFail();

    expect($routeProgress->status)->toBe('in_progress');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'ends_route' => true,
            'play_run_id' => $firstRunId,
            'status' => 'completed',
        ])
        ->assertOk();

    $routeProgress->refresh();

    expect($routeProgress->status)->toBe('completed')
        ->and($routeProgress->completion_count)->toBe(1);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $activity->id,
            'node' => $node,
            'route' => $start->id,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));

    $secondRunId = currentPlayRunId($learner, $node, $start);

    expect($secondRunId)->not->toBe($firstRunId);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity), [
            'play_run_id' => $secondRunId,
        ])
        ->assertOk()
        ->assertJsonPath('inventory.0.quantity', 2);

    expect($learner->learningItems()->whereKey($item->id)->first()?->pivot->quantity)->toBe(2);
});

test('play route refresh redirects stale activity query to saved current activity', function () {
    $learner = User::factory()->create([
        'email' => 'route-refresh@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $firstActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'refresh-start',
        'type' => 'dialogue',
        'title' => 'Refresh start',
        'config' => [],
        'sort_order' => 220,
    ]);
    $currentActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'refresh-current',
        'type' => 'reflection',
        'title' => 'Refresh current',
        'config' => [],
        'sort_order' => 230,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $firstActivity->id,
        'label' => 'Refresh route',
        'sort_order' => 230,
    ]);
    $runId = '11111111-1111-4111-8111-111111111111';

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $firstActivity->id,
        'current_learning_activity_id' => $currentActivity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
        'started_at' => now(),
        'last_entered_at' => now(),
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $firstActivity->id,
            'node' => $node,
            'route' => $start->id,
            'run' => $runId,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', ['node' => $node]))
        ->assertInertia(fn ($page) => $page
            ->component('learning/node-play')
            ->where('playActivityId', $currentActivity->id));
});

test('marking a later activity as reached updates route resume state', function () {
    $learner = User::factory()->create([
        'email' => 'route-reached@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $firstActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'reached-start',
        'type' => 'dialogue',
        'title' => 'Reached start',
        'config' => [],
        'sort_order' => 240,
    ]);
    $currentActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'reached-current',
        'type' => 'reflection',
        'title' => 'Reached current',
        'config' => [],
        'sort_order' => 250,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $firstActivity->id,
        'label' => 'Reached route',
        'sort_order' => 240,
    ]);
    $runId = '22222222-2222-4222-8222-222222222222';

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $firstActivity->id,
        'current_learning_activity_id' => $firstActivity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
        'started_at' => now(),
        'last_entered_at' => now(),
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $currentActivity), [
            'play_run_id' => $runId,
            'status' => 'reached',
        ])
        ->assertOk();

    expect(
        LearnerRouteProgress::query()
            ->where('current_play_run_id', $runId)
            ->firstOrFail()
            ->current_learning_activity_id,
    )->toBe($currentActivity->id);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $firstActivity->id,
            'node' => $node,
            'route' => $start->id,
            'run' => $runId,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));
});

test('npc dialogue bubble state is stored against the current play run', function () {
    $learner = User::factory()->create([
        'email' => 'npc-state@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'stateful-dialogue',
        'type' => 'npc_dialogue',
        'title' => 'Stateful dialogue',
        'config' => [],
        'sort_order' => 260,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Stateful route',
        'sort_order' => 260,
    ]);
    $firstNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_monologue',
        'title' => 'First bubble',
        'body' => 'First.',
        'config' => [],
        'position_x' => 100,
        'position_y' => 100,
    ]);
    $secondNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_monologue',
        'title' => 'Second bubble',
        'body' => 'Second.',
        'config' => [],
        'position_x' => 250,
        'position_y' => 100,
    ]);
    NpcDialogueTransition::query()->create([
        'learning_activity_id' => $activity->id,
        'from_dialogue_node_id' => null,
        'to_dialogue_node_id' => $firstNode->id,
        'from_connector' => 'start',
        'to_connector' => 'in',
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $activity->id,
            'node' => $node,
            'route' => $start->id,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));

    $runId = currentPlayRunId($learner, $node, $start);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.npc-dialogue-state', $activity), [
            'current_node_id' => $secondNode->id,
            'history' => [$firstNode->id],
            'play_run_id' => $runId,
        ])
        ->assertOk()
        ->assertJsonPath('state.currentNodeId', $secondNode->id)
        ->assertJsonPath('state.history.0', $firstNode->id);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', ['node' => $node]))
        ->assertInertia(fn ($page) => $page
            ->component('learning/node-play')
            ->where("playState.{$activity->id}.npcDialogue.currentNodeId", $secondNode->id)
            ->where("playState.{$activity->id}.npcDialogue.history.0", $firstNode->id));
});

test('npc dialogue bubble state is cleared after the dialogue activity completes', function () {
    $learner = User::factory()->create([
        'email' => 'npc-state-reset@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'resetting-dialogue',
        'type' => 'npc_dialogue',
        'title' => 'Resetting dialogue',
        'config' => [],
        'sort_order' => 261,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Resetting route',
        'sort_order' => 261,
    ]);
    $firstNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_monologue',
        'title' => 'First bubble',
        'body' => 'First.',
        'config' => [],
        'position_x' => 100,
        'position_y' => 100,
    ]);
    $secondNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_monologue',
        'title' => 'Second bubble',
        'body' => 'Second.',
        'config' => [],
        'position_x' => 250,
        'position_y' => 100,
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'activity' => $activity->id,
            'node' => $node,
            'route' => $start->id,
        ]))
        ->assertRedirect(route('learning.nodes.play', ['node' => $node]));

    $runId = currentPlayRunId($learner, $node, $start);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.npc-dialogue-state', $activity), [
            'current_node_id' => $secondNode->id,
            'history' => [$firstNode->id],
            'play_run_id' => $runId,
        ])
        ->assertOk();

    expect(
        LearnerRouteProgress::query()
            ->where('current_play_run_id', $runId)
            ->firstOrFail()
            ->metadata['activityStates'][(string) $activity->id]['npcDialogue']['currentNodeId'] ?? null
    )->toBe($secondNode->id);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'play_run_id' => $runId,
            'status' => 'completed',
        ])
        ->assertOk();

    expect(
        LearnerRouteProgress::query()
            ->where('current_play_run_id', $runId)
            ->firstOrFail()
            ->metadata['activityStates'][(string) $activity->id] ?? null
    )->toBeNull();
});

test('item obstacles consume matching items and only continue after conditions are met', function () {
    $learner = User::factory()->create([
        'email' => 'item-obstacle@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'gate-gem',
        'title' => 'Gate gem',
    ]);
    $learner->learningItems()->attach($item, [
        'quantity' => 1,
        'acquired_at' => now(),
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'socket-the-gem',
        'type' => 'item_obstacle',
        'title' => 'Socket the gem',
        'config' => [
            'slots' => [
                ['itemId' => $item->id, 'x' => 50, 'y' => 50, 'width' => 10],
            ],
            'lockMinutes' => 0,
        ],
        'sort_order' => 120,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-continue', $activity))
        ->assertOk()
        ->assertJsonPath('state.canContinue', false)
        ->assertJsonPath('state.conditionsMet', false);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-slot', $activity), [
            'item_id' => $item->id,
            'slot_index' => 0,
        ])
        ->assertOk()
        ->assertJsonPath('state.conditionsMet', true)
        ->assertJsonPath('inventory', []);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-continue', $activity))
        ->assertOk()
        ->assertJsonPath('state.canContinue', true);

    $progress = LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($progress->status)->toBe('completed')
        ->and($learner->learningItems()->whereKey($item->id)->exists())->toBeFalse();
});

test('item obstacles can clear filled slots after successful continue', function () {
    $learner = User::factory()->create([
        'email' => 'item-obstacle-replay@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'replay-gem',
        'title' => 'Replay gem',
    ]);
    $learner->learningItems()->attach($item, [
        'quantity' => 1,
        'acquired_at' => now(),
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'socket-the-replay-gem',
        'type' => 'item_obstacle',
        'title' => 'Socket the replay gem',
        'config' => [
            'slots' => [
                ['itemId' => $item->id, 'x' => 50, 'y' => 50, 'width' => 10],
            ],
            'consumeOnEachEntry' => true,
            'lockMinutes' => 0,
        ],
        'sort_order' => 121,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-slot', $activity), [
            'item_id' => $item->id,
            'slot_index' => 0,
        ])
        ->assertOk()
        ->assertJsonPath('state.conditionsMet', true);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-continue', $activity))
        ->assertOk()
        ->assertJsonPath('state.canContinue', true)
        ->assertJsonPath('state.conditionsMet', false);

    $progress = LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($progress->metadata['itemObstacle']['filledSlots'])->toBe([])
        ->and($progress->metadata['itemObstacle']['conditionsMet'])->toBeFalse();
});

function currentPlayRunId(User $learner, LearningNode $node, LearningActivityStart $start): string
{
    $runId = LearnerRouteProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_node_id', $node->id)
        ->where('learning_activity_start_id', $start->id)
        ->firstOrFail()
        ->current_play_run_id;

    expect($runId)->toBeString();

    return (string) $runId;
}
