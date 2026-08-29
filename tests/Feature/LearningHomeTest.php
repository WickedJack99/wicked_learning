<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;

test('guests are sent to the public welcome page instead of the learning desk', function () {
    $this->get(route('home'))
        ->assertRedirect(route('welcome'));
});

test('the journal deep link opens the journal from the learning desk', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/journal')
        ->assertRedirect(route('home', ['journal' => '1']));
});

test('authenticated learners can open an empty learning desk', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('home')
            ->has('desk.currentRoutes', 0)
            ->has('desk.recentRoutes', 0)
            ->has('desk.bookmarks', 0)
            ->has('desk.revisitInvitations', 0)
            ->has('desk.connections', 0)
            ->where('desk.featuredBookmark', null)
        );
});

test('the learning desk surfaces learner-chosen revisit invitations', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    $user = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'revisit-map',
        'title' => 'Revisit Map',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'revisit-node',
        'title' => 'Revisit Node',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'revisit-activity',
        'title' => 'Revisit Activity',
        'type' => 'markdown',
        'sort_order' => 10,
    ]);
    $recordedAt = now()->subDays(4)->toIso8601String();
    LearnerActivityProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subDays(4),
        'completed_at' => now()->subDays(4),
        'metadata' => [
            'learningCheckIns' => [[
                'nextDirection' => 'revisit',
                'recordedAt' => $recordedAt,
            ]],
        ],
    ]);

    $this->actingAs($user)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('desk.revisitInvitations', 1)
            ->where('desk.revisitInvitations.0.activityTitle', 'Revisit Activity')
            ->where('desk.revisitInvitations.0.availableAfterDays', 3)
            ->where('desk.revisitInvitations.0.availableSince', $recordedAt)
            ->where('desk.revisitInvitations.0.nodeHref', route('world', [
                'map' => 'revisit-map',
                'focused' => 'revisit-node',
            ], false))
        );
});

test('the learning desk presents current work and saved topics', function () {
    $user = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $area = LearningTopicArea::query()->create([
        'slug' => 'body-area',
        'title' => 'The human body',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'circulation-topic',
        'title' => 'Circulation',
        'is_published' => true,
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $topic->id,
        'slug' => 'circulation',
        'title' => 'Circulation',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'heart-valves',
        'title' => 'Heart valves',
        'description' => 'Follow the path of blood through the heart.',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    LearningMapAsset::query()->create([
        'learning_map_id' => $map->id,
        'learning_node_id' => $node->id,
        'image_url' => '/images/heart.png',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'observe-flow',
        'title' => 'Observe the flow',
        'type' => 'markdown',
        'config' => [
            'competenceTopics' => [[
                'topic' => 'Circulation',
                'weight' => 1,
            ]],
        ],
        'sort_order' => 10,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Follow the blood flow',
        'sort_order' => 10,
    ]);
    LearnerRouteProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'status' => 'in_progress',
        'last_entered_at' => now(),
    ]);
    LearningNodeBookmark::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
    ]);

    $this->actingAs($user)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('home')
            ->has('desk.currentRoutes', 1)
            ->where('desk.currentRoutes.0.nodeTitle', 'Heart valves')
            ->where('desk.currentRoutes.0.routeLabel', 'Follow the blood flow')
            ->where('desk.currentRoutes.0.currentActivityTitle', 'Observe the flow')
            ->where('desk.currentRoutes.0.imageUrl', '/images/heart.png')
            ->where('desk.currentRoutes.0.learningIntent', 'participate')
            ->where('desk.currentRoutes.0.learningAreas.0.name', 'Circulation')
            ->where('desk.currentRoutes.0.learningAreas.0.slug', 'circulation')
            ->where('desk.currentRoutes.0.nodeHref', '/world?map=circulation&focused=heart-valves')
            ->has('desk.bookmarks', 1)
            ->where('desk.bookmarks.0.title', 'Heart valves')
            ->where('desk.bookmarks.0.topic.title', 'Circulation')
            ->where('desk.bookmarks.0.topic.href', '/topics/circulation-topic')
            ->where('desk.featuredBookmark.title', 'Heart valves')
        );
});

