<?php

namespace App\Learning\Services;

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use Illuminate\Support\Carbon;

class LearnerProgressService
{
    public function mark(int $userId, LearningActivity $activity, string $status): LearnerActivityProgress
    {
        $progress = LearnerActivityProgress::query()->firstOrNew([
            'user_id' => $userId,
            'learning_activity_id' => $activity->id,
        ]);

        $now = Carbon::now();
        $progress->learning_node_id = $activity->learning_node_id;
        $progress->status = $status === 'completed' ? 'completed' : ($progress->status ?: 'reached');
        $progress->reached_at ??= $now;

        if (! $progress->exists) {
            $progress->attempt_count = 1;
        }

        if ($status === 'completed') {
            $progress->completed_at ??= $now;
        }

        $progress->save();

        return $progress;
    }
}
