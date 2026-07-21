<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('admin panel includes world map management data', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

    LearningWorld::query()
        ->where('slug', CurrentWorldResolver::DEFAULT_WORLD_SLUG)
        ->delete();

    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Admin World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'admin-map',
        'title' => 'Admin Map',
    ]);
    LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'admin-node',
        'title' => 'Admin Node',
        'position_q' => 0,
        'position_r' => 0,
    ]);

    $this->actingAs($admin)
        ->get(route('settings.admin-panel.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/admin-panel')
            ->where('worldGraph.world.title', 'Admin World')
            ->where('worldGraph.maps.0.title', 'Admin Map')
            ->where('worldGraph.maps.0.nodeCount', 1)
            ->where('worldGraph.maps.0.nodes.0.title', 'Admin Node')
        );
});
