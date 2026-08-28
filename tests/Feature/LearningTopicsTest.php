<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearnerEvidenceEvent;
use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\LearningWorld;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;

test('guests cannot open the topic directory', function () {
    $this->get(route('topics.index'))
        ->assertRedirect(route('welcome'));
});

test('learners see published topic areas in manual order and topics alphabetically', function () {
    $user = User::factory()->create();
    $secondArea = LearningTopicArea::query()->create([
        'slug' => 'technology',
        'title' => 'Technology',
        'sort_order' => 20,
    ]);
    $firstArea = LearningTopicArea::query()->create([
        'slug' => 'medicine',
        'title' => 'Medicine',
        'sort_order' => 10,
    ]);

    LearningTopic::query()->create([
        'learning_topic_area_id' => $firstArea->id,
        'slug' => 'circulation',
        'title' => 'Circulation',
        'is_published' => true,
    ]);
    LearningTopic::query()->create([
        'learning_topic_area_id' => $firstArea->id,
        'slug' => 'anatomy',
        'title' => 'Anatomy',
        'is_published' => true,
    ]);
    LearningTopic::query()->create([
        'learning_topic_area_id' => $firstArea->id,
        'slug' => 'draft-topic',
        'title' => 'Draft topic',
        'is_published' => false,
    ]);
    LearningTopic::query()->create([
        'learning_topic_area_id' => $secondArea->id,
        'slug' => 'networks',
        'title' => 'Networks',
        'is_published' => true,
    ]);
    $world = LearningWorld::query()->create([
        'slug' => 'topic-directory-world',
        'title' => 'Topic Directory World',
    ]);
    LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => LearningTopic::query()
            ->where('slug', 'anatomy')
            ->firstOrFail()
            ->id,
        'slug' => 'anatomy-map',
        'title' => 'Anatomy Map',
        'access_roles' => [User::ROLE_USER],
    ]);

    $this->actingAs($user)
        ->get(route('topics.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('topics/index')
            ->where('canManageTopics', false)
            ->has('areas', 2)
            ->where('areas.0.title', 'Medicine')
            ->where('areas.0.topics.0.title', 'Anatomy')
            ->where('areas.0.topics.0.mapCount', 1)
            ->where('areas.0.topics.1.title', 'Circulation')
            ->where('areas.0.topics.1.mapCount', 0)
            ->has('areas.0.topics', 2)
            ->where('areas.1.title', 'Technology')
        );
});

test('a published topic page exposes its published subtopics alphabetically', function () {
    $user = User::factory()->create();
    $area = LearningTopicArea::query()->create([
        'slug' => 'science',
        'title' => 'Science',
        'sort_order' => 10,
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'physics',
        'title' => 'Physics',
        'content' => '# Motion',
        'is_published' => true,
    ]);

    $subtopics = [];
    foreach ([['Waves', true], ['Energy', true], ['Hidden', false]] as [$title, $published]) {
        $subtopics[$title] = LearningTopic::query()->create([
            'learning_topic_area_id' => $area->id,
            'parent_id' => $topic->id,
            'slug' => strtolower($title),
            'title' => $title,
            'is_published' => $published,
        ]);
    }
    $world = LearningWorld::query()->create([
        'slug' => 'physics-world',
        'title' => 'Physics World',
    ]);
    LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $subtopics['Waves']->id,
        'slug' => 'waves-map',
        'title' => 'Waves Map',
        'access_roles' => [User::ROLE_USER],
    ]);

    $this->actingAs($user)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('topics/show')
            ->where('topic.title', 'Physics')
            ->where('topic.href', '/topics/physics')
            ->where('topic.content', '# Motion')
            ->where('topic.subtopics.0.title', 'Energy')
            ->where('topic.subtopics.0.mapCount', 0)
            ->where('topic.subtopics.1.title', 'Waves')
            ->where('topic.subtopics.1.mapCount', 1)
            ->has('topic.subtopics', 2)
        );
});

test('a topic page exposes assigned maps that the learner can access', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $learner = User::factory()->create(['role' => User::ROLE_USER]);
    $area = LearningTopicArea::query()->create([
        'slug' => 'science',
        'title' => 'Science',
        'sort_order' => 10,
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'astronomy',
        'title' => 'Astronomy',
        'is_published' => true,
    ]);
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'night-sky',
        'title' => 'Night Sky',
        'access_roles' => [User::ROLE_USER],
    ]);
    LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'admin-observatory',
        'title' => 'Admin Observatory',
        'access_roles' => [User::ROLE_ADMIN],
        'learning_topic_id' => $topic->id,
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.maps.details.update', $map), [
            'description' => 'A place to explore the night sky.',
            'map_assets_locked' => false,
            'topic_id' => $topic->id,
            'title' => 'Night Sky',
        ])
        ->assertRedirect();

    expect($map->refresh()->learning_topic_id)->toBe($topic->id);

    $this->actingAs($learner)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('topic.maps.0.title', 'Night Sky')
            ->where('topic.maps.0.href', '/world?map=night-sky')
            ->has('topic.maps', 1)
        );
});

