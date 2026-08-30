<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivity;
use App\Models\LearningSharedTaskSubmission;
use App\Models\User;

/** Shapes activity-wide shared task progress for learner playback. */
class SharedTaskStateSerializer
{
    /** @return array{acceptedCount: int, threshold: int, remaining: int, isComplete: bool, latestSubmissionAt: string|null, canShareContributions: bool, hasSubmitted: bool, contributions: list<array{body: string, submittedAt: string|null, taskKind: string, truncated: bool}>} */
    public function state(LearningActivity $activity, ?User $user = null, bool $includeContributions = false): array
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
            'canShareContributions' => $this->showContributions($activity),
            'hasSubmitted' => $includeContributions && $user !== null && LearningSharedTaskSubmission::query()
                ->where('learning_activity_id', $activity->id)
                ->where('user_id', $user->id)
                ->where('status', 'accepted')
                ->exists(),
            'contributions' => $includeContributions ? $this->contributions($activity) : [],
        ];
    }

    /** @return list<array{body: string, submittedAt: string|null, taskKind: string, truncated: bool}> */
    private function contributions(LearningActivity $activity): array
    {
        if (! $this->showContributions($activity)) {
            return [];
        }

        return LearningSharedTaskSubmission::query()
            ->where('learning_activity_id', $activity->id)
            ->where('status', 'accepted')
            ->where('metadata->shareWithPeers', true)
            ->latest('accepted_at')
            ->latest('id')
            ->limit(5)
            ->get(['body', 'accepted_at', 'metadata'])
            ->map(function (LearningSharedTaskSubmission $submission): array {
                $body = $submission->body;

                return [
                    'body' => mb_substr($body, 0, 500),
                    'submittedAt' => $submission->accepted_at?->toIso8601String(),
                    'taskKind' => is_array($submission->metadata) && is_string($submission->metadata['taskKind'] ?? null)
                        ? $submission->metadata['taskKind']
                        : 'text',
                    'truncated' => mb_strlen($body) > 500,
                ];
            })
            ->values()
            ->all();
    }

    private function showContributions(LearningActivity $activity): bool
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return (bool) ($config['showContributions'] ?? false);
    }

    private function threshold(LearningActivity $activity): int
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $threshold = is_numeric($config['threshold'] ?? null) ? (int) $config['threshold'] : 3;

        return max(1, $threshold);
    }
}
