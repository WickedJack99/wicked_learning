<?php

namespace App\Learning\Services;

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Support\Carbon;

class LearnerProgressService
{
    public function __construct(
        private readonly LearnerRouteProgressService $routeProgress,
        private readonly LearnerActivityPlayStateService $activityPlayState,
    ) {}

    public function mark(int $userId, LearningActivity $activity, string $status, ?string $playRunId = null): LearnerActivityProgress
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

        if ($playRunId) {
            $routeUser = User::query()->find($userId);

            if ($routeUser) {
                if ($status === 'reached') {
                    $this->routeProgress->enterActivity($routeUser, $activity, $playRunId);
                }

                if ($status === 'completed') {
                    $this->routeProgress->exitActivity($routeUser, $activity, $playRunId);
                    $this->activityPlayState->clearActivityState($routeUser, $activity, $playRunId);
                    $this->routeProgress->completeRouteIfTerminal($routeUser, $activity, $playRunId);
                }
            }
        }

        return $progress;
    }

    public function markObstacleDestroyed(int $userId, LearningActivity $activity): LearnerActivityProgress
    {
        $progress = $this->mark($userId, $activity, 'reached');
        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $obstacle = is_array($metadata['obstacle'] ?? null) ? $metadata['obstacle'] : [];

        $obstacle['destroyedAt'] ??= Carbon::now()->toIso8601String();
        $metadata['obstacle'] = $obstacle;
        $progress->metadata = $metadata;
        $progress->save();

        return $progress;
    }
}
