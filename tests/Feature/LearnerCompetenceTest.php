<?php

use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Learning\Queries\LoadLearnerSupportSignals;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearnerCompetenceTopicTransition;
use App\Models\LearnerEvidenceEvent;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;

test('route play completion records configured evidence once per play run', function () {
    Carbon::setTestNow('2026-07-21 10:00:00');

    $learner = User::factory()->create();
    [$node, $activity, $start] = competenceRoute([
        ['topic' => 'Algebra', 'weight' => 2.5],
        ['topic' => 'Systems Thinking', 'weight' => 4],
    ]);
    $runId = (string) Str::uuid();

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
        'started_at' => now(),
        'last_entered_at' => now(),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'play_run_id' => $runId,
            'status' => 'completed',
        ])
        ->assertOk();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'play_run_id' => $runId,
            'status' => 'completed',
        ])
        ->assertOk();

    expect(LearnerEvidenceEvent::query()->where('user_id', $learner->id)->count())->toBe(2)
        ->and((float) LearnerEvidenceEvent::query()
            ->where('user_id', $learner->id)
            ->where('topic_slug', 'algebra')
            ->value('contribution'))->toBe(2.5)
        ->and(LearnerEvidenceEvent::query()
            ->where('user_id', $learner->id)
            ->where('topic_slug', 'systems-thinking')
            ->value('evidence_type'))->toBe('participate');
});

test('admins can configure competence topics on any activity', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    [, $activity] = competenceRoute([]);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'competence_topics' => [
                ['topic' => 'Creative Problem Solving', 'weight' => 3],
                ['topic' => 'Creative Problem Solving', 'weight' => 4],
                ['topic' => '', 'weight' => 9],
            ],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $activity->node));

    $activity->refresh();

    expect($activity->config['competenceTopics'])->toBe([
        [
            'topic' => 'Creative Problem Solving',
            'slug' => 'creative-problem-solving',
            'weight' => 4,
        ],
    ])
        ->and(CompetenceTopicDefinition::query()
            ->where('slug', 'creative-problem-solving')
            ->value('name'))->toBe('Creative Problem Solving');
});

test('competence topic settings include topics configured on activities', function () {
    competenceRoute([
        ['topic' => 'Activity Only Topic', 'weight' => 2],
    ]);

    $topics = app(LoadCompetenceTopicDefinitions::class)->handle();
    $activityTopic = collect($topics)->firstWhere('slug', 'activity-only-topic');

    expect($activityTopic)
        ->not->toBeNull()
        ->and($activityTopic['name'] ?? null)
        ->toBe('Activity Only Topic');
});

test('route play activity movement records topic transitions', function () {
    $learner = User::factory()->create();
    [$node, $fromActivity, $start] = competenceRoute([
        ['topic' => 'Algebra', 'weight' => 1],
        ['topic' => 'Logic', 'weight' => 1],
    ]);
    $toActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'geometry-step',
        'type' => 'markdown',
        'title' => 'Geometry step',
        'config' => [
            'competenceTopics' => [
                ['topic' => 'Geometry', 'slug' => 'geometry', 'weight' => 1],
                ['topic' => 'Drawing', 'slug' => 'drawing', 'weight' => 1],
            ],
        ],
        'sort_order' => 20,
    ]);
    $runId = (string) Str::uuid();

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $fromActivity->id,
        'current_learning_activity_id' => $fromActivity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
        'started_at' => now(),
        'last_entered_at' => now(),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $fromActivity), [
            'play_run_id' => $runId,
            'status' => 'reached',
        ])
        ->assertOk();

    expect($learner->refresh()->last_competence_topics)->toBe([
        ['slug' => 'algebra', 'topic' => 'Algebra'],
        ['slug' => 'logic', 'topic' => 'Logic'],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $toActivity), [
            'play_run_id' => $runId,
            'status' => 'reached',
        ])
        ->assertOk();

    expect(LearnerCompetenceTopicTransition::query()->where('user_id', $learner->id)->count())->toBe(4)
        ->and(LearnerCompetenceTopicTransition::query()
            ->where('user_id', $learner->id)
            ->where('from_topic_slug', 'algebra')
            ->where('to_topic_slug', 'geometry')
            ->value('transition_count'))->toBe(1)
        ->and($learner->refresh()->last_competence_topics)->toBe([
            ['slug' => 'geometry', 'topic' => 'Geometry'],
            ['slug' => 'drawing', 'topic' => 'Drawing'],
        ]);
});

test('first topic in a new route connects from the user last topic set', function () {
    $learner = User::factory()->create([
        'last_competence_topics' => [
            ['slug' => 'algebra', 'topic' => 'Algebra'],
            ['slug' => 'logic', 'topic' => 'Logic'],
        ],
    ]);
    [$node, $activity, $start] = competenceRoute([
        ['topic' => 'Geometry', 'weight' => 1],
        ['topic' => 'Drawing', 'weight' => 1],
    ]);
    $runId = (string) Str::uuid();

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
        'started_at' => now(),
        'last_entered_at' => now(),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'play_run_id' => $runId,
            'status' => 'reached',
        ])
        ->assertOk();

    expect(LearnerCompetenceTopicTransition::query()->where('user_id', $learner->id)->count())->toBe(4)
        ->and($learner->refresh()->last_competence_topics)->toBe([
            ['slug' => 'geometry', 'topic' => 'Geometry'],
            ['slug' => 'drawing', 'topic' => 'Drawing'],
        ]);
});

