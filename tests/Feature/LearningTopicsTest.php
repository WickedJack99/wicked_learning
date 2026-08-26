<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearnerEvidenceEvent;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\LearningWorld;
use App\Models\User;
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

    $this->actingAs($learner)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('topic.competence.evidenceTypes', ['retrieve'])
            ->where('topic.competence.learningPeriods', ['Aug 2026'])
            ->where('topic.competence.revisit.activityTitle', 'Notice patterns')
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
