<?php

use App\Learning\Serializers\SharedTaskStateSerializer;
use App\Learning\Services\SharedTaskActivityConfiguration;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningSharedTaskReview;
use App\Models\LearningSharedTaskReviewFollowUp;
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

test('learners can keep a private project checklist for the active run', function () {
    [$learner, $activity, $runId] = activeSharedTask([
        'projectSteps' => ['Collect clues', 'Compare interpretations', 'Write a conclusion'],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-checklist.update', $activity), [
            'completed_step_indexes' => [2, 0, 2],
            'play_run_id' => $runId,
        ])
        ->assertOk()
        ->assertJsonPath('state.completedStepIndexes', [0, 2]);

    expect(LearnerRouteProgress::query()
        ->where('user_id', $learner->id)
        ->where('current_play_run_id', $runId)
        ->firstOrFail()
        ->metadata['activityStates'][(string) $activity->id]['sharedTask']['completedStepIndexes'] ?? null)
        ->toBe([0, 2]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-checklist.update', $activity), [
            'completed_step_indexes' => [3],
            'play_run_id' => $runId,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('completed_step_indexes');
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

test('shared task contributions can optionally name the project step they support', function () {
    [$learner, $activity, $runId] = activeSharedTask([
        'projectSteps' => ['Collect clues', 'Compare interpretations'],
        'showContributions' => true,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'This contribution compares the two observations carefully.',
            'play_run_id' => $runId,
            'project_step_index' => 1,
            'share_with_peers' => true,
        ])
        ->assertOk()
        ->assertJsonPath('state.contributions.0.projectStep', 'Compare interpretations');

    expect(LearningSharedTaskSubmission::query()->firstOrFail()->metadata)
        ->toMatchArray([
            'projectStepIndex' => 1,
        ]);
});

test('shared task submissions reject project steps that are not configured', function () {
    [$learner, $activity, $runId] = activeSharedTask([
        'projectSteps' => ['Collect clues'],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'This contribution names a step that does not exist.',
            'play_run_id' => $runId,
            'project_step_index' => 1,
        ])
        ->assertStatus(422);

    expect(LearningSharedTaskSubmission::query()->count())->toBe(0);
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

test('shared task peer review requires a contribution and can be submitted once', function () {
    [$firstLearner, $activity, $firstRunId] = activeSharedTask([
        'peerReviewEnabled' => true,
        'showContributions' => true,
        'threshold' => 5,
        'projectSteps' => ['Collect clues', 'Compare interpretations'],
    ]);
    [$secondLearner, , $secondRunId] = activeSharedTaskFor($activity);

    $this->actingAs($firstLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The first learner noticed a useful pattern.',
            'play_run_id' => $firstRunId,
            'share_with_peers' => true,
        ])
        ->assertOk();

    $reviewable = $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The second learner adds another perspective.',
            'play_run_id' => $secondRunId,
            'share_with_peers' => true,
        ])
        ->assertOk()
        ->assertJsonPath('state.peerReview.enabled', true)
        ->json('state.peerReview.reviewableContributions');

    expect($reviewable)->toHaveCount(1);

    $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-reviews.store', $activity), [
            'body' => 'This connects the two observations clearly.',
            'play_run_id' => $secondRunId,
            'submission_id' => $reviewable[0]['id'],
            'response_type' => 'explanation',
            'project_step_index' => 1,
        ])
        ->assertOk()
        ->assertJsonPath('state.peerReview.hasReviewed', true)
        ->assertJsonPath('review.responseType', 'explanation')
        ->assertJsonPath('review.projectStepIndex', 1)
        ->assertJsonPath('state.peerReview.receivedReviews', []);

    $firstLearnerState = app(SharedTaskStateSerializer::class)->state($activity, $firstLearner, true);
    $secondLearnerState = app(SharedTaskStateSerializer::class)->state($activity, $secondLearner, true);

    expect($firstLearnerState['peerReview']['receivedReviews'])->toHaveCount(1)
        ->and($firstLearnerState['peerReview']['receivedReviews'][0]['body'])
        ->toBe('This connects the two observations clearly.')
        ->and($firstLearnerState['peerReview']['receivedReviews'][0]['responseType'])
        ->toBe('explanation')
        ->and($firstLearnerState['peerReview']['receivedReviews'][0]['projectStep'])
        ->toBe('Compare interpretations')
        ->and($secondLearnerState['peerReview']['receivedReviews'])->toBeEmpty();

    $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-reviews.store', $activity), [
            'body' => 'A second response is not allowed.',
            'play_run_id' => $secondRunId,
            'submission_id' => $reviewable[0]['id'],
        ])
        ->assertStatus(422);

    expect(LearningSharedTaskReview::query()->count())->toBe(1)
        ->and(LearningSharedTaskReview::query()->firstOrFail()->body)
        ->toBe('This connects the two observations clearly.')
        ->and(LearningSharedTaskReview::query()->firstOrFail()->response_type)
        ->toBe('explanation')
        ->and(LearningSharedTaskReview::query()->firstOrFail()->project_step_index)
        ->toBe(1);
});

