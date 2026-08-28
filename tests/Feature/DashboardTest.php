<?php

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningNodeStateResolver;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerNodeDiscovery;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\LearningTool;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\LearningWorld;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;

test('guests can visit the public world route', function () {
    $this->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
        );
});

test('guests are redirected home when the world has no public maps', function () {
    LearningMap::query()->delete();

    $world = LearningWorld::query()->updateOrCreate([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
    ], [
        'title' => 'Private World',
    ]);

    LearningMap::query()->create([
        'access_roles' => [User::ROLE_USER, User::ROLE_ADMIN],
        'learning_world_id' => $world->id,
        'slug' => 'private-map',
        'title' => 'Private Map',
    ]);

    $this->get(route('world'))
        ->assertRedirect(route('welcome'));
});

test('guests are redirected home when playing a node on a private map', function () {
    $world = LearningWorld::query()->create([
        'slug' => 'private-play-world',
        'title' => 'Private Play World',
    ]);
    $map = LearningMap::query()->create([
        'access_roles' => [User::ROLE_USER, User::ROLE_ADMIN],
        'learning_world_id' => $world->id,
        'slug' => 'private-play-map',
        'title' => 'Private Play Map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'position_q' => 0,
        'position_r' => 0,
        'slug' => 'private-play-node',
        'title' => 'Private Play Node',
    ]);

    $this->get(route('learning.nodes.play', $node))
        ->assertRedirect(route('welcome'));
});

test('authenticated users can visit the world map', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('world'));
    $response->assertOk();
});

test('world maps expose published topic context without exposing draft topics', function () {
    $area = LearningTopicArea::query()->create([
        'slug' => 'science',
        'title' => 'Science',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'astronomy',
        'title' => 'Astronomy',
        'is_published' => true,
    ]);
    $draft = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'draft-astronomy',
        'title' => 'Draft astronomy',
        'is_published' => false,
    ]);
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $topic->id,
        'slug' => 'night-sky',
        'title' => 'Night Sky',
    ]);
    LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $draft->id,
        'slug' => 'draft-sky',
        'title' => 'Draft Sky',
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps', fn ($maps): bool => $maps->contains(
                fn (array $map): bool => $map['title'] === 'Night Sky'
                    && $map['topic']['title'] === 'Astronomy'
                    && $map['topic']['href'] === '/topics/astronomy'
                    && $map['topic']['competenceHref'] === '/competence?topic=astronomy',
            ) && $maps->contains(
                fn (array $map): bool => $map['title'] === 'Draft Sky'
                    && $map['topic'] === null,
            ))
        );
});

test('authenticated users return to the last world map stored on their account', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $targetMap = LearningMap::query()->where('slug', 'signal-archive')->firstOrFail();

    $this->actingAs($user)
        ->get(route('world', ['map' => $targetMap->slug]))
        ->assertOk();

    expect($user->refresh()->preference?->settings['learning']['lastMapSlug'] ?? null)
        ->toBe('signal-archive')
        ->and($user->preference?->settings['learning']['lastMapId'] ?? null)
        ->toBe($targetMap->id);

    $this->actingAs($user)
        ->get(route('world'))
        ->assertRedirect(route('world', ['map' => 'signal-archive']));
});

test('playing a node records that node map as the learner location', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'return-gate')->firstOrFail();
    $area = LearningTopicArea::query()->create([
        'slug' => 'play-area',
        'title' => 'Play area',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'play-topic',
        'title' => 'Play topic',
        'is_published' => true,
    ]);
    $node->map->update(['learning_topic_id' => $topic->id]);

    $this->actingAs($user)
        ->get(route('learning.nodes.play', $node))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('node.mapSlug', 'signal-archive')
            ->where('node.topic.title', 'Play topic')
            ->where('node.topic.competenceHref', '/competence?topic=play-topic')
            ->where('node.topic.href', '/topics/play-topic'));

    expect($user->refresh()->preference?->settings['learning']['lastMapSlug'] ?? null)
        ->toBe('signal-archive');
});