test('competence star map shows studied topics and transitions', function () {
    Carbon::setTestNow('2026-07-21 10:00:00');

    $learner = User::factory()->create();

    [, $activity] = competenceRoute([]);
    $olderEvent = LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'algebra',
        'topic_name' => 'Algebra',
        'evidence_type' => 'retrieve',
        'contribution' => 3,
    ]);
    $olderEvent->forceFill([
        'created_at' => Carbon::parse('2026-06-20 10:00:00'),
        'updated_at' => Carbon::parse('2026-06-20 10:00:00'),
    ])->save();
    CompetenceTopicDefinition::query()->create([
        'slug' => 'algebra',
        'name' => 'Algebra Foundations',
        'growth_threshold' => 12,
        'emittance_threshold' => 16,
        'aura_threshold' => 6,
    ]);
    LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'geometry',
        'topic_name' => 'Geometry',
        'evidence_type' => 'apply',
        'contribution' => 3,
    ]);
    LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'algebra',
        'topic_name' => 'Algebra',
        'evidence_type' => 'explain',
        'contribution' => 5,
    ]);
    LearnerCompetenceTopicTransition::query()->create([
        'user_id' => $learner->id,
        'from_topic_slug' => 'algebra',
        'from_topic_name' => 'Algebra',
        'to_topic_slug' => 'geometry',
        'to_topic_name' => 'Geometry',
        'transition_count' => 2,
    ]);

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('competence/index')
            ->where('competenceMap.monthKey', '2026-07')
            ->where('competenceMap.topics.0.slug', 'algebra')
            ->where('competenceMap.topics.0.name', 'Algebra Foundations')
            ->where('competenceMap.topics.0.visual.sizeRatio', 0.6667)
            ->where('competenceMap.topics.0.visual.brightnessRatio', 0.5)
            ->where('competenceMap.topics.0.visual.auraRatio', 0.8333)
            ->where('competenceMap.topics.0.visual.sizeTier', 'beacon')
            ->where('competenceMap.topics.0.visual.description', 'A well-established light.')
            ->where('competenceMap.topics.0.visual.evidenceTypes', ['explain', 'retrieve'])
            ->where('competenceMap.transitions.0.fromTopicSlug', 'algebra')
            ->where('competenceMap.transitions.0.toTopicSlug', 'geometry')
        );
});

test('learning support signals show scoped competence values without ranking learners', function () {
    Carbon::setTestNow('2026-07-21 10:00:00');

    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);
    $learner = User::factory()->create([
        'name' => 'Ada Learner',
    ]);
    [, $activity] = competenceRoute([]);

    LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'systems-thinking',
        'topic_name' => 'Systems Thinking',
        'evidence_type' => 'explain',
        'contribution' => 12,
    ]);
    $event = LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'systems-thinking',
        'topic_name' => 'Systems Thinking',
        'evidence_type' => 'retrieve',
        'contribution' => 4,
    ]);
    $event->forceFill([
        'created_at' => Carbon::parse('2026-07-20 11:00:00'),
        'updated_at' => Carbon::parse('2026-07-20 11:00:00'),
    ])->save();

    $signals = app(LoadLearnerSupportSignals::class)->handle($admin);
    $learnerSignals = collect($signals['learners'])->firstWhere('id', $learner->id);
    $activityBucket = collect($signals['activityOverview30Days'])->firstWhere('date', '2026-07-20');

    expect($signals['monthKey'])->toBe('2026-07')
        ->and($signals['summary']['learnersWithSignals'])->toBe(1)
        ->and($signals['activityOverview30Days'])->toHaveCount(30)
        ->and($activityBucket['activeLearners'] ?? null)->toBe(1)
        ->and($activityBucket['evidenceEvents'] ?? null)->toBe(1)
        ->and($activityBucket['contributionRecorded'] ?? null)->toBe(4.0)
        ->and($learnerSignals['lastActivityAt'] ?? null)->not->toBeNull()
        ->and($learnerSignals['topics'][0]['name'])->toBe('Systems Thinking')
        ->and($learnerSignals['topics'][0]['totalContribution'])->toBe(16.0)
        ->and($learnerSignals['topics'][0]['monthlyContribution'])->toBe(16.0)
        ->and($learnerSignals)->not->toHaveKey('rank');
});

/**
 * @param  list<array{topic: string, weight: float|int}>  $topics
 * @return array{LearningNode, LearningActivity, LearningActivityStart}
 */
function competenceRoute(array $topics): array
{
    $world = LearningWorld::query()->create([
        'slug' => 'competence-world-'.Str::random(8),
        'title' => 'Competence World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'competence-map-'.Str::random(8),
        'title' => 'Competence Map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'competence-node-'.Str::random(8),
        'title' => 'Competence Node',
        'position_q' => 0,
        'position_r' => 0,
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'competence-activity-'.Str::random(8),
        'type' => 'markdown',
        'title' => 'Competence Activity',
        'config' => [
            'competenceTopics' => array_map(
                fn (array $topic): array => [
                    'topic' => $topic['topic'],
                    'slug' => Str::slug($topic['topic']),
                    'weight' => $topic['weight'],
                ],
                $topics,
            ),
        ],
        'sort_order' => 10,
    ]);
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'label' => 'Competence route',
        'sort_order' => 10,
    ]);

    return [$node, $activity, $start];
}