test('a topic page exposes playable routes from its assigned maps', function () {
    $learner = User::factory()->create(['role' => User::ROLE_USER]);
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
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $topic->id,
        'slug' => 'night-sky',
        'title' => 'Night Sky',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'constellations',
        'title' => 'Constellations',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'notice-patterns',
        'title' => 'Notice patterns',
        'type' => 'markdown',
        'config' => ['learningIntent' => 'review'],
        'sort_order' => 10,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Begin observing',
        'sort_order' => 10,
    ]);

    $this->actingAs($learner)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('topic.paths', 1)
            ->where('topic.paths.0.label', 'Begin observing')
            ->where('topic.paths.0.learningIntent', 'review')
            ->where('topic.paths.0.mapHref', '/world?map=night-sky')
            ->where('topic.paths.0.mapTitle', 'Night Sky')
            ->where('topic.paths.0.nodeHref', '/world?map=night-sky&focused=constellations')
            ->where('topic.maps.0.nodeCount', 1)
            ->where('topic.paths.0.href', '/learning/nodes/'.$node->id.'/play?route='.$start->id)
        );
});

test('a topic detail exposes complete collections for client pagination', function () {
    $learner = User::factory()->create(['role' => User::ROLE_USER]);
    $area = LearningTopicArea::query()->create([
        'slug' => 'science',
        'title' => 'Science',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'many-paths',
        'title' => 'Many paths',
        'is_published' => true,
    ]);
    $subtopics = collect(range(1, 5))->map(fn (int $number): LearningTopic => LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'parent_id' => $topic->id,
        'slug' => 'subtopic-'.$number,
        'title' => 'Subtopic '.$number,
        'is_published' => true,
    ]));
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);

    foreach (range(1, 5) as $number) {
        $map = LearningMap::query()->create([
            'learning_world_id' => $world->id,
            'learning_topic_id' => $topic->id,
            'slug' => 'many-paths-map-'.$number,
            'title' => 'Many Paths Map '.$number,
            'access_roles' => [User::ROLE_USER],
        ]);
        $node = LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => 'many-paths-node-'.$number,
            'title' => 'Many Paths Node '.$number,
            'position_q' => $number,
            'position_r' => 0,
            'state' => 'available',
        ]);
        $activity = LearningActivity::query()->create([
            'learning_node_id' => $node->id,
            'slug' => 'many-paths-activity-'.$number,
            'title' => 'Many Paths Activity '.$number,
            'type' => 'markdown',
            'config' => ['learningIntent' => 'review'],
            'sort_order' => 10,
        ]);
        LearningActivityStart::query()->create([
            'learning_node_id' => $node->id,
            'learning_activity_id' => $activity->id,
            'label' => 'Begin path '.$number,
            'sort_order' => 10,
        ]);
    }

    $this->actingAs($learner)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('topic.maps', 5)
            ->has('topic.paths', 5)
            ->has('topic.subtopics', 5)
            ->where('topic.subtopics.4.title', $subtopics->last()->title)
        );
});

test('the learner journey keeps topic, competence, map and activity context connected', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $learner = User::factory()->create(['role' => User::ROLE_USER]);
    $topic = LearningTopic::query()
        ->where('slug', 'pattern-investigation')
        ->firstOrFail();
    $map = LearningMap::query()
        ->where('slug', 'first-sector')
        ->firstOrFail();
    $node = LearningNode::query()
        ->where('slug', 'signal-gate')
        ->firstOrFail();
    $activity = LearningActivity::query()
        ->where('slug', 'guided-signal-dialogue')
        ->firstOrFail();
    $start = LearningActivityStart::query()
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    $this->actingAs($learner)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('topic.maps.0.href', '/world?map=first-sector')
            ->where('topic.paths.0.mapHref', '/world?map=first-sector')
            ->where('topic.paths.0.nodeHref', '/world?map=first-sector&focused=signal-gate')
            ->where('topic.paths.0.href', route('learning.nodes.play', [
                'node' => $node,
                'route' => $start->id,
            ], false))
        );

    $this->actingAs($learner)
        ->get(route('competence.index', [
            'topic' => 'pattern-recognition',
            'from' => $topic->slug,
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('competence/index')
            ->where('selectedTopic.title', $topic->title)
            ->where('selectedTopic.href', '/topics/'.$topic->slug)
            ->where('selectedTopicSlug', 'pattern-recognition')
        );

    $this->actingAs($learner)
        ->get(route('world', [
            'map' => $map->slug,
            'focused' => $node->slug,
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps.0.slug', $map->slug)
            ->where('world.maps.0.topic.href', '/topics/'.$topic->slug)
            ->where('world.maps.0.nodes', fn ($nodes): bool => $nodes
                ->contains(fn (array $entry): bool => ($entry['slug'] ?? null) === $node->slug
                    && ($entry['topic']['href'] ?? null) === '/topics/'.$topic->slug))
        );

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'node' => $node,
            'route' => $start->id,
        ]))
        ->assertRedirectContains(route('learning.nodes.play', ['node' => $node]));

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', ['node' => $node]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('playActivityId', $activity->id)
            ->where('playRouteId', $start->id)
            ->where('node.topic.href', '/topics/'.$topic->slug)
            ->where('node.mapSlug', $map->slug)
            ->where('node.slug', $node->slug)
            ->where('node.activities.0.id', $activity->id)
        );
});