test('shared task peer reviews reject project steps that are not configured', function () {
    [$firstLearner, $activity, $firstRunId] = activeSharedTask([
        'peerReviewEnabled' => true,
        'showContributions' => true,
        'projectSteps' => ['Collect clues'],
    ]);
    [$secondLearner, , $secondRunId] = activeSharedTaskFor($activity);

    $this->actingAs($firstLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The first learner noticed a useful pattern.',
            'play_run_id' => $firstRunId,
            'share_with_peers' => true,
        ])
        ->assertOk();

    $reviewable = $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The second learner adds another perspective.',
            'play_run_id' => $secondRunId,
            'share_with_peers' => true,
        ])
        ->assertOk()
        ->json('state.peerReview.reviewableContributions');

    $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-reviews.store', $activity), [
            'body' => 'This response names a missing project step.',
            'play_run_id' => $secondRunId,
            'submission_id' => $reviewable[0]['id'],
            'project_step_index' => 1,
        ])
        ->assertStatus(422);

    expect(LearningSharedTaskReview::query()->count())->toBe(0);
});

test('shared task peer review rejects unsupported response types', function () {
    [$firstLearner, $activity, $firstRunId] = activeSharedTask([
        'peerReviewEnabled' => true,
        'showContributions' => true,
    ]);
    [$secondLearner, , $secondRunId] = activeSharedTaskFor($activity);

    $this->actingAs($firstLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The first learner noticed a useful pattern.',
            'play_run_id' => $firstRunId,
            'share_with_peers' => true,
        ])
        ->assertOk();

    $reviewable = $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The second learner adds another perspective.',
            'play_run_id' => $secondRunId,
            'share_with_peers' => true,
        ])
        ->assertOk()
        ->json('state.peerReview.reviewableContributions');

    $this->actingAs($secondLearner)
        ->postJson(route('learning.activities.shared-task-reviews.store', $activity), [
            'body' => 'This response needs a supported label.',
            'play_run_id' => $secondRunId,
            'submission_id' => $reviewable[0]['id'],
            'response_type' => 'unsupported',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('response_type');

    expect(LearningSharedTaskReview::query()->count())->toBe(0);
});

test('shared task contributors can mark one received peer review helpful', function () {
    [$owner, $activity, $ownerRunId] = activeSharedTask([
        'peerReviewEnabled' => true,
        'showContributions' => true,
        'threshold' => 5,
    ]);
    [$firstReviewer, , $firstReviewerRunId] = activeSharedTaskFor($activity);
    [$secondReviewer, , $secondReviewerRunId] = activeSharedTaskFor($activity);

    $this->actingAs($owner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The owner contribution gives peers a clear pattern to examine.',
            'play_run_id' => $ownerRunId,
            'share_with_peers' => true,
        ])
        ->assertOk();

    $ownerSubmission = LearningSharedTaskSubmission::query()
        ->where('learning_activity_id', $activity->id)
        ->where('user_id', $owner->id)
        ->firstOrFail();

    $this->actingAs($firstReviewer)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The first reviewer adds a careful explanation for the group.',
            'play_run_id' => $firstReviewerRunId,
            'share_with_peers' => true,
        ])
        ->assertOk();

    $firstReview = LearningSharedTaskReview::query()->create([
        'learning_activity_id' => $activity->id,
        'learning_shared_task_submission_id' => $ownerSubmission->id,
        'user_id' => $firstReviewer->id,
        'body' => 'This explanation helped me connect the two observations.',
        'response_type' => 'explanation',
    ]);

    $this->actingAs($secondReviewer)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The second reviewer adds a different example for the group.',
            'play_run_id' => $secondReviewerRunId,
            'share_with_peers' => true,
        ])
        ->assertOk();

    $secondReview = LearningSharedTaskReview::query()->create([
        'learning_activity_id' => $activity->id,
        'learning_shared_task_submission_id' => $ownerSubmission->id,
        'user_id' => $secondReviewer->id,
        'body' => 'This example helped me see the pattern in a new setting.',
        'response_type' => 'example',
    ]);

    $this->actingAs($firstReviewer)
        ->patchJson(route('learning.activities.shared-task-reviews.helpfulness.update', [$activity, $firstReview]), [
            'helpful' => true,
            'play_run_id' => $firstReviewerRunId,
        ])
        ->assertUnprocessable();

    $this->actingAs($owner)
        ->patchJson(route('learning.activities.shared-task-reviews.helpfulness.update', [$activity, $firstReview]), [
            'helpful' => true,
            'play_run_id' => $ownerRunId,
        ])
        ->assertOk()
        ->assertJsonPath('helpful', true);

    expect($firstReview->refresh()->helpful_at)->not->toBeNull();

    $this->actingAs($owner)
        ->patchJson(route('learning.activities.shared-task-reviews.helpfulness.update', [$activity, $secondReview]), [
            'helpful' => true,
            'play_run_id' => $ownerRunId,
        ])
        ->assertOk();

    expect($firstReview->refresh()->helpful_at)->toBeNull()
        ->and($secondReview->refresh()->helpful_at)->not->toBeNull();

    $this->actingAs($owner)
        ->patchJson(route('learning.activities.shared-task-reviews.helpfulness.update', [$activity, $secondReview]), [
            'helpful' => false,
            'play_run_id' => $ownerRunId,
        ])
        ->assertOk()
        ->assertJsonPath('helpful', false);

    expect($secondReview->refresh()->helpful_at)->toBeNull();
});

