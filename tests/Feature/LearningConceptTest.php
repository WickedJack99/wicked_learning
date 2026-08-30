<?php

use App\Learning\Queries\LoadLearningConcepts;
use App\Models\LearningConcept;
use App\Models\LearningNode;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('admins can maintain reusable learning concepts and use them in activity authoring', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

    $this->actingAs($admin)
        ->patch(route('settings.admin-panel.learning-concepts.update'), [
            'concepts' => [
                [
                    'description' => 'The effort needed to hold information in mind.',
                    'is_active' => true,
                    'name' => 'Cognitive load',
                ],
                [
                    'description' => null,
                    'is_active' => false,
                    'name' => 'Working memory',
                ],
            ],
        ])
        ->assertRedirect();

    expect(LearningConcept::query()->orderBy('name')->pluck('name')->all())
        ->toBe(['Cognitive load', 'Working memory'])
        ->and(app(LoadLearningConcepts::class)->names())
        ->toBe(['Cognitive load']);

    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'map' => $node->learning_map_id,
            'node' => $node->id,
            'panel' => 'admin-world-builder',
            'worldView' => 'nodes',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedWorldNode.activityGraph.evidenceConceptOptions', ['Cognitive load'])
        );
});

test('learning concept maintenance has its own permission boundary', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $learner = User::factory()->create(['role' => User::ROLE_USER]);

    $this->actingAs($learner)
        ->patch(route('settings.admin-panel.learning-concepts.update'), [
            'concepts' => [[
                'description' => null,
                'is_active' => true,
                'name' => 'Private concept',
            ]],
        ])
        ->assertForbidden();
});
