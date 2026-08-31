<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerRecallItem;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

test('a learner can keep a question in a private recall queue', function () {
    [$learner, $question, $activity, $node] = recallQuestionContext();

    $this->actingAs($learner)
        ->postJson(route('learning.questions.recall.store', $question))
        ->assertOk()
        ->assertJson([
            'questionId' => $question->id,
            'queued' => true,
        ]);

    $this->actingAs($learner)
        ->postJson(route('learning.questions.recall.store', $question))
        ->assertOk();

    expect(LearnerRecallItem::query()
        ->where('user_id', $learner->id)
        ->where('learning_question_id', $question->id)
        ->count())->toBe(1);
    expect(LearnerActivityProgress::query()->count())->toBe(0);

    $this->actingAs($learner)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('desk.recallItems', 1)
            ->where('desk.recallItems.0.questionId', $question->id)
            ->where('desk.recallItems.0.deskReason', 'saved_for_recall')
            ->where('desk.recallItems.0.isDue', true)
            ->where('desk.recallItems.0.nextReviewAt', fn ($value) => is_string($value))
            ->where('desk.recallItems.0.prompt', 'What changed?')
            ->where('desk.recallItems.0.activityTitle', $activity->title)
            ->where('desk.recallItems.0.nodeTitle', $node->title)
        );

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', ['node' => $node, 'activity_id' => $activity->id]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('progress.recallQuestionIds', [$question->id])
        );

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', [
            'node' => $node,
            'activity_id' => $activity->id,
            'recall_question' => $question->id,
        ]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('recallQuestionId', $question->id)
        );
});

test('the recall queue keeps older visible questions beyond newer restricted records', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    $learner = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $restrictedMap = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'restricted-recall-map',
        'title' => 'Restricted Recall Map',
        'access_roles' => [User::ROLE_ADMIN],
    ]);
    $visibleMap = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'visible-recall-map',
        'title' => 'Visible Recall Map',
        'access_roles' => [User::ROLE_USER],
    ]);

    $createRecallItem = function (LearningMap $map, string $slug, string $title, int $position) use ($learner): void {
        $node = LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => $slug,
            'title' => $title,
            'position_q' => $position,
            'position_r' => 0,
            'state' => 'available',
        ]);
        $activity = LearningActivity::query()->create([
            'learning_node_id' => $node->id,
            'slug' => "{$slug}-activity",
            'title' => "{$title} activity",
            'type' => 'question',
            'sort_order' => 10,
        ]);
        $question = LearningQuestion::query()->create([
            'learning_activity_id' => $activity->id,
            'prompt' => "Recall {$title}",
        ]);
        LearnerRecallItem::query()->create([
            'user_id' => $learner->id,
            'learning_question_id' => $question->id,
            'next_review_at' => now(),
        ]);
    };

    $createRecallItem($visibleMap, 'visible-recall', 'Visible recall', 0);

    for ($index = 0; $index < 24; $index++) {
        $createRecallItem(
            $restrictedMap,
            "restricted-recall-{$index}",
            "Restricted recall {$index}",
            $index,
        );
    }

    $recallQueries = [];
    DB::listen(function (QueryExecuted $query) use (&$recallQueries): void {
        if (str_contains($query->sql, 'from "learner_recall_items"')) {
            $recallQueries[] = $query;
        }
    });

    $this->actingAs($learner)
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('desk.recallItems', 1)
            ->where('desk.recallItems.0.prompt', 'Recall Visible recall')
            ->where('desk.recallItems.0.mapTitle', 'Visible Recall Map')
        );

    expect($recallQueries)->toHaveCount(1);
    expect($recallQueries[0]->sql)->toMatch('/limit 24/i');
    Carbon::setTestNow();
});

