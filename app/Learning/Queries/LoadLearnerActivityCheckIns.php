<?php

namespace App\Learning\Queries;

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;

/** Loads the current learner's latest private check-in for each activity. */
class LoadLearnerActivityCheckIns
{
    /**
     * @return list<array{activityId: int, activityTitle: string, feeling: string, nodeTitle: string, recordedAt: string}>
     */
    public function handle(User $user): array
    {
        $checkIns = [];

        LearnerActivityProgress::query()
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->with('activity.node')
            ->latest('updated_at')
            ->get()
            ->each(function (LearnerActivityProgress $progress) use (&$checkIns): void {
                $metadata = is_array($progress->metadata) ? $progress->metadata : [];
                $checkIn = $metadata['learningCheckIn'] ?? null;
                $activity = $progress->activity;

                if (
                    ! is_array($checkIn)
                    || ! $activity instanceof LearningActivity
                    || ! is_string($checkIn['feeling'] ?? null)
                    || ! is_string($checkIn['recordedAt'] ?? null)
                ) {
                    return;
                }

                $checkIns[] = [
                    'activityId' => $activity->id,
                    'activityTitle' => $activity->title,
                    'feeling' => $checkIn['feeling'],
                    'nodeTitle' => $activity->node->title,
                    'recordedAt' => $checkIn['recordedAt'],
                ];
            });

        return array_slice($checkIns, 0, 30);
    }
}
