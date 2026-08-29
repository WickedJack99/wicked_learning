<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearnerRecallItem;
use App\Models\LearningActivity;
use App\Models\LearningQuestion;
use App\Models\User;

/** Loads a bounded set of learner-selected question prompts for later recall. */
class LoadLearnerRecallItems
{
    private const MAX_ITEMS = 24;

    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /**
     * @return list<array{activityHref: string, activityId: int, activityTitle: string, mapTitle: string, nodeHref: string, nodeTitle: string, prompt: string, questionId: int}>
     */
    public function handle(User $user): array
    {
        return LearnerRecallItem::query()
            ->where('user_id', $user->id)
            ->with(['question.activity.node.map'])
            ->latest('created_at')
            ->latest('id')
            ->limit(self::MAX_ITEMS)
            ->get()
            ->map(function (LearnerRecallItem $item) use ($user): ?array {
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
                    ], false),
                    'activityId' => $activity->id,
                    'activityTitle' => $activity->title,
                    'mapTitle' => $map->title,
                    'nodeHref' => route('world', [
                        'map' => $map->slug,
                        'focused' => $node->slug,
                    ], false),
                    'nodeTitle' => $node->title,
                    'prompt' => $question->prompt,
                    'questionId' => $question->id,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
