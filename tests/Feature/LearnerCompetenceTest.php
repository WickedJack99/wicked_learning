<?php

use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Learning\Queries\LoadLearnerSupportSignals;
use App\Learning\Services\LearnerCompetenceService;
use App\Models\ActivityTransition;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerCompetenceTopicTransition;
use App\Models\LearnerEvidenceEvent;
use App\Models\LearnerQuestionAnswer;
use App\Models\LearnerReviewAttempt;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\LearningWorld;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;

test('the demo route seeds competence evidence metadata', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $activity = LearningActivity::query()
        ->where('slug', 'read-the-first-signal')
        ->firstOrFail();
    $map = LearningMap::query()
        ->where('slug', 'first-sector')
        ->firstOrFail()
        ->load('topic');

    expect($activity->config['learningIntent'])->toBe('retrieve')
        ->and($activity->config['competenceTopics'])->toBe([
            [
                'slug' => 'pattern-recognition',
                'topic' => 'Pattern recognition',
                'weight' => 1,
            ],
        ])
        ->and($map->topic?->title)->toBe('Pattern investigation')
        ->and(CompetenceTopicDefinition::query()
            ->where('slug', 'pattern-recognition')
            ->exists())->toBeTrue();
});

test('the demo route gives its practice activities a shared competence vocabulary', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $activities = LearningActivity::query()
        ->whereIn('slug', [
            'guided-signal-dialogue',
            'clear-the-noisy-gate',
            'write-a-field-note',
        ])
        ->get()
        ->keyBy('slug');

    expect($activities)->toHaveCount(3);

    foreach ($activities as $activity) {
        expect($activity->config['competenceTopics'])->toHaveCount(2)
            ->and($activity->config['competenceTopics'][0]['slug'])
            ->toBe('pattern-recognition')
            ->and($activity->config['competenceTopics'][1]['slug'])
            ->toBe('investigation-focus');
    }

    expect($activities['guided-signal-dialogue']->config['learningIntent'])
        ->toBe('explain')
        ->and($activities['clear-the-noisy-gate']->config['learningIntent'])
        ->toBe('apply')
        ->and($activities['write-a-field-note']->config['learningIntent'])
        ->toBe('reflect');
});

test('a demo topic exposes authored learning areas before evidence exists', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $this->actingAs(User::factory()->create())
        ->get(route('topics.show', 'pattern-investigation'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('topic.learningAreas', 2)
            ->where('topic.learningAreas.0.name', 'Investigation focus')
            ->where('topic.learningAreas.0.slug', 'investigation-focus')
            ->where('topic.learningAreas.1.name', 'Pattern recognition')
            ->where('topic.learningAreas.1.slug', 'pattern-recognition')
        );
});

test('a topic shows private reflections connected to its learning areas', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $learner = User::factory()->create();
    $activity = LearningActivity::query()
        ->where('slug', 'write-a-field-note')
        ->firstOrFail();

    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'completed_at' => now(),
        'metadata' => [
            'learningCheckIns' => [[
                'feeling' => 'forming',
                'recordedAt' => '2026-08-27T10:00:00+00:00',
            ]],
        ],
    ]);

    $this->actingAs($learner)
        ->get(route('topics.show', 'pattern-investigation'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('topic.learningPulse', 1)
            ->where('topic.learningPulse.0.activityTitle', 'Write a field note')
            ->where('topic.learningPulse.0.feeling', 'forming')
            ->where('topic.learningPulse.0.nodeTitle', 'Field Notes')
            ->where('topic.learningPulse.0.activityHref', route('learning.nodes.play', [
                'activity_id' => $activity->id,
                'node' => $activity->node,
            ]))
        );
});

