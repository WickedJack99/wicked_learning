<?php

use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\NpcDialogueAnswer;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
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
            ->has('activityGraph.activities', 6)
            ->where('activityGraph.activities.1.slug', 'guided-signal-dialogue')
            ->where('activityGraph.activities.1.type', 'npc_dialogue')
            ->has('activityGraph.transitions', 6)
            ->has('activityGraph.portalCandidates')
            ->has('activityGraph.activityTypes')
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
            'portal_duration_seconds' => 2.5,
            'portal_foreground_dark' => '/storage/learning/nodes/swirl-dark.svg',
            'portal_foreground_light' => '/storage/learning/nodes/swirl-light.svg',
            'portal_foreground_x' => 42,
            'portal_foreground_y' => 58,
            'portal_swirl_enabled' => false,
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
        ->and($activity->config['portalDurationSeconds'])->toBe(2.5)
        ->and($activity->config['portalForegroundDark'])->toBe('/storage/learning/nodes/swirl-dark.svg')
        ->and($activity->config['portalForegroundLight'])->toBe('/storage/learning/nodes/swirl-light.svg')
        ->and($activity->config['portalForegroundX'])->toBe(42)
        ->and($activity->config['portalForegroundY'])->toBe(58)
        ->and($activity->config['portalSwirlEnabled'])->toBeFalse();

    $this->actingAs($admin)
        ->get(route('settings.worlds.nodes.activities.edit', $sourceNode))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('activityGraph.portalCandidates')
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
            'type' => 'npc_interaction',
        ])
        ->assertRedirect(route('settings.worlds.activities.npc-dialogue.edit', $activity));

    $interaction = NpcDialogueNode::query()
        ->where('learning_activity_id', $activity->id)
        ->where('type', 'npc_interaction')
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
        'type' => 'npc_interaction',
        'title' => 'Mira',
        'body' => 'Which observation is useful?',
        'config' => [
            'interactionMode' => 'question',
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
        ->get(route('settings.worlds.nodes.activities.edit', $node))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('activityGraph.node.startRoutes', 3)
            ->where('activityGraph.node.startRoutes.1.buttonColorDark', '#0f172a')
            ->where('activityGraph.node.startRoutes.1.buttonBorderColorLight', '#e2e8f0')
            ->where('activityGraph.node.startRoutes.1.imageDark', '/images/routes/easy-dark.svg')
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
            'title' => 'Signal Gate Revised',
            'slug' => 'signal-gate',
            'description' => 'Updated from the admin editor.',
            'position_q' => $node->position_q,
            'position_r' => $node->position_r,
            'state' => 'available',
            'visual_config' => [
                'label' => 'Signal Gate',
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

    expect($node->title)->toBe('Signal Gate Revised')
        ->and($node->description)->toBe('Updated from the admin editor.')
        ->and($node->visual_config['hideImage'])->toBeTrue()
        ->and($node->visual_config['hideLabel'])->toBeTrue()
        ->and($node->visual_config['tooltip'])->toBe('Edited tile.')
        ->and($node->visual_config['dark']['imageUrl'])->toBe('/storage/learning/nodes/dark.svg')
        ->and($node->visual_config['light']['tileColor'])->toBe('#e0f2fe');
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
                'imageUrl' => '/storage/learning/maps/default.webp',
                'overlay' => 'rgba(1, 8, 14, 0.72)',
                'pageBackground' => '#08111a',
                'panelBackground' => 'rgba(8, 17, 26, 0.78)',
                'panelTextColor' => '#f8fafc',
                'panelMutedTextColor' => 'rgba(226, 232, 240, 0.82)',
                'accentColor' => '#99f6e4',
                'sidePanelBackground' => '#111820',
                'sidePanelBorderColor' => 'rgba(255, 255, 255, 0.1)',
                'sidePanelTextColor' => '#f8fafc',
                'sidePanelMutedTextColor' => 'rgba(226, 232, 240, 0.72)',
                'dark' => [
                    'imageUrl' => '/storage/learning/maps/dark.webp',
                    'pageBackground' => '#020617',
                    'accentColor' => '#5eead4',
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

    expect($map->background_config['imageUrl'])->toBe('/storage/learning/maps/default.webp')
        ->and($map->background_config['dark']['imageUrl'])->toBe('/storage/learning/maps/dark.webp')
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