test('authenticated users can visit their bookmark map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $area = LearningTopicArea::query()->create([
        'slug' => 'bookmark-area',
        'title' => 'Bookmark area',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'bookmark-topic',
        'title' => 'Bookmark topic',
        'is_published' => true,
    ]);
    $node->map->update(['learning_topic_id' => $topic->id]);

    LearningNodeBookmark::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
    ]);
    LearningMapAsset::query()
        ->where('learning_node_id', $node->id)
        ->firstOrFail()
        ->update([
            'image_url' => '/images/bookmark.png',
            'focusable' => true,
            'interaction_mode' => 'focusable',
        ]);

    $this->actingAs($user)
        ->get(route('bookmarks'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('bookmarks')
            ->where('bookmarkMap.slug', 'bookmarks')
            ->has('bookmarkMap.mapAssets', 1)
            ->where('bookmarkMap.mapAssets.0.nodeId', $node->id)
            ->where('bookmarkMap.nodes.0.slug', 'portal-foundation')
            ->where('bookmarkMap.nodes.0.mapSlug', 'first-sector')
            ->where('bookmarkMap.nodes.0.topic.title', 'Bookmark topic')
            ->where('bookmarkMap.nodes.0.topic.href', '/topics/bookmark-topic')
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

test('a bookmark lifecycle preserves its map asset and topic context', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($user)
        ->postJson(route('learning.nodes.bookmark.store', $node))
        ->assertOk()
        ->assertJsonPath('bookmarked', true);

    $this->actingAs($user)
        ->get(route('bookmarks'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('bookmarks')
            ->where('bookmarkMap.nodes.0.slug', $node->slug)
            ->where('bookmarkMap.nodes.0.mapSlug', $node->map->slug)
            ->where('bookmarkMap.nodes.0.topic.href', '/topics/pattern-investigation')
            ->where('bookmarkMap.mapAssets.0.nodeId', $node->id)
        );

    $this->actingAs($user)
        ->get(route('learning.nodes.play', ['node' => $node]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('isBookmarked', true)
        );

    $this->actingAs($user)
        ->deleteJson(route('learning.nodes.bookmark.destroy', $node))
        ->assertOk()
        ->assertJsonPath('bookmarked', false);

    $this->actingAs($user)
        ->get(route('bookmarks'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('bookmarks')
            ->has('bookmarkMap.nodes', 0)
            ->has('bookmarkMap.mapAssets', 0)
        );

    $this->actingAs($user)
        ->get(route('learning.nodes.play', ['node' => $node]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('isBookmarked', false)
        );
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

test('authenticated users can search published topics', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();

    LearningTopic::query()->create([
        'description' => 'A private draft topic.',
        'is_published' => false,
        'learning_topic_area_id' => LearningTopicArea::query()->firstOrFail()->id,
        'slug' => 'private-patterns',
        'title' => 'Private patterns',
    ]);

    $this->actingAs($user)
        ->getJson(route('learning.search', ['query' => 'pattern investigation']))
        ->assertOk()
        ->assertJsonPath('results.0.kind', 'topic')
        ->assertJsonPath('results.0.title', 'Pattern investigation')
        ->assertJsonPath('results.0.href', '/topics/pattern-investigation');

    $this->actingAs($user)
        ->getJson(route('learning.search', ['query' => 'private patterns']))
        ->assertOk()
        ->assertJsonCount(0, 'results');
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

test('npc dialogue answers can hide and unlock nodes for the learner', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $learner = User::factory()->create();
    $sourceNode = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $hiddenTarget = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $unlockedTarget = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $unlockedTarget->forceFill(['state' => 'locked'])->save();
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $sourceNode->id,
        'slug' => 'answer-events',
        'type' => 'npc_dialogue',
        'title' => 'Answer Events',
        'sort_order' => 50,
        'config' => [],
    ]);
    $questionNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_question',
        'title' => 'Choice',
        'body' => 'Choose an effect.',
        'config' => ['questionOutputCount' => 1],
    ]);
    $answerNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'answer',
        'title' => 'Reveal consequence',
        'body' => 'Apply the configured world event.',
        'config' => [
            'answerLabel' => 'A',
            'events' => [
                'hideNodeIds' => [$hiddenTarget->id],
                'unlockNodeIds' => [$unlockedTarget->id],
            ],
            'isCorrect' => true,
        ],
    ]);

    NpcDialogueTransition::query()->create([
        'learning_activity_id' => $activity->id,
        'from_dialogue_node_id' => $questionNode->id,
        'to_dialogue_node_id' => $answerNode->id,
        'from_connector' => 'answer-1',
        'to_connector' => 'in',
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.npc-dialogue-nodes.answer', $questionNode), [
            'answer_key' => (string) $answerNode->id,
        ])
        ->assertOk()
        ->assertJsonPath('answer.answerNodeId', $answerNode->id);

    $stateResolver = app(LearningNodeStateResolver::class);

    expect($stateResolver->stateForUser($hiddenTarget->refresh(), $learner->id))->toBe('hidden')
        ->and($stateResolver->stateForUser($unlockedTarget->refresh(), $learner->id))->toBe('available');
});

test('node schedules can unlock and lock nodes based on the current time', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    Carbon::setTestNow(Carbon::parse('2026-07-12 12:00:00'));

    $learner = User::factory()->create();
    $scheduledUnlock = LearningNode::query()->where('slug', 'quiet-archive')->firstOrFail();
    $scheduledLock = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $scheduledUnlock->forceFill([
        'state' => 'locked',
        'visual_config' => [
            ...($scheduledUnlock->visual_config ?? []),
            'schedule' => [
                'unlockAt' => '2026-07-12T11:50',
            ],
            'unlock' => [
                'enabled' => true,
                'topOperator' => 'and',
                'rules' => [
                    'type' => 'time_after',
                ],
            ],
        ],
    ])->save();

    $scheduledLock->forceFill([
        'state' => 'available',
        'visual_config' => [
            ...($scheduledLock->visual_config ?? []),
            'schedule' => [
                'lockAt' => '2026-07-12T11:50',
            ],
        ],
    ])->save();

    $stateResolver = app(LearningNodeStateResolver::class);

    expect($stateResolver->stateForUser($scheduledUnlock->refresh(), $learner->id))->toBe('available')
        ->and($stateResolver->stateForUser($scheduledLock->refresh(), $learner->id))->toBe('locked');

    Carbon::setTestNow();
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
            ->has('node.activities', 5)
            ->where('node.activities.0.slug', 'guided-signal-dialogue')
            ->where('node.activities.0.type', 'npc_dialogue')
            ->where('node.mapSlug', 'first-sector')
        );
});

test('learners can open a requested activity within a playable node', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $activity = $node->activities()->orderBy('sort_order')->skip(1)->firstOrFail();

    $this->actingAs($user)
        ->get(route('learning.nodes.play', [
            'activity_id' => $activity->id,
            'node' => $node,
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('playActivityId', $activity->id));
});