test('selecting a route keeps its run and repairs stale activity state', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $learner = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $route = LearningActivityStart::query()
        ->where('learning_node_id', $node->id)
        ->where('label', 'Clear noisy gate')
        ->firstOrFail();
    $unrelatedActivity = LearningActivity::query()
        ->where('learning_node_id', $node->id)
        ->where('slug', 'guided-signal-dialogue')
        ->firstOrFail();
    $runId = '33333333-3333-4333-8333-333333333333';

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $route->id,
        'start_learning_activity_id' => $route->learning_activity_id,
        'current_learning_activity_id' => $unrelatedActivity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
        'started_at' => now(),
        'last_entered_at' => now(),
    ]);

    $response = $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'node' => $node,
            'route' => $route->id,
        ]))
        ->assertRedirectContains(route('learning.nodes.play', ['node' => $node]));

    parse_str((string) parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['route'])->toBe((string) $route->id)
        ->and($query['activity_id'])->toBe((string) $route->learning_activity_id)
        ->and($query['run'])->toBe($runId);

    $this->actingAs($learner)
        ->get($response->headers->get('Location'))
        ->assertInertia(fn ($page) => $page
            ->component('learning/node-play')
            ->where('playActivityId', $route->learning_activity_id)
            ->where('playRouteId', $route->id)
            ->where('playRunId', $runId)
        );
});

