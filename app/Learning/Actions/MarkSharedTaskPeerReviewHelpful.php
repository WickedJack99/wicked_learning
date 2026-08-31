<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearnerActivityAccessService;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarkSharedTaskPeerReviewHelpful
{
    public function __construct(
        private readonly LearnerActivityAccessService $activityAccess,
    ) {}

    public function handle(
        User $user,
        LearningActivity $activity,
        string $playRunId,
        LearningSharedTaskReview $review,
        bool $helpful,
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

        return DB::transaction(function () use ($activity, $helpful, $review, $user): LearningSharedTaskReview {
            $activity->newQuery()->whereKey($activity->id)->lockForUpdate()->firstOrFail();
            $lockedReview = LearningSharedTaskReview::query()
                ->with('submission')
                ->whereKey($review->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $lockedReview->learning_activity_id !== $activity->id
                || $lockedReview->submission?->user_id !== $user->id
                || $lockedReview->submission?->status !== 'accepted'
            ) {
                throw ValidationException::withMessages([
                    'review' => 'Only the contributor can mark a received review helpful.',
                ]);
            }

            if (! $helpful) {
                $lockedReview->forceFill(['helpful_at' => null])->save();

                return $lockedReview;
            }

            LearningSharedTaskReview::query()
                ->where('learning_activity_id', $activity->id)
                ->whereKeyNot($lockedReview->id)
                ->whereNotNull('helpful_at')
                ->whereHas('submission', function (Builder $query) use ($user): void {
                    $query
                        ->where('user_id', $user->id)
                        ->where('status', 'accepted');
                })
                ->update(['helpful_at' => null]);

            $lockedReview->forceFill(['helpful_at' => now()])->save();

            return $lockedReview;
        });
    }
}