test('a topic shows competence evidence encountered through its map', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    $learner = User::factory()->create();
    $activity = LearningActivity::query()
        ->where('slug', 'guided-signal-dialogue')
        ->firstOrFail();

    LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'pattern-recognition',
        'topic_name' => 'Pattern recognition',
        'evidence_type' => 'explain',
        'contribution' => 1,
        'confidence' => 'leaning',
        'attempt_number' => 2,
    ]);

    $this->actingAs($learner)
        ->get(route('topics.show', 'pattern-investigation'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('topic.competence', null)
            ->where('topic.subtopicCompetence.0.name', 'Pattern recognition')
            ->where('topic.subtopicCompetence.0.slug', 'pattern-recognition')
            ->where('topic.subtopicCompetence.0.evidenceLedger.0.activityTitle', $activity->title)
            ->where('topic.subtopicCompetence.0.evidenceLedger.0.evidenceType', 'explain')
            ->where('topic.subtopicCompetence.0.evidenceLedger.0.confidence', 'leaning')
            ->where('topic.subtopicCompetence.0.evidenceLedger.0.attemptNumber', 2)
        );
});

test('route play completion records configured evidence once per play run', function () {
    Carbon::setTestNow('2026-07-21 10:00:00');

    $learner = User::factory()->create();
    [$node, $activity, $start] = competenceRoute([
        ['topic' => 'Algebra', 'weight' => 2.5],
        ['topic' => 'Systems Thinking', 'weight' => 4],
    ]);
    $activity->update([
        'config' => [
            ...$activity->config,
            'learningIntent' => 'review',
            'feedbackGuidance' => [
                'purpose' => 'Return to the idea and notice what changed.',
            ],
        ],
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
        'last_entered_at' => now()->subMinutes(3),
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
            ->value('evidence_type'))->toBe('review')
        ->and(LearnerEvidenceEvent::query()
            ->where('user_id', $learner->id)
            ->where('topic_slug', 'algebra')
            ->value('learning_purpose'))
        ->toBe('Return to the idea and notice what changed.')
        ->and(LearnerEvidenceEvent::query()
            ->where('play_run_id', $runId)
            ->pluck('latency_seconds')
            ->map(fn (mixed $value): int => (int) $value)
            ->all())
        ->toBe([180, 180]);
});

test('completion leaves latency unset when the activity entry time is unavailable', function () {
    $learner = User::factory()->create();
    [$node, $activity, $start] = competenceRoute([
        ['topic' => 'Algebra', 'weight' => 1],
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
        'last_entered_at' => null,
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'play_run_id' => $runId,
            'status' => 'completed',
        ])
        ->assertOk();

    expect(LearnerEvidenceEvent::query()
        ->where('play_run_id', $runId)
        ->value('latency_seconds'))
        ->toBeNull();
});

test('explanation and transfer evidence require an observable authored criterion', function () {
    $learner = User::factory()->create();
    [, $explanation] = competenceRoute([
        ['topic' => 'Systems Thinking', 'weight' => 1],
    ]);
    $explanation->update([
        'config' => [
            ...$explanation->config,
            'learningIntent' => 'explain',
        ],
    ]);

    app(LearnerCompetenceService::class)->awardActivityCompletion(
        $learner,
        $explanation,
        (string) Str::uuid(),
    );

    expect(LearnerEvidenceEvent::query()
        ->where('learning_activity_id', $explanation->id)
        ->value('evidence_type'))->toBe('participate');

    [, $transfer] = competenceRoute([
        ['topic' => 'Systems Thinking', 'weight' => 1],
    ]);
    $transfer->update([
        'config' => [
            ...$transfer->config,
            'learningIntent' => 'transfer',
            'feedbackGuidance' => [
                'evidence' => 'Look for the idea working in a changed context.',
            ],
        ],
    ]);

    app(LearnerCompetenceService::class)->awardActivityCompletion(
        $learner,
        $transfer,
        (string) Str::uuid(),
    );

    expect(LearnerEvidenceEvent::query()
        ->where('learning_activity_id', $transfer->id)
        ->value('evidence_type'))->toBe('transfer');
});

test('question answers complete the active route and record retrieval evidence', function () {
    $learner = User::factory()->create();
    [$node, , $start] = competenceRoute([
        ['topic' => 'Algebra', 'weight' => 2],
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'retrieval-question',
        'type' => 'question',
        'title' => 'Retrieval question',
        'config' => [],
        'sort_order' => 20,
    ]);
    $question = LearningQuestion::query()->create([
        'learning_activity_id' => $activity->id,
        'prompt' => 'Which idea fits?',
        'explanation' => 'The first idea fits the evidence.',
    ]);
    $option = LearningQuestionOption::query()->create([
        'learning_question_id' => $question->id,
        'label' => 'A',
        'body' => 'The first idea.',
        'is_correct' => true,
        'sort_order' => 10,
    ]);
    $activity->update([
        'config' => [
            'learningIntent' => 'retrieve',
            'competenceTopics' => [
                ['topic' => 'Algebra', 'slug' => 'algebra', 'weight' => 2],
            ],
        ],
    ]);
    $start->update(['learning_activity_id' => $activity->id]);
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
        ->postJson(route('learning.questions.answer', $question), [
            'confidence' => 'settled',
            'option_id' => $option->id,
            'play_run_id' => $runId,
        ])
        ->assertOk()
        ->assertJsonPath('answer.isCorrect', true)
        ->assertJsonPath('answer.confidence', 'settled')
        ->assertJsonPath('answer.attemptNumber', 1)
        ->assertJsonPath('answer.earlierAttempts', []);

    $this->actingAs($learner)
        ->postJson(route('learning.questions.answer', $question), [
            'confidence' => 'leaning',
            'option_id' => $option->id,
            'play_run_id' => $runId,
        ])
        ->assertOk()
        ->assertJsonPath('answer.confidence', 'leaning')
        ->assertJsonPath('answer.attemptNumber', 2)
        ->assertJsonPath('answer.earlierAttempts.0.confidence', 'settled');

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', $node))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where("progress.answers.{$question->id}.confidence", 'leaning')
            ->where("progress.answers.{$question->id}.earlierAttempts.0.confidence", 'settled')
            ->where("progress.answers.{$question->id}.explanation", 'The first idea fits the evidence.')
        );

    $evidence = LearnerEvidenceEvent::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->where('play_run_id', $runId)
        ->orderBy('attempt_number')
        ->get();

    expect($evidence)->toHaveCount(2)
        ->and($evidence->pluck('evidence_type')->all())->toBe(['retrieve', 'retrieve'])
        ->and($evidence->pluck('outcome')->all())->toBe(['correct', 'correct'])
        ->and($evidence->pluck('confidence')->all())->toBe(['settled', 'leaning'])
        ->and($evidence->pluck('attempt_number')->all())->toBe([1, 2])
        ->and($evidence->pluck('assistance_level')->all())->toBe(['independent', 'independent'])
        ->and($evidence->pluck('contribution')->map(fn (mixed $value): float => (float) $value)->all())->toBe([2.0, 2.0])
        ->and(LearnerRouteProgress::query()
            ->where('user_id', $learner->id)
            ->where('learning_node_id', $node->id)
            ->firstOrFail()->status)
        ->toBe('completed');
});

