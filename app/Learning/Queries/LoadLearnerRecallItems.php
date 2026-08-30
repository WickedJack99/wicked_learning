<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearnerRecallItem;
use App\Models\LearningActivity;
use App\Models\LearningQuestion;
use App\Models\User;
use Illuminate\Support\Carbon;

/** Loads a bounded set of learner-selected question prompts for later recall. */
class LoadLearnerRecallItems
{
    private const MAX_ITEMS = 24;

    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /**
     * @return list<array{activityHref: string, activityId: int, activityTitle: string, deskReason: 'saved_for_recall', isDue: bool, lastConfidence: string|null, lastOutcome: string|null, lastReviewedAt: string|null, mapTitle: string, nextReviewAt: string|null, nodeHref: string, nodeTitle: string, prompt: string, questionId: int, reviewCount: int}>
     */
    public function handle(User $user): array
    {
        $now = Carbon::now();

        return LearnerRecallItem::query()
            ->where('user_id', $user->id)
            ->with(['question.activity.node.map'])
            ->orderByRaw(
                'CASE WHEN next_review_at IS NULL OR next_review_at <= ? THEN 0 ELSE 1 END',
                [$now],
            )
            ->orderBy('next_review_at')
            ->latest('created_at')
            ->latest('id')
            ->limit(self::MAX_ITEMS)
            ->get()
            ->map(function (LearnerRecallItem $item) use ($now, $user): ?array {
                $question = $item->question;
                $activity = $question?->activity;
                $node = $activity?->node;
                $map = $node?->map;

                if (! $question instanceof LearningQuestion
                    || ! $activity instanceof LearningActivity
                    || $node === null
                    || $map === null
                    || ! $this->mapAccess->canViewMap($map, $user)) {
                    return null;
                }

                return [
                    'activityHref' => route('learning.nodes.play', [
                        'activity_id' => $activity->id,
                        'node' => $node,
                        'recall_question' => $question->id,
                    ], false),
                    'activityId' => $activity->id,
                    'activityTitle' => $activity->title,
                    'deskReason' => 'saved_for_recall',
                    'isDue' => $item->next_review_at === null
                        || $item->next_review_at->lessThanOrEqualTo($now),
                    'lastConfidence' => $item->last_confidence,
                    'lastOutcome' => $item->last_outcome,
                    'lastReviewedAt' => $item->last_reviewed_at?->toIso8601String(),
                    'mapTitle' => $map->title,
                    'nextReviewAt' => $item->next_review_at?->toIso8601String(),
                    'nodeHref' => route('world', [
                        'map' => $map->slug,
                        'focused' => $node->slug,
                    ], false),
                    'nodeTitle' => $node->title,
                    'prompt' => $question->prompt,
                    'questionId' => $question->id,
                    'reviewCount' => (int) $item->review_count,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
