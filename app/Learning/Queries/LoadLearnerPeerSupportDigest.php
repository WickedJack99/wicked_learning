<?php

namespace App\Learning\Queries;

use App\Models\LearningSharedTaskReview;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;

class LoadLearnerPeerSupportDigest
{
    public const DEFAULT_LIMIT = 12;

    /**
     * Return anonymous shared-task exchanges that have not received a
     * learner-controlled resolution signal yet.
     *
     * @param  list<int>  $learnerIds
     * @return list<array{activityId: int, activityTitle: string, contributorCount: int, latestReviewAt: string|null, mapId: int, mapTitle: string, nodeId: int, nodeTitle: string, unresolvedReviewCount: int}>
     */
    public function handle(array $learnerIds, int $limit = self::DEFAULT_LIMIT): array
    {
        if ($learnerIds === []) {
            return [];
        }

        $limit = max(1, min($limit, self::DEFAULT_LIMIT));

        return LearningSharedTaskReview::query()
            ->select([
                'learning_shared_task_reviews.learning_activity_id as activity_id',
                'learning_activities.title as activity_title',
                'learning_nodes.id as node_id',
                'learning_nodes.title as node_title',
                'learning_maps.id as map_id',
                'learning_maps.title as map_title',
            ])
            ->selectRaw('COUNT(*) as unresolved_review_count')
            ->selectRaw('COUNT(DISTINCT learning_shared_task_submissions.user_id) as contributor_count')
            ->selectRaw('MAX(learning_shared_task_reviews.created_at) as latest_review_at')
            ->join('learning_shared_task_submissions', 'learning_shared_task_submissions.id', '=', 'learning_shared_task_reviews.learning_shared_task_submission_id')
            ->join('learning_activities', 'learning_activities.id', '=', 'learning_shared_task_reviews.learning_activity_id')
            ->join('learning_nodes', 'learning_nodes.id', '=', 'learning_activities.learning_node_id')
            ->join('learning_maps', 'learning_maps.id', '=', 'learning_nodes.learning_map_id')
            ->whereIn('learning_shared_task_submissions.user_id', $learnerIds)
            ->where('learning_activities.type', 'shared_task')
            ->where('learning_shared_task_submissions.status', 'accepted')
            ->where('learning_shared_task_submissions.metadata->shareWithPeers', true)
            ->whereNotExists(function (Builder $query): void {
                $query
                    ->selectRaw('1')
                    ->from('learning_shared_task_reviews as resolved_reviews')
                    ->whereColumn(
                        'resolved_reviews.learning_shared_task_submission_id',
                        'learning_shared_task_submissions.id',
                    )
                    ->whereNotNull('resolved_reviews.helpful_at');
            })
            ->groupBy([
                'learning_shared_task_reviews.learning_activity_id',
                'learning_activities.title',
                'learning_nodes.id',
                'learning_nodes.title',
                'learning_maps.id',
                'learning_maps.title',
            ])
            ->orderByDesc('unresolved_review_count')
            ->orderByDesc('latest_review_at')
            ->orderByDesc('learning_shared_task_reviews.learning_activity_id')
            ->limit($limit)
            ->get()
            ->map(fn (LearningSharedTaskReview $review): array => [
                'activityId' => (int) $review->activity_id,
                'activityTitle' => (string) $review->activity_title,
                'contributorCount' => (int) $review->contributor_count,
                'latestReviewAt' => $this->timestamp($review->latest_review_at),
                'mapId' => (int) $review->map_id,
                'mapTitle' => (string) $review->map_title,
                'nodeId' => (int) $review->node_id,
                'nodeTitle' => (string) $review->node_title,
                'unresolvedReviewCount' => (int) $review->unresolved_review_count,
            ])
            ->values()
            ->all();
    }

    private function timestamp(mixed $value): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        return Carbon::parse((string) $value)->toIso8601String();
    }
}
