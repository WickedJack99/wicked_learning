<?php

namespace App\Learning\Services;

use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\User;
use Illuminate\Http\Request;

class LearningPlayRunService
{
    public function currentRunId(Request $request, LearningNode $node): ?string
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return null;
        }

        $runId = $request->query('run');

        if (! is_string($runId) || ! $this->isValidRun($request, $runId, $user, $node->id)) {
            return null;
        }

        return $runId;
    }

    public function canUseRun(Request $request, string $runId, LearningActivity $activity): bool
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return false;
        }

        return $this->isValidRun($request, $runId, $user, $activity->learning_node_id);
    }

    private function isValidRun(Request $request, string $runId, User $user, int $nodeId): bool
    {
        return LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $nodeId)
            ->where('current_play_run_id', $runId)
            ->exists();
    }
}
