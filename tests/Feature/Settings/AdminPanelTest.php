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
        ->assertRedirect(learningSupportRoute('admin-panel'));

    $this->actingAs($admin)
        ->get(learningSupportRoute('admin-panel'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('learningSupportSettings.adminPanel.worldGraph.world.title', 'Admin World')
            ->where('learningSupportSettings.adminPanel.worldGraph.maps.0.title', 'Admin Map')
            ->where('learningSupportSettings.adminPanel.worldGraph.maps.0.nodeCount', 1)
            ->where('learningSupportSettings.adminPanel.worldGraph.maps.0.nodes.0.title', 'Admin Node')
        );
});

test('admins can configure competence topic thresholds from the admin panel', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Admin World',
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.admin-panel.competence-topics.update'), [
            'topics' => [
                [
                    'name' => 'Systems Thinking',
                    'description' => 'Understanding how parts affect a whole.',
                    'growth_threshold' => 30,
                    'emittance_threshold' => 25,
                    'aura_threshold' => 12,
                    'is_active' => true,
                ],
            ],
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('competence_topic_definitions', [
        'slug' => 'systems-thinking',
        'name' => 'Systems Thinking',
        'growth_threshold' => 30,
        'emittance_threshold' => 25,
        'aura_threshold' => 12,
        'is_active' => true,
    ]);

    $this->actingAs($admin)
        ->get(learningSupportRoute('admin-panel'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('learningSupportSettings.adminPanel.competenceTopics.0.slug', 'systems-thinking')
            ->where('learningSupportSettings.adminPanel.competenceTopics.0.growthThreshold', 30)
            ->where('learningSupportSettings.adminPanel.competenceTopics.0.emittanceThreshold', 25)
            ->where('learningSupportSettings.adminPanel.competenceTopics.0.auraThreshold', 12)
        );
});

function learningSupportRoute(string $support): string
{
    return route('settings.index', [
        'panel' => 'admin-learning-support',
        'support' => $support,
    ]);
}
