<?php

use App\Models\LearnerActivityProgress;
use App\Models\LearnerNodeDiscovery;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\LearningTool;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Inertia\Testing\AssertableInertia;

test('guests can visit the public world route', function () {
    $this->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
        );
});

test('authenticated users can visit the world map', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('world'));
    $response->assertOk();
});

test('authenticated users can visit their bookmark map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();

    LearningNodeBookmark::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
    ]);

    $this->actingAs($user)
        ->get(route('bookmarks'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('bookmarks')
            ->where('bookmarkMap.slug', 'bookmarks')
            ->where('bookmarkMap.nodes.0.slug', 'portal-foundation')
            ->where('bookmarkMap.nodes.0.mapSlug', 'first-sector')
            ->where('bookmarkMap.nodes.0.position.q', 0)
            ->where('bookmarkMap.nodes.0.position.r', 0)
        );
});

test('authenticated users can create and remove node bookmarks', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($user)
        ->postJson(route('learning.nodes.bookmark.store', $node))
        ->assertOk()
        ->assertJson([
            'bookmarked' => true,
            'bookmarkedNodeIds' => [$node->id],
        ]);

    expect(LearningNodeBookmark::query()
        ->where('user_id', $user->id)
        ->where('learning_node_id', $node->id)
        ->exists())->toBeTrue();

    $this->actingAs($user)
        ->deleteJson(route('learning.nodes.bookmark.destroy', $node))
        ->assertOk()
        ->assertJson([
            'bookmarked' => false,
            'bookmarkedNodeIds' => [],
        ]);

    expect(LearningNodeBookmark::query()
        ->where('user_id', $user->id)
        ->where('learning_node_id', $node->id)
        ->exists())->toBeFalse();
});

test('authenticated users can search visible maps and nodes', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson(route('learning.search', ['query' => 'archive']))
        ->assertOk()
        ->assertJsonPath('results.0.kind', 'map')
        ->assertJsonPath('results.0.mapSlug', 'signal-archive');

    $this->actingAs($user)
        ->getJson(route('learning.search', ['query' => 'quiet']))
        ->assertOk()
        ->assertJsonFragment([
            'kind' => 'node',
            'nodeSlug' => 'quiet-archive',
        ]);
});

test('world map serializes outgoing portal links for learner travel', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $targetNode = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();
    $targetNode->forceFill(['state' => 'locked'])->save();
    $exitPortal = LearningActivity::query()->create([
        'config' => ['portalMode' => 'input'],
        'learning_node_id' => $node->id,
        'slug' => 'stale-exit-start',
        'type' => 'portal',
        'title' => 'Stale exit start',
        'sort_order' => 999,
    ]);

    LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $exitPortal->id,
        'label' => null,
        'sort_order' => 999,
    ]);

    $this->actingAs($user)
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps.0.nodes.0.mapSlug', 'first-sector')
            ->has('world.maps.0.nodes.0.startRoutes', 1)
            ->where('world.maps.0.nodes.0.startRoutes.0.imageDark', '/images/routes/portal-route-dark.svg')
            ->where('world.maps.0.nodes.0.outgoingPortalLinks.0.targetMapSlug', 'signal-archive')
            ->where('world.maps.0.nodes.0.outgoingPortalLinks.0.targetNodeSlug', 'return-gate')
            ->where('world.maps.0.nodes.0.outgoingPortalLinks.0.targetNodeState', 'locked')
        );
});

