<?php

use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningSharedTaskSubmission;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Str;

test('shared task submissions count across users toward the activity threshold', function () {
    [$firstLearner, $activity, $firstRunId] = activeSharedTask(['threshold' => 2, 'minimumLength' => 5]);
    [$secondLearner, , $secondRunId] = activeSharedTaskFor($activity);

    $this->actingAs($firstLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'First useful note',
            'play_run_id' => $firstRunId,
        ])
        ->assertOk()
        ->assertJsonPath('state.acceptedCount', 1)
        ->assertJsonPath('state.isComplete', false);

    $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'Second useful note',
            'play_run_id' => $secondRunId,
        ])
        ->assertOk()
        ->assertJsonPath('state.acceptedCount', 2)
        ->assertJsonPath('state.isComplete', true);

    expect(LearningSharedTaskSubmission::query()->where('learning_activity_id', $activity->id)->count())->toBe(2);
});

test('shared task submissions enforce configured minimum length', function () {
    [$learner, $activity, $runId] = activeSharedTask(['minimumLength' => 10]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'short',
            'play_run_id' => $runId,
        ])
        ->assertStatus(422);

    expect(LearningSharedTaskSubmission::query()->count())->toBe(0);
});

test('shared task once per user repeat policy rejects a second accepted contribution', function () {
    [$learner, $activity, $runId] = activeSharedTask(['repeatPolicy' => 'once_per_user']);

    $payload = [
        'body' => 'A sufficiently long contribution.',
        'play_run_id' => $runId,
    ];

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), $payload)
        ->assertOk();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), $payload)
        ->assertStatus(422);
});

/** @return array{0: User, 1: LearningActivity, 2: string} */
function activeSharedTask(array $config = []): array
{
    $world = LearningWorld::query()->create([
        'slug' => 'shared-world-'.Str::lower(Str::random(8)),
        'title' => 'Shared world',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'shared-map-'.Str::lower(Str::random(8)),
        'title' => 'Shared map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'shared-node-'.Str::lower(Str::random(8)),
        'title' => 'Shared node',
        'position_q' => 0,
        'position_r' => 0,
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'shared-task-'.Str::lower(Str::random(8)),
        'type' => 'shared_task',
        'title' => 'Shared task',
        'config' => [
            'minimumLength' => 5,
            'repeatPolicy' => 'once_per_user',
            'threshold' => 3,
            'validationMode' => 'minimum_length',
            ...$config,
        ],
        'sort_order' => 10,
    ]);

    return activeSharedTaskFor($activity);
}

/** @return array{0: User, 1: LearningActivity, 2: string} */
function activeSharedTaskFor(LearningActivity $activity): array
{
    $learner = User::factory()->create();
    $runId = (string) Str::uuid();
    $start = LearningActivityStart::query()->firstOrCreate([
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
    ], [
        'label' => 'Start shared task',
        'sort_order' => 10,
    ]);

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_start_id' => $start->id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
    ]);

    return [$learner, $activity, $runId];
}
