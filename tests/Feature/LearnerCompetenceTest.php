<?php

use App\Models\LearnerCompetenceActivityAward;
use App\Models\LearnerCompetenceTopic;
use App\Models\LearnerCompetenceTopicMonth;
use App\Models\LearnerCompetenceTopicTransition;
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

test('route play completion awards configured competence topics once per play run', function () {
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

    expect(LearnerCompetenceActivityAward::query()->where('user_id', $learner->id)->count())->toBe(2)
        ->and((float) LearnerCompetenceTopic::query()
            ->where('user_id', $learner->id)
            ->where('topic_slug', 'algebra')
            ->value('total_points'))->toBe(2.5)
        ->and((float) LearnerCompetenceTopicMonth::query()
            ->where('user_id', $learner->id)
            ->where('topic_slug', 'systems-thinking')
            ->where('month_key', '2026-07')
            ->value('points'))->toBe(4.0);
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
    ]);
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

    LearnerCompetenceTopic::query()->create([
        'user_id' => $learner->id,
        'topic_slug' => 'algebra',
        'topic_name' => 'Algebra',
        'total_points' => 8,
    ]);
    LearnerCompetenceTopic::query()->create([
        'user_id' => $learner->id,
        'topic_slug' => 'geometry',
        'topic_name' => 'Geometry',
        'total_points' => 3,
    ]);
    LearnerCompetenceTopicMonth::query()->create([
        'user_id' => $learner->id,
        'topic_slug' => 'algebra',
        'topic_name' => 'Algebra',
        'month_key' => '2026-07',
        'points' => 5,
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
            ->where('competenceMap.topics.0.monthlyPoints', 5)
            ->where('competenceMap.transitions.0.fromTopicSlug', 'algebra')
            ->where('competenceMap.transitions.0.toTopicSlug', 'geometry')
        );
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
