<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivity;
use App\Models\LearningSharedTaskReview;
use App\Models\LearningSharedTaskSubmission;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Shapes activity-wide shared task progress for learner playback. */
class SharedTaskStateSerializer
{
    private const DEFAULT_PEER_REVIEW_PROMPT = 'What does this contribution help you notice, question, or extend?';

    /** @return array{acceptedCount: int, threshold: int, remaining: int, isComplete: bool, latestSubmissionAt: string|null, canShareContributions: bool, hasSubmitted: bool, contributions: list<array{body: string, submittedAt: string|null, taskKind: string, truncated: bool}>, peerReview: array{enabled: bool, prompt: string, hasReviewed: bool, reviewableContributions: list<array{id: int, body: string, taskKind: string, truncated: bool}>, receivedReviews: list<array{id: int, body: string, responseType: string|null, canMarkHelpful: bool, isHelpful: bool, createdAt: string|null}>}|null} */
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

        $hasSubmitted = $includeContributions && $user !== null && LearningSharedTaskSubmission::query()
            ->where('learning_activity_id', $activity->id)
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->exists();

        return [
            'acceptedCount' => $acceptedCount,
            'threshold' => $threshold,
            'remaining' => max(0, $threshold - $acceptedCount),
            'isComplete' => $acceptedCount >= $threshold,
            'latestSubmissionAt' => $latest?->accepted_at?->toIso8601String(),
            'canShareContributions' => $this->showContributions($activity),
            'hasSubmitted' => $hasSubmitted,
            'contributions' => $includeContributions ? $this->contributions($activity) : [],
            'peerReview' => $includeContributions ? $this->peerReview($activity, $user, $hasSubmitted) : null,
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

    /** @return array{enabled: bool, prompt: string, hasReviewed: bool, reviewableContributions: list<array{id: int, body: string, taskKind: string, truncated: bool}>, receivedReviews: list<array{id: int, body: string, responseType: string|null, canMarkHelpful: bool, isHelpful: bool, createdAt: string|null}>}|null */
    private function peerReview(LearningActivity $activity, ?User $user, bool $hasSubmitted): ?array
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $enabled = (bool) ($config['peerReviewEnabled'] ?? false)
            && $this->showContributions($activity);

        if (! $enabled || ! $user) {
            return $enabled ? [
                'enabled' => true,
                'prompt' => (string) ($config['peerReviewPrompt'] ?? self::DEFAULT_PEER_REVIEW_PROMPT),
                'hasReviewed' => false,
                'reviewableContributions' => [],
                'receivedReviews' => [],
            ] : null;
        }

        $hasReviewed = LearningSharedTaskReview::query()
            ->where('learning_activity_id', $activity->id)
            ->where('user_id', $user->id)
            ->exists();

        return [
            'enabled' => true,
            'prompt' => (string) ($config['peerReviewPrompt'] ?? self::DEFAULT_PEER_REVIEW_PROMPT),
            'hasReviewed' => $hasReviewed,
            'reviewableContributions' => $hasSubmitted ? $this->reviewableContributions($activity, $user) : [],
            'receivedReviews' => $hasSubmitted ? $this->receivedReviews($activity, $user) : [],
        ];
    }

    /** @return list<array{id: int, body: string, responseType: string|null, canMarkHelpful: bool, isHelpful: bool, createdAt: string|null}> */
    private function receivedReviews(LearningActivity $activity, User $user): array
    {
        return LearningSharedTaskReview::query()
            ->where('learning_activity_id', $activity->id)
            ->whereHas('submission', function (Builder $query) use ($user): void {
                $query
                    ->where('user_id', $user->id)
                    ->where('status', 'accepted');
            })
            ->latest('created_at')
            ->latest('id')
            ->limit(5)
            ->get(['id', 'body', 'response_type', 'helpful_at', 'created_at'])
            ->map(fn (LearningSharedTaskReview $review): array => [
                'id' => $review->id,
                'body' => $review->body,
                'responseType' => $review->response_type,
                'canMarkHelpful' => true,
                'isHelpful' => $review->helpful_at !== null,
                'createdAt' => $review->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /** @return list<array{id: int, body: string, taskKind: string, truncated: bool}> */
    private function reviewableContributions(LearningActivity $activity, User $user): array
    {
        return LearningSharedTaskSubmission::query()
            ->where('learning_activity_id', $activity->id)
            ->where('status', 'accepted')
            ->where('user_id', '!=', $user->id)
            ->where('metadata->shareWithPeers', true)
            ->latest('accepted_at')
            ->latest('id')
            ->limit(5)
            ->get(['id', 'body', 'metadata'])
            ->map(function (LearningSharedTaskSubmission $submission): array {
                $body = $submission->body;

                return [
                    'id' => $submission->id,
                    'body' => mb_substr($body, 0, 500),
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
