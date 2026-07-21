<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivity;
use App\Models\LearningSharedTaskSubmission;

/** Shapes activity-wide shared task progress for learner playback. */
class SharedTaskStateSerializer
{
    /** @return array{acceptedCount: int, threshold: int, remaining: int, isComplete: bool, latestSubmissionAt: string|null} */
    public function state(LearningActivity $activity): array
    {
        $threshold = $this->threshold($activity);
        $acceptedCount = LearningSharedTaskSubmission::query()
            ->where('learning_activity_id', $activity->id)
            ->where('status', 'accepted')
            ->count();

        $latest = LearningSharedTaskSubmission::query()
            ->where('learning_activity_id', $activity->id)
            ->where('status', 'accepted')
            ->latest('accepted_at')
            ->first();

        return [
            'acceptedCount' => $acceptedCount,
            'threshold' => $threshold,
            'remaining' => max(0, $threshold - $acceptedCount),
            'isComplete' => $acceptedCount >= $threshold,
            'latestSubmissionAt' => $latest?->accepted_at?->toIso8601String(),
        ];
    }

    private function threshold(LearningActivity $activity): int
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $threshold = is_numeric($config['threshold'] ?? null) ? (int) $config['threshold'] : 3;

        return max(1, $threshold);
    }
}
