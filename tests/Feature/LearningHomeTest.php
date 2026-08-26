<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\LearningWorld;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('guests are sent to the public welcome page instead of the learning desk', function () {
    $this->get(route('home'))
        ->assertRedirect(route('welcome'));
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
            ->has('desk.connections', 0)
            ->where('desk.featuredBookmark', null)
        );
});

test('the learning desk presents current work and saved topics', function () {
    $user = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
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
            ->has('desk.bookmarks', 1)
            ->where('desk.bookmarks.0.title', 'Heart valves')
            ->where('desk.featuredBookmark.title', 'Heart valves')
        );
});

test('the learning desk keeps a quiet trail of recently completed routes', function () {
    $user = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
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
            ->where('desk.recentRoutes.0.href', '/learning/nodes/'.$node->id.'/play?route='.$start->id)
        );
});
