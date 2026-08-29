<?php

namespace App\Learning\Services;

use App\Models\LearnerRecallItem;
use App\Models\LearningQuestion;
use App\Models\User;

/** Keeps learner-selected question recall items private and explicitly scoped. */
class LearnerRecallItemService
{
    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    public function queue(User $user, LearningQuestion $question): LearnerRecallItem
    {
        $question->loadMissing('activity.node.map');
        abort_unless($this->canUseQuestion($user, $question), 404);

        return LearnerRecallItem::query()->firstOrCreate([
            'user_id' => $user->id,
            'learning_question_id' => $question->id,
        ]);
    }

    public function remove(User $user, LearningQuestion $question): void
    {
        $question->loadMissing('activity.node.map');
        abort_unless($this->canUseQuestion($user, $question), 404);

        LearnerRecallItem::query()
            ->where('user_id', $user->id)
            ->where('learning_question_id', $question->id)
            ->delete();
    }

    private function canUseQuestion(User $user, LearningQuestion $question): bool
    {
        return $question->activity?->node?->map !== null
            && $this->mapAccess->canViewMap($question->activity->node->map, $user);
    }
}
