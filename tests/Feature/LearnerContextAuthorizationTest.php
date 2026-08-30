<?php

use App\Models\LearnerQuestionAnswer;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Str;

test('learner mutations reject activities on maps outside the learners access', function () {
    $learner = User::factory()->create();
    [$activity, $question, $option] = contextActivity([User::ROLE_ADMIN]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'status' => 'completed',
        ])
        ->assertNotFound();

    $this->actingAs($learner)
        ->postJson(route('learning.questions.answer', $question), [
            'option_id' => $option->id,
        ])
        ->assertNotFound();

    expect(LearnerQuestionAnswer::query()->count())->toBe(0)
        ->and($activity->fresh()->id)->toBe($activity->id);
});

test('a question answer must belong to the current activity in its play run', function () {
    $learner = User::factory()->create();
    [$currentActivity] = contextActivity();
    $start = LearningActivityStart::query()->create([
        'learning_node_id' => $currentActivity->learning_node_id,
        'learning_activity_id' => $currentActivity->id,
        'label' => 'Context route',
        'sort_order' => 10,
    ]);
    [$otherActivity, $question, $option] = contextActivityForMap($currentActivity->node->map);
    $runId = (string) Str::uuid();

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $currentActivity->learning_node_id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $currentActivity->id,
        'current_learning_activity_id' => $currentActivity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
        'started_at' => now(),
        'last_entered_at' => now(),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.questions.answer', $question), [
            'option_id' => $option->id,
            'play_run_id' => $runId,
        ])
        ->assertNotFound();

    expect($otherActivity->fresh()->id)->toBe($otherActivity->id)
        ->and(LearnerQuestionAnswer::query()->count())->toBe(0);
});

/**
 * @param  list<string>  $accessRoles
 * @return array{LearningActivity, LearningQuestion, LearningQuestionOption}
 */
function contextActivity(array $accessRoles = []): array
{
    $world = LearningWorld::query()->create([
        'slug' => 'context-world-'.Str::random(8),
        'title' => 'Context World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'context-map-'.Str::random(8),
        'title' => 'Context Map',
        'access_roles' => $accessRoles,
    ]);

    return contextActivityForMap($map);
}

/**
 * @return array{LearningActivity, LearningQuestion, LearningQuestionOption}
 */
function contextActivityForMap(LearningMap $map): array
{
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'context-node-'.Str::random(8),
        'title' => 'Context Node',
        'position_q' => random_int(-1000, 1000),
        'position_r' => random_int(-1000, 1000),
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'context-activity-'.Str::random(8),
        'type' => 'question',
        'title' => 'Context Activity',
        'config' => [],
    ]);
    $question = LearningQuestion::query()->create([
        'learning_activity_id' => $activity->id,
        'prompt' => 'Which context fits?',
    ]);
    $option = LearningQuestionOption::query()->create([
        'learning_question_id' => $question->id,
        'label' => 'A',
        'body' => 'The context fits.',
        'is_correct' => true,
        'sort_order' => 10,
    ]);

    return [$activity, $question, $option];
}
