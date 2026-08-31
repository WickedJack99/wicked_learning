<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearnerActivityAccessService;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskReview;
use App\Models\LearningSharedTaskReviewFollowUp;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Saves or clears a contributor's private note about received peer feedback. */
class SaveSharedTaskReviewFollowUp
{
    public function __construct(
        private readonly LearnerActivityAccessService $activityAccess,
    ) {}

    public function handle(
        User $user,
        LearningActivity $activity,
        string $playRunId,
        LearningSharedTaskReview $review,
        ?string $body,
    ): ?LearningSharedTaskReviewFollowUp {
        abort_unless($activity->type === 'shared_task', 404);
        $this->activityAccess->assertActive($user, $activity, $playRunId);
        $config = is_array($activity->config) ? $activity->config : [];

        if (($config['peerReviewEnabled'] ?? false) !== true || ($config['showContributions'] ?? false) !== true) {
            abort(404);
        }

        $text = trim((string) $body);

        return DB::transaction(function () use ($activity, $review, $text, $user): ?LearningSharedTaskReviewFollowUp {
            $lockedReview = LearningSharedTaskReview::query()
                ->with('submission')
                ->whereKey($review->id)
                ->lockForUpdate()
                ->firstOrFail();
            $submissionMetadata = $lockedReview->submission?->metadata;

            if (
                $lockedReview->learning_activity_id !== $activity->id
                || $lockedReview->submission?->user_id !== $user->id
                || $lockedReview->submission?->status !== 'accepted'
                || $lockedReview->user_id === $user->id
                || ! is_array($submissionMetadata)
                || ($submissionMetadata['shareWithPeers'] ?? false) !== true
            ) {
                throw ValidationException::withMessages([
                    'review' => 'Only the contributor can save a private note about this response.',
                ]);
            }

            $followUp = LearningSharedTaskReviewFollowUp::query()
                ->where('learning_shared_task_review_id', $lockedReview->id)
                ->where('user_id', $user->id)
                ->first();

            if ($text === '') {
                $followUp?->delete();

                return null;
            }

            return LearningSharedTaskReviewFollowUp::query()->updateOrCreate(
                [
                    'learning_shared_task_review_id' => $lockedReview->id,
                    'user_id' => $user->id,
                ],
                [
                    'learning_activity_id' => $activity->id,
                    'body' => $text,
                ],
            );
        });
    }
}
