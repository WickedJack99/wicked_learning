<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\LearningWorld;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('guests cannot open learning paths', function () {
    $this->get(route('paths.index'))
        ->assertRedirect(route('welcome'));
});

test('learners can discover accessible authored routes with topic context', function () {
    $user = User::factory()->create();
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
        'description' => 'Look for patterns in the night sky.',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    LearningMapAsset::query()->create([
        'learning_map_id' => $map->id,
        'learning_node_id' => $node->id,
        'image_url' => '/images/constellations.png',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'notice-patterns',
        'title' => 'Notice patterns',
        'introduction' => 'Start by describing what you notice.',
        'type' => 'markdown',
        'config' => [
            'competenceTopics' => [[
                'topic' => 'Astronomy',
                'weight' => 1,
            ]],
            'learningIntent' => 'review',
        ],
        'sort_order' => 10,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Begin observing',
        'description' => 'Start with a close observation, then compare what changes.',
        'sort_order' => 10,
    ]);

    $this->actingAs($user)
        ->get(route('paths.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 1)
            ->where('paths.0.id', $start->id)
            ->where('paths.0.label', 'Begin observing')
            ->where('paths.0.routeDescription', 'Start with a close observation, then compare what changes.')
            ->where('paths.0.activityTitle', 'Notice patterns')
            ->where('paths.0.learningAreas.0.name', 'Astronomy')
            ->where('paths.0.learningAreas.0.slug', 'astronomy')
            ->where('paths.0.learningIntent', 'review')
            ->where('paths.0.topic.title', 'Astronomy')
            ->where('paths.0.topic.slug', 'astronomy')
            ->where('paths.0.mapHref', '/world?map=night-sky')
            ->where('paths.0.mapTitle', 'Night Sky')
            ->where('paths.0.nodeTitle', 'Constellations')
            ->where('paths.0.href', '/learning/nodes/'.$node->id.'/play?route='.$start->id)
        );

    $this->actingAs($user)
        ->get(route('paths.index', ['purpose' => 'review']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 1)
            ->where('selectedPurpose', 'review')
            ->where('pagination.total', 1)
            ->where('paths.0.id', $start->id)
        );
});

test('learning paths paginate long route collections on the server', function () {
    $user = User::factory()->create();
    $area = LearningTopicArea::query()->create([
        'slug' => 'long-route-area',
        'title' => 'Long route area',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'long-route-topic',
        'title' => 'Long route topic',
        'is_published' => true,
    ]);
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $topic->id,
        'slug' => 'long-route-map',
        'title' => 'Long route map',
        'access_roles' => [User::ROLE_USER],
    ]);

    foreach (range(1, 7) as $index) {
        $node = LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => 'long-route-node-'.$index,
            'title' => 'Long route node '.$index,
            'position_q' => $index,
            'position_r' => 0,
            'state' => 'available',
        ]);
        $activity = LearningActivity::query()->create([
            'learning_node_id' => $node->id,
            'slug' => 'long-route-activity-'.$index,
            'title' => 'Long route activity '.$index,
            'introduction' => 'A route activity for collection coverage.',
            'type' => 'markdown',
            'config' => [
                'learningIntent' => $index === 7 ? 'review' : 'participate',
                'timeGuideMinutes' => $index === 7 ? 25 : 10,
            ],
        ]);
        LearningActivityStart::query()->create([
            'learning_node_id' => $node->id,
            'learning_activity_id' => $activity->id,
            'label' => 'Long route '.$index,
            'sort_order' => $index,
        ]);
    }

    $this->actingAs($user)
        ->get(route('paths.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 6)
            ->where('pagination.currentPage', 1)
            ->where('pagination.lastPage', 2)
            ->where('pagination.perPage', 6)
            ->where('pagination.total', 7)
            ->where('paths.0.label', 'Long route 1')
            ->where('paths.5.label', 'Long route 6')
        );

    $this->actingAs($user)
        ->get(route('paths.index', ['page' => 2]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 1)
            ->where('pagination.currentPage', 2)
            ->where('pagination.total', 7)
            ->where('paths.0.label', 'Long route 7')
        );

    $this->actingAs($user)
        ->get(route('paths.index', ['page' => 99]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->where('pagination.currentPage', 2)
            ->where('paths.0.label', 'Long route 7')
        );

    $this->actingAs($user)
        ->get(route('paths.index', ['purpose' => 'review']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 1)
            ->where('selectedPurpose', 'review')
            ->where('pagination.currentPage', 1)
            ->where('pagination.lastPage', 1)
            ->where('pagination.total', 1)
            ->where('paths.0.label', 'Long route 7')
        );

    $this->actingAs($user)
        ->get(route('paths.index', ['purpose' => 'review', 'time' => 30]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 1)
            ->where('selectedPurpose', 'review')
            ->where('selectedTimeBudget', 30)
            ->where('pagination.total', 1)
            ->where('paths.0.timeGuideMinutes', 25)
        );

    $this->actingAs($user)
        ->get(route('paths.index', ['purpose' => 'review', 'time' => 15]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 0)
            ->where('selectedPurpose', 'review')
            ->where('selectedTimeBudget', 15)
            ->where('pagination.total', 0)
        );
});

test('learning paths exclude inaccessible maps and unavailable nodes', function () {
    $user = User::factory()->create(['role' => User::ROLE_USER]);
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);

    foreach ([
        ['private-map', 'Private map', [User::ROLE_ADMIN], 'available'],
        ['locked-node', 'Locked node', [User::ROLE_USER], 'locked'],
    ] as [$slug, $title, $roles, $state]) {
        $map = LearningMap::query()->create([
            'learning_world_id' => $world->id,
            'slug' => $slug,
            'title' => $title,
            'access_roles' => $roles,
        ]);
        $node = LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => $slug,
            'title' => $title,
            'position_q' => 0,
            'position_r' => 0,
            'state' => $state,
        ]);
        $activity = LearningActivity::query()->create([
            'learning_node_id' => $node->id,
            'slug' => $slug,
            'title' => 'Hidden route',
            'type' => 'markdown',
        ]);
        LearningActivityStart::query()->create([
            'learning_node_id' => $node->id,
            'learning_activity_id' => $activity->id,
            'label' => 'Should not appear',
        ]);
    }

    $this->actingAs($user)
        ->get(route('paths.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('paths')
            ->has('paths', 0)
        );
});
