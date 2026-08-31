<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearnerActivityAccessService;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskReview;
use App\Models\LearningSharedTaskSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SubmitSharedTaskPeerReview
{
    public function __construct(
        private readonly LearnerActivityAccessService $activityAccess,
    ) {}

    public function handle(
        User $user,
        LearningActivity $activity,
        string $playRunId,
        int $submissionId,
        string $body,
        ?string $responseType = null,
    ): LearningSharedTaskReview {
        abort_unless($activity->type === 'shared_task', 404);
        $this->activityAccess->assertActive($user, $activity, $playRunId);

        $config = is_array($activity->config) ? $activity->config : [];
        abort_unless(
            (bool) ($config['peerReviewEnabled'] ?? false)
            && (bool) ($config['showContributions'] ?? false),
            422,
            'Peer review is not enabled for this shared task.',
        );
        abort_unless(
            LearningSharedTaskSubmission::query()
                ->where('learning_activity_id', $activity->id)
                ->where('user_id', $user->id)
                ->where('status', 'accepted')
                ->exists(),
            422,
            'Contribute before reviewing another learner contribution.',
        );

        $text = trim($body);
        abort_if($text === '', 422, 'The peer review cannot be empty.');

        return DB::transaction(function () use ($activity, $submissionId, $text, $responseType, $user): LearningSharedTaskReview {
            abort_if(
                LearningSharedTaskReview::query()
                    ->where('learning_activity_id', $activity->id)
                    ->where('user_id', $user->id)
                    ->exists(),
                422,
                'You have already reviewed a contribution for this shared task.',
            );

            $submission = LearningSharedTaskSubmission::query()
                ->where('learning_activity_id', $activity->id)
                ->where('status', 'accepted')
                ->where('id', $submissionId)
                ->where('user_id', '!=', $user->id)
                ->where('metadata->shareWithPeers', true)
                ->first();

            abort_unless($submission !== null, 404);

            return LearningSharedTaskReview::query()->create([
                'learning_activity_id' => $activity->id,
                'learning_shared_task_submission_id' => $submission->id,
                'user_id' => $user->id,
                'body' => $text,
                'response_type' => $responseType,
            ]);
        });
    }
}