test('learners can reveal a hidden node with an owned configured tool', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $learner = User::factory()->create();
    $tool = LearningTool::query()->create([
        'slug' => 'scanner',
        'title' => 'Scanner',
    ]);
    $learner->learningTools()->attach($tool, ['acquired_at' => now()]);

    $node = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $node->forceFill([
        'state' => 'hidden',
        'visual_config' => [
            ...($node->visual_config ?? []),
            'reveal' => [
                'enabled' => true,
                'toolId' => $tool->id,
            ],
        ],
    ])->save();

    $this->actingAs($learner)
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps.0.nodes.2.title', 'Undiscovered place')
            ->where('world.maps.0.nodes.2.state', 'hidden')
            ->where('world.maps.0.nodes.2.visualConfig.reveal.isDiscovered', false)
        );

    $this->actingAs($learner)
        ->postJson(route('learning.nodes.reveal-tool', $node), [
            'tool_id' => $tool->id,
        ])
        ->assertOk()
        ->assertJsonPath('result.discovered', true)
        ->assertJsonPath('result.isUseful', true);

    expect(LearnerNodeDiscovery::query()
        ->where('user_id', $learner->id)
        ->where('learning_node_id', $node->id)
        ->exists())->toBeTrue();

    $this->actingAs($learner)
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps.0.nodes.2.slug', 'quiet-archive')
            ->where('world.maps.0.nodes.2.state', 'available')
            ->where('world.maps.0.nodes.2.visualConfig.reveal.isDiscovered', true)
        );
});

test('learners unlock locked nodes only after configured rules pass', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $learner = User::factory()->create();
    $tool = LearningTool::query()->create([
        'slug' => 'archive-key',
        'title' => 'Archive key',
    ]);
    $learner->learningTools()->attach($tool, ['acquired_at' => now()]);

    $requiredNode = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $lockedNode = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $lockedNode->forceFill([
        'state' => 'locked',
        'visual_config' => [
            ...($lockedNode->visual_config ?? []),
            'unlock' => [
                'enabled' => true,
                'nodeOperator' => 'and',
                'requiredNodeIds' => [$requiredNode->id],
                'tool' => [
                    'enabled' => true,
                    'toolId' => $tool->id,
                ],
                'topOperator' => 'and',
                'rules' => [
                    'type' => 'group',
                    'operator' => 'and',
                    'rules' => [
                        [
                            'type' => 'group',
                            'operator' => 'and',
                            'rules' => [
                                [
                                    'type' => 'node_completed',
                                    'nodeId' => $requiredNode->id,
                                ],
                            ],
                        ],
                        ['type' => 'tool_used'],
                    ],
                ],
            ],
        ],
    ])->save();

    $this->actingAs($learner)
        ->postJson(route('learning.nodes.unlock-tool', $lockedNode), [
            'tool_id' => $tool->id,
        ])
        ->assertOk()
        ->assertJsonPath('result.isUseful', true)
        ->assertJsonPath('result.isUnlocked', false);

    $this->actingAs($learner)
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps.0.nodes.2.slug', 'quiet-archive')
            ->where('world.maps.0.nodes.2.state', 'locked')
            ->where('world.maps.0.nodes.2.visualConfig.unlock.toolUsed', true)
            ->where('world.maps.0.nodes.2.visualConfig.unlock.isUnlocked', false)
        );

    $requiredActivity = LearningActivity::query()
        ->where('learning_node_id', $requiredNode->id)
        ->firstOrFail();

    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $requiredActivity->id,
        'learning_node_id' => $requiredNode->id,
        'status' => 'completed',
        'reached_at' => now(),
        'completed_at' => now(),
        'attempt_count' => 1,
    ]);

    $this->actingAs($learner)
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps.0.nodes.2.slug', 'quiet-archive')
            ->where('world.maps.0.nodes.2.state', 'available')
            ->where('world.maps.0.nodes.2.visualConfig.unlock.isUnlocked', true)
        );
});

test('authenticated users can play a node activity graph outside the map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($user)
        ->get(route('learning.nodes.play', $node))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('node.slug', 'signal-gate')
            ->has('node.activities', 6)
            ->where('node.activities.1.slug', 'guided-signal-dialogue')
            ->where('node.activities.1.type', 'npc_dialogue')
            ->where('node.mapSlug', 'first-sector')
        );
});
