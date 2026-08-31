<?php

namespace App\Learning\Serializers;

use App\Learning\Services\SharedTaskActivityConfiguration;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskReview;
use App\Models\LearningSharedTaskReviewFollowUp;
use App\Models\LearningSharedTaskSubmission;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Shapes activity-wide shared task progress for learner playback. */
class SharedTaskStateSerializer
{
    private const DEFAULT_PEER_REVIEW_PROMPT = 'What does this contribution help you notice, question, or extend?';

    public function __construct(
        private readonly SharedTaskActivityConfiguration $sharedTaskConfig,
    ) {}

    /** @return array{acceptedCount: int, threshold: int, remaining: int, isComplete: bool, latestSubmissionAt: string|null, canShareContributions: bool, hasSubmitted: bool, contributions: list<array{body: string, projectStep: string|null, submittedAt: string|null, taskKind: string, truncated: bool}>, peerReview: array{enabled: bool, prompt: string, hasReviewed: bool, submittedReview: array{id: int, body: string, projectStep: string|null, responseType: string|null, createdAt: string|null}|null, reviewableContributions: list<array{id: int, body: string, projectStep: string|null, taskKind: string, truncated: bool}>, receivedReviews: list<array{id: int, body: string, projectStep: string|null, responseType: string|null, canMarkHelpful: bool, isHelpful: bool, createdAt: string|null, followUp: string|null}>}|null} */
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