test('returning to a question keeps its route continuation', function () {
    $learner = User::factory()->create();
    [$node, , $start] = competenceRoute([]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'branched-question',
        'type' => 'question',
        'title' => 'Branched question',
        'config' => [],
        'sort_order' => 20,
    ]);
    $nextActivity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'next-activity',
        'type' => 'markdown',
        'title' => 'Next activity',
        'config' => [],
        'sort_order' => 30,
    ]);
    $question = LearningQuestion::query()->create([
        'learning_activity_id' => $activity->id,
        'prompt' => 'Which idea fits?',
    ]);
    $option = LearningQuestionOption::query()->create([
        'learning_question_id' => $question->id,
        'label' => 'A',
        'body' => 'The first idea.',
        'is_correct' => true,
        'sort_order' => 10,
    ]);
    ActivityTransition::query()->create([
        'from_activity_id' => $activity->id,
        'to_activity_id' => $nextActivity->id,
        'from_connector' => 'correct',
        'to_connector' => 'in',
        'trigger' => 'correct',
        'label' => 'Continue',
    ]);
    $start->update(['learning_activity_id' => $activity->id]);
    LearnerQuestionAnswer::query()->create([
        'user_id' => $learner->id,
        'learning_question_id' => $question->id,
        'learning_question_option_id' => $option->id,
        'is_correct' => true,
        'selected_option_ids' => [$option->id],
        'feedback' => 'That is the useful clue.',
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', $node))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where("progress.answers.{$question->id}.nextActivityId", $nextActivity->id)
        );
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
            'learning_intent' => 'review',
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
        ->and($activity->config['learningIntent'])->toBe('review')
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
    $area = LearningTopicArea::query()->create([
        'slug' => 'mathematics',
        'title' => 'Mathematics',
    ]);
    $learningTopic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'algebra',
        'title' => 'Algebra',
        'is_published' => true,
    ]);
    $olderEvent = LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'algebra',
        'topic_name' => 'Algebra',
        'evidence_type' => 'retrieve',
        'learning_purpose' => 'Recall the central relationship before reviewing it.',
        'contribution' => 3,
        'confidence' => 'settled',
        'attempt_number' => 2,
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
            ->where('competenceMap.recentWindowDays', 30)
            ->where('competenceMap.topics.0.slug', 'algebra')
            ->where('competenceMap.topics.0.name', 'Algebra Foundations')
            ->where('competenceMap.topics.0.relatedTopic.title', 'Algebra')
            ->where('competenceMap.topics.0.relatedTopic.href', route('topics.show', $learningTopic, false))
            ->where('competenceMap.topics.0.visual.sizeRatio', 0.6667)
            ->where('competenceMap.topics.0.visual.brightnessRatio', 0.3125)
            ->where('competenceMap.topics.0.visual.auraRatio', 0.8333)
            ->where('competenceMap.topics.0.visual.sizeTier', 'beacon')
            ->where('competenceMap.topics.0.visual.description', 'A well-established light.')
            ->where('competenceMap.topics.0.visual.learningPeriods', ['Jun 2026', 'Jul 2026'])
            ->where('competenceMap.topics.0.visual.recentDescription', 'Recent learning moments are gently lighting this area.')
            ->where('competenceMap.topics.0.visual.evidenceTypes', ['explain', 'retrieve'])
            ->where('competenceMap.topics.0.visual.evidenceLedger.0.evidenceType', 'explain')
            ->where('competenceMap.topics.0.visual.evidenceLedger.0.evidenceClaim', 'explanation_attempt')
            ->where('competenceMap.topics.0.visual.evidenceLedger.0.activityTitle', $activity->title)
            ->where('competenceMap.topics.0.visual.evidenceLedger.0.activityHref', route('learning.nodes.play', ['activity_id' => $activity->id, 'node' => $activity->node]))
            ->where('competenceMap.topics.0.visual.evidenceLedger.0.nodeTitle', $activity->node->title)
            ->where('competenceMap.topics.0.visual.evidenceLedger.0.nodeHref', route('learning.nodes.play', ['node' => $activity->node]))
            ->where('competenceMap.topics.0.visual.evidenceLedger.1.confidence', 'settled')
            ->where('competenceMap.topics.0.visual.evidenceLedger.1.evidenceClaim', 'retrieval_attempt')
            ->where('competenceMap.topics.0.visual.evidenceLedger.1.attemptNumber', 2)
            ->where('competenceMap.topics.0.visual.evidenceLedger.1.learningPurpose', 'Recall the central relationship before reviewing it.')
            ->where('competenceMap.topics.0.revisit.activityTitle', $activity->title)
            ->where('competenceMap.topics.0.revisit.activityHref', route('learning.nodes.play', ['activity_id' => $activity->id, 'node' => $activity->node]))
            ->where('competenceMap.topics.0.revisit.nodeTitle', $activity->node->title)
            ->where('competenceMap.topics.0.revisit.nodeHref', route('learning.nodes.play', ['node' => $activity->node]))
            ->where('competenceMap.transitions.0.fromTopicSlug', 'algebra')
            ->where('competenceMap.transitions.0.toTopicSlug', 'geometry')
        );
});