test('a recall answer records a transparent next review interval', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    [$learner, $question] = recallQuestionContext();
    $option = $question->options()->firstOrFail();

    $this->actingAs($learner)
        ->postJson(route('learning.questions.recall.store', $question))
        ->assertOk();

    $this->actingAs($learner)
        ->postJson(route('learning.questions.answer', $question), [
            'confidence' => 'settled',
            'is_recall' => true,
            'option_id' => $option->id,
        ])
        ->assertOk()
        ->assertJsonPath('answer.recall.intervalDays', 1)
        ->assertJsonPath('answer.recall.nextReviewAt', '2026-08-31T14:30:00+00:00');

    $this->actingAs($learner)
        ->postJson(route('learning.questions.recall.feedback', $question), [
            'confidence_after_feedback' => 'leaning',
        ])
        ->assertOk()
        ->assertJsonPath('questionId', $question->id)
        ->assertJsonPath('updated', true);

    $item = LearnerRecallItem::query()->firstOrFail();

    expect($item->review_count)->toBe(1)
        ->and($item->last_outcome)->toBe('correct')
        ->and($item->last_confidence)->toBe('settled')
        ->and($item->last_confidence_after_feedback)->toBe('leaning')
        ->and($item->next_review_at?->toIso8601String())->toBe('2026-08-31T14:30:00+00:00');

    $this->actingAs($learner)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('desk.recallItems.0.isDue', false)
            ->where('desk.recallItems.0.reviewCount', 1)
            ->where('desk.recallItems.0.lastOutcome', 'correct')
            ->where('desk.recallItems.0.lastConfidence', 'settled')
            ->where('desk.recallItems.0.lastConfidenceAfterFeedback', 'leaning')
        );

    Carbon::setTestNow();
});

test('a learner can defer a queued recall without changing its review history', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    [$learner, $question] = recallQuestionContext();
    $item = LearnerRecallItem::query()->create([
        'user_id' => $learner->id,
        'learning_question_id' => $question->id,
        'review_count' => 2,
        'last_outcome' => 'correct',
        'last_confidence' => 'settled',
        'next_review_at' => now(),
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.questions.recall.postpone', $question))
        ->assertOk()
        ->assertJsonPath('questionId', $question->id)
        ->assertJsonPath('nextReviewAt', '2026-08-31T14:30:00+00:00');

    expect($item->refresh()->review_count)->toBe(2)
        ->and($item->last_outcome)->toBe('correct')
        ->and($item->last_confidence)->toBe('settled')
        ->and($item->next_review_at?->toIso8601String())->toBe('2026-08-31T14:30:00+00:00');

    $this->actingAs($learner)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('desk.recallItems.0.isDue', false)
            ->where('desk.recallItems.0.nextReviewAt', '2026-08-31T14:30:00+00:00')
        );

    Carbon::setTestNow();
});

test('recall feedback does not create a missing queue item', function () {
    [$learner, $question] = recallQuestionContext();

    $this->actingAs($learner)
        ->postJson(route('learning.questions.recall.feedback', $question), [
            'confidence_after_feedback' => 'settled',
        ])
        ->assertOk()
        ->assertJsonPath('updated', false);

    expect(LearnerRecallItem::query()->count())->toBe(0);
});

test('a learner can remove a question from the private recall queue', function () {
    [$learner, $question] = recallQuestionContext();

    LearnerRecallItem::query()->create([
        'user_id' => $learner->id,
        'learning_question_id' => $question->id,
    ]);

    $this->actingAs($learner)
        ->deleteJson(route('learning.questions.recall.destroy', $question))
        ->assertOk()
        ->assertJson([
            'questionId' => $question->id,
            'queued' => false,
        ]);

    expect(LearnerRecallItem::query()->count())->toBe(0);
});

test('a learner cannot queue a question from an inaccessible map', function () {
    [$learner, $question] = recallQuestionContext();
    $question->activity->node->map->update(['access_roles' => [User::ROLE_ADMIN]]);

    $this->actingAs($learner)
        ->postJson(route('learning.questions.recall.store', $question))
        ->assertNotFound();

    expect(LearnerRecallItem::query()->count())->toBe(0);
});

/** @return array{User, LearningQuestion, LearningActivity, LearningNode} */
function recallQuestionContext(): array
{
    $learner = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Learning World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'created_by_user_id' => $learner->id,
        'slug' => 'recall-map',
        'title' => 'Recall Map',
        'access_roles' => [User::ROLE_USER],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'recall-node',
        'title' => 'Recall Node',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'recall-activity',
        'type' => 'question',
        'title' => 'Recall Activity',
        'sort_order' => 10,
    ]);
    $question = LearningQuestion::query()->create([
        'learning_activity_id' => $activity->id,
        'prompt' => 'What changed?',
    ]);
    LearningQuestionOption::query()->create([
        'learning_question_id' => $question->id,
        'label' => 'A',
        'body' => 'Something changed.',
        'is_correct' => true,
        'sort_order' => 10,
    ]);

    return [$learner, $question, $activity, $node];
}
