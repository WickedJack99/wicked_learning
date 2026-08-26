<?php

namespace App\Learning\Queries;

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;

/** Loads the current learner's recent private check-in history. */
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
                $history = is_array($metadata['learningCheckIns'] ?? null)
                    ? $metadata['learningCheckIns']
                    : [];
                $history = $history !== []
                    ? $history
                    : [$metadata['learningCheckIn'] ?? null];
                $activity = $progress->activity;

                if (! $activity instanceof LearningActivity) {
                    return;
                }

                foreach ($history as $checkIn) {
                    if (
                        ! is_array($checkIn)
                        || ! is_string($checkIn['feeling'] ?? null)
                        || ! is_string($checkIn['recordedAt'] ?? null)
                    ) {
                        continue;
                    }

                    $checkIns[] = [
                        'activityId' => $activity->id,
                        'activityTitle' => $activity->title,
                        'feeling' => $checkIn['feeling'],
                        'nodeTitle' => $activity->node->title,
                        'recordedAt' => $checkIn['recordedAt'],
                    ];
                }
            });

        usort(
            $checkIns,
            fn (array $left, array $right): int => strcmp($right['recordedAt'], $left['recordedAt']),
        );

        return array_slice($checkIns, 0, 30);
    }
}