test('shared task contributors can keep a private follow-up note about peer feedback', function () {
    [$owner, $activity, $ownerRunId] = activeSharedTask([
        'peerReviewEnabled' => true,
        'showContributions' => true,
    ]);
    [$reviewer, , $reviewerRunId] = activeSharedTaskFor($activity);

    $this->actingAs($owner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'The owner contribution gives peers a clear pattern to examine.',
            'play_run_id' => $ownerRunId,
            'share_with_peers' => true,
        ])
        ->assertOk();

    $ownerSubmission = LearningSharedTaskSubmission::query()
        ->where('learning_activity_id', $activity->id)
        ->where('user_id', $owner->id)
        ->firstOrFail();
    $review = LearningSharedTaskReview::query()->create([
        'learning_activity_id' => $activity->id,
        'learning_shared_task_submission_id' => $ownerSubmission->id,
        'user_id' => $reviewer->id,
        'body' => 'This response helped me connect the two observations.',
        'response_type' => 'explanation',
    ]);

    $this->actingAs($owner)
        ->patchJson(route('learning.activities.shared-task-reviews.follow-up.update', [$activity, $review]), [
            'body' => 'I will compare both observations before choosing my next step.',
            'play_run_id' => $ownerRunId,
        ])
        ->assertOk()
        ->assertJsonPath('followUp.body', 'I will compare both observations before choosing my next step.')
        ->assertJsonPath('state.peerReview.receivedReviews.0.followUp', 'I will compare both observations before choosing my next step.');

    expect(LearningSharedTaskReviewFollowUp::query()->count())->toBe(1);

    $this->actingAs($reviewer)
        ->patchJson(route('learning.activities.shared-task-reviews.follow-up.update', [$activity, $review]), [
            'body' => 'This must stay private to the contributor.',
            'play_run_id' => $reviewerRunId,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('review');

    expect(LearningSharedTaskReviewFollowUp::query()->firstOrFail()->body)
        ->toBe('I will compare both observations before choosing my next step.');

    $this->actingAs($owner)
        ->patchJson(route('learning.activities.shared-task-reviews.follow-up.update', [$activity, $review]), [
            'body' => null,
            'play_run_id' => $ownerRunId,
        ])
        ->assertOk()
        ->assertJsonPath('followUp', null)
        ->assertJsonPath('state.peerReview.receivedReviews.0.followUp', null);

    expect(LearningSharedTaskReviewFollowUp::query()->count())->toBe(0);
});

test('shared task reviews stay hidden for private contributions', function () {
    [$owner, $activity, $ownerRunId] = activeSharedTask([
        'peerReviewEnabled' => true,
        'showContributions' => true,
    ]);
    [$reviewer] = activeSharedTaskFor($activity);

    $this->actingAs($owner)
        ->postJson(route('learning.activities.shared-task-submissions.store', $activity), [
            'body' => 'This contribution was intentionally kept private.',
            'play_run_id' => $ownerRunId,
            'share_with_peers' => false,
        ])
        ->assertOk();

    $privateSubmission = LearningSharedTaskSubmission::query()
        ->where('learning_activity_id', $activity->id)
        ->where('user_id', $owner->id)
        ->firstOrFail();
    $review = LearningSharedTaskReview::query()->create([
        'learning_activity_id' => $activity->id,
        'learning_shared_task_submission_id' => $privateSubmission->id,
        'user_id' => $reviewer->id,
        'body' => 'This should never be shown for a private contribution.',
    ]);

    $state = app(SharedTaskStateSerializer::class)->state($activity, $owner, true);

    expect($state['peerReview']['receivedReviews'])->toBeEmpty();

    $this->actingAs($owner)
        ->patchJson(route('learning.activities.shared-task-reviews.helpfulness.update', [$activity, $review]), [
            'helpful' => true,
            'play_run_id' => $ownerRunId,
        ])
        ->assertUnprocessable();
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
