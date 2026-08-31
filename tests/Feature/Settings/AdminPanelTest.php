<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\LearnerJournalPage;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

test('world builder includes world map management data', function () {
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
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'worldSection' => 'structural',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('worldGraph.world.title', 'Admin World')
            ->where('worldGraph.maps.0.title', 'Admin Map')
            ->where('worldGraph.maps.0.nodeCount', 1)
            ->where('worldGraph.maps.0.nodes.0.title', 'Admin Node')
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

test('learning support paginates journal feedback requests in the server payload', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $learner = User::factory()->create();

    foreach (range(1, 7) as $index) {
        $page = LearnerJournalPage::query()->create([
            'user_id' => $learner->id,
            'title' => "Reflection {$index}",
            'topic' => 'Field studies',
            'subtopic' => "Part {$index}",
            'markdown' => "Note {$index}",
            'preferred_mode' => 'view',
        ]);

        LearnerJournalFeedbackRequest::query()->create([
            'learner_journal_page_id' => $page->id,
            'requester_id' => $learner->id,
            'domain_type' => 'journal',
            'domain_label' => 'Journal',
            'requested_at' => now()->subMinutes($index),
        ]);
    }

    $feedbackPageQuery = null;
    DB::listen(function (QueryExecuted $query) use (&$feedbackPageQuery): void {
        if (
            str_contains($query->sql, 'from "learner_journal_feedback_requests"')
            && str_contains($query->sql, 'limit')
        ) {
            $feedbackPageQuery = $query;
        }
    });

    $this->actingAs($admin)
        ->get(learningSupportRoute('feedback-requests').'&feedback_page=2')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('learningSupportSettings.adminPanel.feedbackRequestsPagination.currentPage', 2)
            ->where('learningSupportSettings.adminPanel.feedbackRequestsPagination.lastPage', 2)
            ->where('learningSupportSettings.adminPanel.feedbackRequestsPagination.perPage', 6)
            ->where('learningSupportSettings.adminPanel.feedbackRequestsPagination.total', 7)
            ->has('learningSupportSettings.adminPanel.feedbackRequests', 1)
            ->where('learningSupportSettings.adminPanel.feedbackRequests.0.page.title', 'Reflection 7')
        );

    expect($feedbackPageQuery)->toBeInstanceOf(QueryExecuted::class)
        ->and($feedbackPageQuery->sql)->toContain('limit 6')
        ->and($feedbackPageQuery->sql)->toContain('offset 6');
});

function learningSupportRoute(string $support): string
{
    return route('settings.index', [
        'panel' => 'admin-learning-support',
        'support' => $support,
    ]);
}