    /** @return list<array{body: string, projectStep: string|null, submittedAt: string|null, taskKind: string, truncated: bool}> */
    private function contributions(LearningActivity $activity): array
    {
        if (! $this->showContributions($activity)) {
            return [];
        }

        $projectSteps = $this->sharedTaskConfig->projectSteps(is_array($activity->config) ? $activity->config : []);

        return LearningSharedTaskSubmission::query()
            ->where('learning_activity_id', $activity->id)
            ->where('status', 'accepted')
            ->where('metadata->shareWithPeers', true)
            ->latest('accepted_at')
            ->latest('id')
            ->limit(5)
            ->get(['body', 'accepted_at', 'metadata'])
            ->map(function (LearningSharedTaskSubmission $submission) use ($projectSteps): array {
                $body = $submission->body;

                return [
                    'body' => mb_substr($body, 0, 500),
                    'projectStep' => $this->projectStep($submission, $projectSteps),
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

    /** @return array{enabled: bool, prompt: string, hasReviewed: bool, submittedReview: array{id: int, body: string, projectStep: string|null, responseType: string|null, createdAt: string|null}|null, reviewableContributions: list<array{id: int, body: string, projectStep: string|null, taskKind: string, truncated: bool}>, receivedReviews: list<array{id: int, body: string, projectStep: string|null, responseType: string|null, canMarkHelpful: bool, isHelpful: bool, createdAt: string|null, followUp: string|null}>}|null */
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
                'submittedReview' => null,
                'reviewableContributions' => [],
                'receivedReviews' => [],
            ] : null;
        }

        $submittedReview = $this->submittedReview($activity, $user);

        return [
            'enabled' => true,
            'prompt' => (string) ($config['peerReviewPrompt'] ?? self::DEFAULT_PEER_REVIEW_PROMPT),
            'hasReviewed' => $submittedReview !== null,
            'submittedReview' => $submittedReview,
            'reviewableContributions' => $hasSubmitted ? $this->reviewableContributions($activity, $user) : [],
            'receivedReviews' => $hasSubmitted ? $this->receivedReviews($activity, $user) : [],
        ];
    }

    /** @return array{id: int, body: string, projectStep: string|null, responseType: string|null, createdAt: string|null}|null */
    private function submittedReview(LearningActivity $activity, User $user): ?array
    {
        $projectSteps = $this->sharedTaskConfig->projectSteps(is_array($activity->config) ? $activity->config : []);
        $review = LearningSharedTaskReview::query()
            ->where('learning_activity_id', $activity->id)
            ->where('user_id', $user->id)
            ->latest('created_at')
            ->latest('id')
            ->first(['id', 'body', 'project_step_index', 'response_type', 'created_at']);

        if (! $review) {
            return null;
        }

        return [
            'id' => $review->id,
            'body' => $review->body,
            'projectStep' => $review->project_step_index !== null
                ? ($projectSteps[$review->project_step_index] ?? null)
                : null,
            'responseType' => $review->response_type,
            'createdAt' => $review->created_at?->toIso8601String(),
        ];
    }

    /** @return list<array{id: int, body: string, projectStep: string|null, responseType: string|null, canMarkHelpful: bool, isHelpful: bool, createdAt: string|null, followUp: string|null}> */
    private function receivedReviews(LearningActivity $activity, User $user): array
    {
        $projectSteps = $this->sharedTaskConfig->projectSteps(is_array($activity->config) ? $activity->config : []);

        $reviews = LearningSharedTaskReview::query()
            ->where('learning_activity_id', $activity->id)
            ->whereHas('submission', function (Builder $query) use ($user): void {
                $query
                    ->where('user_id', $user->id)
                    ->where('status', 'accepted')
                    ->where('metadata->shareWithPeers', true);
            })
            ->latest('created_at')
            ->latest('id')
            ->limit(5)
            ->get(['id', 'body', 'project_step_index', 'response_type', 'helpful_at', 'created_at']);
        $followUps = LearningSharedTaskReviewFollowUp::query()
            ->whereIn('learning_shared_task_review_id', $reviews->pluck('id'))
            ->where('user_id', $user->id)
            ->pluck('body', 'learning_shared_task_review_id');

        return $reviews
            ->map(function (LearningSharedTaskReview $review) use ($followUps, $projectSteps): array {
                return [
                    'id' => $review->id,
                    'body' => $review->body,
                    'projectStep' => $review->project_step_index !== null
                        ? ($projectSteps[$review->project_step_index] ?? null)
                        : null,
                    'responseType' => $review->response_type,
                    'canMarkHelpful' => true,
                    'isHelpful' => $review->helpful_at !== null,
                    'createdAt' => $review->created_at?->toIso8601String(),
                    'followUp' => $followUps->get($review->id),
                ];
            })
            ->values()
            ->all();
    }

    /** @return list<array{id: int, body: string, projectStep: string|null, taskKind: string, truncated: bool}> */
    private function reviewableContributions(LearningActivity $activity, User $user): array
    {
        $projectSteps = $this->sharedTaskConfig->projectSteps(is_array($activity->config) ? $activity->config : []);

        return LearningSharedTaskSubmission::query()
            ->where('learning_activity_id', $activity->id)
            ->where('status', 'accepted')
            ->where('user_id', '!=', $user->id)
            ->where('metadata->shareWithPeers', true)
            ->latest('accepted_at')
            ->latest('id')
            ->limit(5)
            ->get(['id', 'body', 'metadata'])
            ->map(function (LearningSharedTaskSubmission $submission) use ($projectSteps): array {
                $body = $submission->body;

                return [
                    'id' => $submission->id,
                    'body' => mb_substr($body, 0, 500),
                    'projectStep' => $this->projectStep($submission, $projectSteps),
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

    /** @param list<string> $projectSteps */
    private function projectStep(LearningSharedTaskSubmission $submission, array $projectSteps): ?string
    {
        $metadata = is_array($submission->metadata) ? $submission->metadata : [];
        $index = is_numeric($metadata['projectStepIndex'] ?? null)
            ? (int) $metadata['projectStepIndex']
            : null;

        return $index !== null ? ($projectSteps[$index] ?? null) : null;
    }

    private function threshold(LearningActivity $activity): int
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $threshold = is_numeric($config['threshold'] ?? null) ? (int) $config['threshold'] : 3;

        return max(1, $threshold);
    }
}
