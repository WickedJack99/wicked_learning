<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearnerActivityAccessService;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskReview;
use App\Models\LearningSharedTaskSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Stores one private, learner-controlled revision after peer feedback. */
class ReviseSharedTaskContribution
{
    public function __construct(
        private readonly LearnerActivityAccessService $activityAccess,
    ) {}

    public function handle(
        User $user,
        LearningActivity $activity,
        string $playRunId,
        LearningSharedTaskSubmission $submission,
        string $body,
    ): LearningSharedTaskSubmission {
        abort_unless($activity->type === 'shared_task', 404);
        $this->activityAccess->assertActive($user, $activity, $playRunId);

        $config = is_array($activity->config) ? $activity->config : [];
        abort_unless(
            (bool) ($config['peerReviewEnabled'] ?? false)
                && (bool) ($config['showContributions'] ?? false),
            422,
            'Revisions are not enabled for this shared task.',
        );

        $text = trim($body);
        $validationMode = (string) ($config['validationMode'] ?? 'minimum_length');
        $minimumLength = max(0, (int) ($config['minimumLength'] ?? 20));
        abort_if($text === '', 422, 'The revision cannot be empty.');
        abort_if(
            $validationMode === 'minimum_length' && mb_strlen($text) < $minimumLength,
            422,
            "The revision must be at least {$minimumLength} characters.",
        );

        return DB::transaction(function () use ($activity, $submission, $text, $user): LearningSharedTaskSubmission {
            $lockedSubmission = LearningSharedTaskSubmission::query()
                ->whereKey($submission->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $lockedSubmission->learning_activity_id !== $activity->id
                || $lockedSubmission->user_id !== $user->id
                || $lockedSubmission->status !== 'accepted'
            ) {
                throw ValidationException::withMessages([
                    'submission' => 'Only your own accepted contribution can be revised.',
                ]);
            }

            $metadata = is_array($lockedSubmission->metadata) ? $lockedSubmission->metadata : [];
            abort_unless(
                ($metadata['shareWithPeers'] ?? false) === true,
                422,
                'Only a contribution shared with peers can be revised.',
            );
            abort_unless(
                LearningSharedTaskReview::query()
                    ->where('learning_shared_task_submission_id', $lockedSubmission->id)
                    ->exists(),
                422,
                'Receive peer feedback before revising this contribution.',
            );
            abort_if(
                $lockedSubmission->revised_body !== null,
                422,
                'This contribution has already been revised once.',
            );

            $lockedSubmission->forceFill([
                'revised_body' => $text,
                'revised_at' => now(),
                'metadata' => [
                    ...$metadata,
                    'revisionBodyLength' => mb_strlen($text),
                ],
            ])->save();

            return $lockedSubmission->refresh();
        });
    }
}
