<?php

namespace App\Learning\Services;

use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\User;

/** Proves that a learner is presently playing a particular activity. */
class ActiveLearningActivityResolver
{
    public function isActive(User $user, LearningActivity $activity, string $playRunId): bool
    {
        return LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $activity->learning_node_id)
            ->where('current_learning_activity_id', $activity->id)
            ->where('current_play_run_id', $playRunId)
            ->exists();
    }
}
