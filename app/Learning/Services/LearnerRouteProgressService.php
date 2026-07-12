<?php

namespace App\Learning\Services;

use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class LearnerRouteProgressService
{
    public function progressForStart(User $user, LearningActivityStart $start): ?LearnerRouteProgress
    {
        return LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $start->learning_node_id)
            ->where('start_learning_activity_id', $start->learning_activity_id)
            ->first();
    }

    public function startOrResume(User $user, LearningActivityStart $start): LearnerRouteProgress
    {
        $progress = $this->firstOrNew($user, $start);
        $now = Carbon::now();

        if (! $progress->exists || ! $progress->current_play_run_id) {
            $progress->current_play_run_id = (string) Str::uuid();
            $progress->started_at = $now;
        }

        if (! $progress->current_learning_activity_id || $progress->status === 'completed') {
            $progress->current_learning_activity_id = $start->learning_activity_id;
        }

        $progress->learning_activity_start_id = $start->id;
        $progress->status = $progress->status === 'completed' ? 'completed' : 'in_progress';
        $progress->last_entered_at = $now;
        $progress->save();

        return $progress;
    }

    public function restartSameRun(User $user, LearningActivityStart $start): LearnerRouteProgress
    {
        $progress = $this->startOrResume($user, $start);
        $progress->current_learning_activity_id = $start->learning_activity_id;
        $progress->last_entered_at = Carbon::now();
        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        unset($metadata['activityStates']);
        $progress->metadata = $metadata;
        $progress->save();

        return $progress;
    }

    public function resetWithNewRun(User $user, LearningActivityStart $start): LearnerRouteProgress
    {
        $progress = $this->firstOrNew($user, $start);
        $now = Carbon::now();

        $progress->learning_activity_start_id = $start->id;
        $progress->current_learning_activity_id = $start->learning_activity_id;
        $progress->current_play_run_id = (string) Str::uuid();
        $progress->status = 'in_progress';
        $progress->started_at = $now;
        $progress->last_entered_at = $now;
        $progress->last_exited_at = null;
        $progress->completed_at = null;
        $progress->reset_count = ((int) $progress->reset_count) + 1;
        $progress->metadata = $this->withoutCurrentRunState($progress);
        $progress->save();

        return $progress;
    }

    public function progressForNode(User $user, int $nodeId): ?LearnerRouteProgress
    {
        return LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $nodeId)
            ->whereNotNull('current_play_run_id')
            ->where('status', 'in_progress')
            ->latest('last_entered_at')
            ->latest()
            ->first()
            ?? LearnerRouteProgress::query()
                ->where('user_id', $user->id)
                ->where('learning_node_id', $nodeId)
                ->whereNotNull('current_play_run_id')
                ->latest('updated_at')
                ->first();
    }

    public function enterActivity(User $user, LearningActivity $activity, ?string $playRunId): void
    {
        if (! $playRunId) {
            return;
        }

        $progress = $this->progressForRun($user, $activity, $playRunId);

        if (! $progress) {
            return;
        }

        $progress->current_learning_activity_id = $activity->id;
        $progress->status = $progress->status === 'completed' ? 'completed' : 'in_progress';
        $progress->last_entered_at = Carbon::now();
        $progress->save();
    }

    public function completeRouteIfTerminal(User $user, LearningActivity $activity, ?string $playRunId): void
    {
        if (! $playRunId || $activity->transitions()->whereNotNull('to_activity_id')->exists()) {
            return;
        }

        $progress = $this->progressForRun($user, $activity, $playRunId);

        if (! $progress) {
            return;
        }

        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $completedRunIds = is_array($metadata['completedRunIds'] ?? null) ? $metadata['completedRunIds'] : [];

        if (! in_array($playRunId, $completedRunIds, true)) {
            $progress->completion_count = ((int) $progress->completion_count) + 1;
            $completedRunIds[] = $playRunId;
        }

        $now = Carbon::now();
        $metadata['completedRunIds'] = array_slice($completedRunIds, -40);
        $progress->metadata = $metadata;
        $progress->status = 'completed';
        $progress->completed_at ??= $now;
        $progress->last_completed_at = $now;
        $progress->last_exited_at = $now;
        $progress->save();
    }

    public function exitActivity(User $user, LearningActivity $activity, ?string $playRunId): void
    {
        if (! $playRunId) {
            return;
        }

        $progress = $this->progressForRun($user, $activity, $playRunId);

        if (! $progress) {
            return;
        }

        $progress->last_exited_at = Carbon::now();
        $progress->save();
    }

    public function progressForRun(User $user, LearningActivity $activity, string $playRunId): ?LearnerRouteProgress
    {
        return LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $activity->learning_node_id)
            ->where('current_play_run_id', $playRunId)
            ->first();
    }

    public function progressForNodeRun(User $user, int $nodeId, string $playRunId): ?LearnerRouteProgress
    {
        return LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $nodeId)
            ->where('current_play_run_id', $playRunId)
            ->first();
    }

    private function firstOrNew(User $user, LearningActivityStart $start): LearnerRouteProgress
    {
        return LearnerRouteProgress::query()->firstOrNew([
            'user_id' => $user->id,
            'learning_node_id' => $start->learning_node_id,
            'start_learning_activity_id' => $start->learning_activity_id,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function withoutCurrentRunState(LearnerRouteProgress $progress): array
    {
        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $completedRunIds = is_array($metadata['completedRunIds'] ?? null) ? $metadata['completedRunIds'] : [];

        $metadata['completedRunIds'] = array_values(array_filter(
            $completedRunIds,
            fn (mixed $runId): bool => $runId !== $progress->current_play_run_id,
        ));
        unset($metadata['activityStates']);

        return $metadata;
    }
}