test('the learning desk keeps a quiet trail of recently completed routes', function () {
    $user = User::factory()->create();
    $area = LearningTopicArea::query()->create([
        'slug' => 'recent-area',
        'title' => 'Recent Area',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'recent-topic',
        'title' => 'Recent Topic',
        'is_published' => true,
    ]);
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'learning_topic_id' => $topic->id,
        'slug' => 'recent-map',
        'title' => 'Recent Map',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'recent-node',
        'title' => 'Recent Node',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'recent-activity',
        'title' => 'Recent Activity',
        'type' => 'markdown',
        'sort_order' => 10,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Explore again',
        'sort_order' => 10,
    ]);
    LearnerRouteProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'status' => 'completed',
        'last_completed_at' => now(),
    ]);

    $this->actingAs($user)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('desk.recentRoutes', 1)
            ->where('desk.recentRoutes.0.routeLabel', 'Explore again')
            ->where('desk.recentRoutes.0.nodeTitle', 'Recent Node')
            ->where('desk.recentRoutes.0.learningIntent', 'participate')
            ->where('desk.recentRoutes.0.topic.title', 'Recent Topic')
            ->where('desk.recentRoutes.0.topic.href', '/topics/recent-topic')
            ->where('desk.recentRoutes.0.mapHref', '/world?map=recent-map')
            ->where('desk.recentRoutes.0.nodeHref', '/world?map=recent-map&focused=recent-node')
            ->where('desk.recentRoutes.0.href', '/learning/nodes/'.$node->id.'/play?route='.$start->id)
        );
});

test('the learning desk does not repeat an active route in recent traces', function () {
    $user = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'active-route-map',
        'title' => 'Active Route Map',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'active-route-node',
        'title' => 'Active Route Node',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'active-route-activity',
        'title' => 'Active Route Activity',
        'type' => 'markdown',
        'sort_order' => 10,
    ]);
    $completedActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'completed-route-activity',
        'title' => 'Completed Route Activity',
        'type' => 'markdown',
        'sort_order' => 20,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Continue route',
        'sort_order' => 10,
    ]);
    $completedStart = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $completedActivity->id,
        'label' => 'Explore another route',
        'sort_order' => 20,
    ]);
    LearnerRouteProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'status' => 'in_progress',
        'last_entered_at' => now(),
    ]);
    LearnerRouteProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $completedStart->id,
        'start_learning_activity_id' => $completedActivity->id,
        'status' => 'completed',
        'last_completed_at' => now()->subDay(),
    ]);

    $this->actingAs($user)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('desk.currentRoutes', 1)
            ->has('desk.recentRoutes', 0)
        );
});

test('the learning desk shows recent private learning check-ins without treating them as progress scores', function () {
    Carbon::setTestNow('2026-08-26 16:00:00');
    $user = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'pulse-map',
        'title' => 'Pulse Map',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'pulse-node',
        'title' => 'Pulse Node',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'pulse-activity',
        'title' => 'Pulse Activity',
        'type' => 'markdown',
        'sort_order' => 10,
    ]);
    LearnerActivityProgress::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subMinute(),
        'completed_at' => now()->subMinute(),
        'metadata' => [
            'learningCheckIn' => [
                'feeling' => 'forming',
                'recordedAt' => now()->toIso8601String(),
            ],
        ],
    ]);

    $this->actingAs($user)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('home')
            ->has('desk.checkIns', 1)
            ->where('desk.checkIns.0.activityTitle', 'Pulse Activity')
            ->where('desk.checkIns.0.feeling', 'forming')
            ->where('desk.checkIns.0.activityHref', route('learning.nodes.play', [
                'activity_id' => $activity->id,
                'node' => $node,
            ]))
        );
});