test('competence evidence ledger keeps a bounded inspectable window', function () {
    $learner = User::factory()->create();
    [, $activity] = competenceRoute([]);

    foreach (range(1, 13) as $number) {
        LearnerEvidenceEvent::query()->create([
            'user_id' => $learner->id,
            'learning_activity_id' => $activity->id,
            'play_run_id' => (string) Str::uuid(),
            'topic_slug' => 'algebra',
            'topic_name' => 'Algebra',
            'evidence_type' => 'retrieve',
            'contribution' => $number,
        ]);
    }

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('competenceMap.topics.0.visual.evidenceLedger', 12)
        );
});

test('competence map shows bounded review history without private journal text', function () {
    $learner = User::factory()->create();
    [$node, $activity] = competenceRoute([]);
    $progress = LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 2,
        'completed_at' => now(),
        'metadata' => [],
    ]);

    LearnerReviewAttempt::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'learner_activity_progress_id' => $progress->id,
        'attempt_number' => 2,
        'source' => 'revisit',
        'outcome' => 'correct',
        'confidence' => 'leaning',
        'assistance_level' => 'independent',
        'attempted_at' => now(),
        'metadata' => [
            'privateReflection' => 'This text must not be exposed here.',
        ],
    ]);

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('competenceMap.reviewAttempts.0.activityTitle', $activity->title)
            ->where('competenceMap.reviewAttempts.0.activityHref', route('learning.nodes.play', [
                'activity_id' => $activity->id,
                'node' => $node,
            ]))
            ->where('competenceMap.reviewAttempts.0.nodeTitle', $node->title)
            ->where('competenceMap.reviewAttempts.0.outcome', 'correct')
            ->where('competenceMap.reviewAttempts.0.confidence', 'leaning')
            ->where('competenceMap.reviewAttempts.0.attemptNumber', 2)
            ->missing('competenceMap.reviewAttempts.0.metadata')
            ->missing('competenceMap.reviewAttempts.0.privateReflection')
        );
});