test('a topic page exposes its scoped learning trail', function () {
    Carbon::setTestNow('2026-08-26 10:00:00');

    $learner = User::factory()->create(['role' => User::ROLE_USER]);
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
    $subtopic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'parent_id' => $topic->id,
        'slug' => 'deep-space',
        'title' => 'Deep Space',
        'is_published' => true,
    ]);
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $topic->id,
        'slug' => 'night-sky',
        'title' => 'Night Sky',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'constellations',
        'title' => 'Constellations',
        'position_q' => 0,
        'position_r' => 0,
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'notice-patterns',
        'title' => 'Notice patterns',
        'type' => 'markdown',
        'config' => [
            'competenceTopics' => [[
                'slug' => 'astronomy',
                'topic' => 'Astronomy',
                'weight' => 1,
            ]],
        ],
        'sort_order' => 10,
    ]);
    LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'astronomy',
        'topic_name' => 'Astronomy',
        'evidence_type' => 'retrieve',
        'contribution' => 4,
    ]);
    $subtopicNode = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'galaxies',
        'title' => 'Galaxies',
        'position_q' => 1,
        'position_r' => 0,
    ]);
    $subtopicActivity = LearningActivity::query()->create([
        'learning_node_id' => $subtopicNode->id,
        'slug' => 'compare-galaxies',
        'title' => 'Compare galaxies',
        'type' => 'markdown',
        'config' => [
            'competenceTopics' => [[
                'slug' => 'deep-space',
                'topic' => 'Deep Space',
                'weight' => 1,
            ]],
        ],
        'sort_order' => 20,
    ]);
    LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $subtopicActivity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => $subtopic->slug,
        'topic_name' => $subtopic->title,
        'evidence_type' => 'explain',
        'contribution' => 6,
    ]);
    $journalPage = LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Astronomy reflections',
        'topic' => 'Astronomy',
        'subtopic' => '',
        'markdown' => 'Private reflections',
        'preferred_mode' => 'view',
    ]);
    $earlierReflection = LearnerReflection::query()->create([
        'user_id' => $learner->id,
        'learner_journal_page_id' => $journalPage->id,
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'title' => 'Earlier reflection',
        'question' => 'What did you notice at first?',
        'reflection' => 'At first I noticed the separate parts.',
        'feedback_status' => 'not_requested',
    ]);
    $earlierReflection->forceFill([
        'created_at' => now()->subDays(12),
        'updated_at' => now()->subDays(12),
    ])->save();
    $laterReflection = LearnerReflection::query()->create([
        'user_id' => $learner->id,
        'learner_journal_page_id' => $journalPage->id,
        'learning_node_id' => $subtopicNode->id,
        'learning_activity_id' => $subtopicActivity->id,
        'title' => 'Later reflection',
        'question' => 'What do you notice now?',
        'reflection' => 'Now I can describe how the parts influence one another.',
        'feedback_status' => 'not_requested',
    ]);
    $laterReflection->forceFill([
        'created_at' => now()->subDay(),
        'updated_at' => now()->subDay(),
    ])->save();
    $middleReflection = LearnerReflection::query()->create([
        'user_id' => $learner->id,
        'learner_journal_page_id' => $journalPage->id,
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'title' => 'Middle reflection',
        'question' => 'What changed in your view?',
        'reflection' => 'I started connecting the observations.',
        'feedback_status' => 'not_requested',
    ]);
    $middleReflection->forceFill([
        'created_at' => now()->subDays(6),
        'updated_at' => now()->subDays(6),
    ])->save();

    $this->actingAs($learner)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('topic.competence.evidenceTypes', ['retrieve'])
            ->where('topic.competence.evidenceLedger.0.activityTitle', 'Notice patterns')
            ->where('topic.competence.evidenceLedger.0.evidenceType', 'retrieve')
            ->where('topic.competence.evidenceLedger.0.activityHref', route('learning.nodes.play', ['activity_id' => $activity->id, 'node' => $node]))
            ->where('topic.competence.learningPeriods', ['Aug 2026'])
            ->where('topic.competence.revisit.activityTitle', 'Notice patterns')
            ->where('topic.reflectionNarrative.earlier.question', 'What did you notice at first?')
            ->where('topic.reflectionNarrative.earlier.reflection', 'At first I noticed the separate parts.')
            ->where('topic.reflectionNarrative.later.question', 'What do you notice now?')
            ->where('topic.reflectionNarrative.later.reflection', 'Now I can describe how the parts influence one another.')
            ->where('topic.reflectionNarrative.later.journalHref', '/journal')
            ->has('topic.reflectionNarrative.entries', 3)
            ->where('topic.reflectionNarrative.entries.1.reflection', 'I started connecting the observations.')
            ->where('topic.subtopicCompetence.0.name', 'Deep Space')
            ->where('topic.subtopicCompetence.0.topic.title', 'Deep Space')
        );
});

test('normal users cannot open topic administration', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('admin.topics.index'))
        ->assertForbidden();
});

test('admins can insert and reorder areas and create alphabetically sorted topics', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $firstArea = LearningTopicArea::query()->create([
        'slug' => 'medicine',
        'title' => 'Medicine',
        'sort_order' => 10,
    ]);
    $lastArea = LearningTopicArea::query()->create([
        'slug' => 'technology',
        'title' => 'Technology',
        'sort_order' => 20,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.topic-areas.store'), [
            'after_area_id' => $firstArea->id,
            'title' => 'Natural sciences',
        ])
        ->assertRedirect();

    $insertedArea = LearningTopicArea::query()->where('slug', 'natural-sciences')->firstOrFail();

    expect(LearningTopicArea::query()->orderBy('sort_order')->pluck('title')->all())
        ->toBe(['Medicine', 'Natural sciences', 'Technology']);

    $this->actingAs($admin)
        ->patch(route('admin.topic-areas.reorder'), [
            'area_ids' => [$lastArea->id, $insertedArea->id, $firstArea->id],
        ])
        ->assertRedirect();

    expect(LearningTopicArea::query()->orderBy('sort_order')->pluck('title')->all())
        ->toBe(['Technology', 'Natural sciences', 'Medicine']);

    foreach (['Zoology', 'Astronomy'] as $title) {
        $this->actingAs($admin)
            ->post(route('admin.topic-areas.topics.store', $insertedArea), [
                'title' => $title,
                'is_published' => true,
            ])
            ->assertRedirect();
    }

    $this->actingAs($admin)
        ->get(route('admin.topics.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('admin/topics')
            ->where('areas.0.title', 'Technology')
            ->where('areas.1.title', 'Natural sciences')
            ->where('areas.1.topics.0.title', 'Astronomy')
            ->where('areas.1.topics.1.title', 'Zoology')
        );
});
