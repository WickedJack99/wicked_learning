<?php

use App\Learning\Services\SharedTaskActivityConfiguration;
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

test('shared task configuration normalizes an optional project brief', function () {
    $config = app(SharedTaskActivityConfiguration::class)->fromData([
        'shared_task_project_goal' => 'Compare the observations.',
        'shared_task_project_deliverable' => 'A short group explanation.',
        'shared_task_project_steps' => "Collect clues\n\nCompare interpretations\n".str_repeat("Extra step\n", 8),
    ]);

    expect($config['projectGoal'])->toBe('Compare the observations.')
        ->and($config['projectDeliverable'])->toBe('A short group explanation.')
        ->and($config['projectSteps'])->toHaveCount(6)
        ->and($config['projectSteps'][0])->toBe('Collect clues');
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

test('shared task submissions preserve the configured contribution kind', function () {
    [$learner, $activity, $runId] = activeSharedTask([
        'taskKind' => 'question',
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'What clue should we investigate next?',
            'play_run_id' => $runId,
        ])
        ->assertOk();

    expect(LearningSharedTaskSubmission::query()->firstOrFail()->metadata)
        ->toMatchArray([
            'taskKind' => 'question',
        ]);
});

test('shared task contribution sharing requires author and learner opt in', function () {
    [$firstLearner, $activity, $firstRunId] = activeSharedTask([
        'showContributions' => true,
    ]);
    [$secondLearner, , $secondRunId] = activeSharedTaskFor($activity);

    $this->actingAs($firstLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'A contribution shared with later learners.',
            'play_run_id' => $firstRunId,
            'share_with_peers' => true,
        ])
        ->assertOk()
        ->assertJsonPath('state.hasSubmitted', true)
        ->assertJsonPath('state.contributions.0.body', 'A contribution shared with later learners.');

    $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'A private contribution for the shared task.',
            'play_run_id' => $secondRunId,
            'share_with_peers' => false,
        ])
        ->assertOk()
        ->assertJsonCount(1, 'state.contributions');

    expect(LearningSharedTaskSubmission::query()->latest('id')->firstOrFail()->metadata)
        ->toMatchArray(['shareWithPeers' => false]);
});

test('shared task contributions stay private when the author has not enabled sharing', function () {
    [$learner, $activity, $runId] = activeSharedTask();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The learner requested sharing but the author did not allow it.',
            'play_run_id' => $runId,
            'share_with_peers' => true,
        ])
        ->assertOk()
        ->assertJsonCount(0, 'state.contributions');

    expect(LearningSharedTaskSubmission::query()->firstOrFail()->metadata)
        ->toMatchArray(['shareWithPeers' => false]);
});

test('shared task playback keeps the anonymous contribution sample bounded', function () {
    [$firstLearner, $activity, $firstRunId] = activeSharedTask([
        'showContributions' => true,
        'threshold' => 20,
        'repeatPolicy' => 'unlimited',
    ]);

    for ($number = 1; $number <= 7; $number++) {
        [$learner, , $runId] = $number === 1
            ? [$firstLearner, $activity, $firstRunId]
            : activeSharedTaskFor($activity);

        $response = $this->actingAs($learner)
            ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
                'body' => "Contribution {$number} with enough useful context.",
                'play_run_id' => $runId,
                'share_with_peers' => true,
            ])
            ->assertOk();
    }

    $response
        ->assertJsonCount(5, 'state.contributions')
        ->assertJsonPath('state.contributions.0.body', 'Contribution 7 with enough useful context.')
        ->assertJsonPath('state.contributions.4.body', 'Contribution 3 with enough useful context.');
});

test('shared task contribution samples bound displayed text', function () {
    [$learner, $activity, $runId] = activeSharedTask([
        'showContributions' => true,
    ]);
    $body = str_repeat('A useful shared observation. ', 40);

    $response = $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => $body,
            'play_run_id' => $runId,
            'share_with_peers' => true,
        ])
        ->assertOk()
        ->assertJsonPath('state.contributions.0.truncated', true);

    expect($response->json('state.contributions.0.body'))
        ->toHaveLength(500)
        ->and(LearningSharedTaskSubmission::query()->firstOrFail()->body)->toBe(trim($body));
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