test('competence star map keeps recent glow across month boundaries', function () {
    Carbon::setTestNow('2026-08-01 10:00:00');

    $learner = User::factory()->create();
    [, $activity] = competenceRoute([]);
    CompetenceTopicDefinition::query()->create([
        'slug' => 'algebra',
        'name' => 'Algebra Foundations',
        'growth_threshold' => 12,
        'emittance_threshold' => 16,
        'aura_threshold' => 10,
    ]);

    $event = LearnerEvidenceEvent::query()->create([
        'user_id' => $learner->id,
        'learning_activity_id' => $activity->id,
        'play_run_id' => (string) Str::uuid(),
        'topic_slug' => 'algebra',
        'topic_name' => 'Algebra',
        'evidence_type' => 'retrieve',
        'contribution' => 4,
    ]);
    $event->forceFill([
        'created_at' => Carbon::parse('2026-07-15 10:00:00'),
        'updated_at' => Carbon::parse('2026-07-15 10:00:00'),
    ])->save();

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('competenceMap.recentWindowDays', 30)
            ->where('competenceMap.topics.0.visual.brightnessRatio', 0.25)
            ->where('competenceMap.topics.0.visual.auraRatio', 0.4)
            ->where('competenceMap.topics.0.visual.recentDescription', 'A recent learning moment is gently lighting this area.')
        );
});

test('competence star map accepts a topic to open from an activity link', function () {
    $learner = User::factory()->create();

    $this->actingAs($learner)
        ->get(route('competence.index', ['topic' => 'systems-thinking']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('competence/index')
            ->where('selectedTopicSlug', 'systems-thinking')
            ->where('selectedTopic', null)
        );
});

test('competence area links can retain a published topic as return context', function () {
    $learner = User::factory()->create();
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

    $this->actingAs($learner)
        ->get(route('competence.index', [
            'topic' => 'pattern-recognition',
            'from' => $topic->slug,
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedTopicSlug', 'pattern-recognition')
            ->where('selectedTopic.title', 'Astronomy')
            ->where('selectedTopic.href', route('topics.show', $topic, false))
        );
});

test('competence star map exposes only published context for a selected topic', function () {
    $learner = User::factory()->create();
    $area = LearningTopicArea::query()->create([
        'slug' => 'science',
        'title' => 'Science',
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'biology',
        'title' => 'Biology',
        'is_published' => true,
    ]);
    LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'draft-biology',
        'title' => 'Draft Biology',
        'is_published' => false,
    ]);

    $this->actingAs($learner)
        ->get(route('competence.index', ['topic' => $topic->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedTopic.title', 'Biology')
            ->where('selectedTopic.href', route('topics.show', $topic, false))
        );

    $this->actingAs($learner)
        ->get(route('competence.index', ['topic' => 'draft-biology']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('selectedTopic', null)
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
