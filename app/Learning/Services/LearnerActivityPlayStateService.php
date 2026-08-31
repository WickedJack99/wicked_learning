<?php

namespace App\Learning\Services;

use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class LearnerActivityPlayStateService
{
    /**
     * @return array<string, mixed>
     */
    public function activityStatesForRun(?LearnerRouteProgress $progress): array
    {
        if (! $progress) {
            return [];
        }

        $metadata = is_array($progress->metadata) ? $progress->metadata : [];

        return is_array($metadata['activityStates'] ?? null)
            ? $metadata['activityStates']
            : [];
    }

    /**
     * @param  array<int, int>  $history
     * @return array<string, mixed>
     */
    public function updateNpcDialogueState(
        User $user,
        LearningActivity $activity,
        string $playRunId,
        ?int $currentNodeId,
        array $history,
    ): array {
        $progress = LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $activity->learning_node_id)
            ->where('current_play_run_id', $playRunId)
            ->firstOrFail();

        $validNodeIds = $activity->npcDialogueNodes()->pluck('id')->all();
        $validNodeIdLookup = array_fill_keys($validNodeIds, true);
        $safeCurrentNodeId = $currentNodeId && isset($validNodeIdLookup[$currentNodeId])
            ? $currentNodeId
            : null;

        $safeHistory = array_values(array_filter(
            array_slice($history, -40),
            fn (int $nodeId): bool => isset($validNodeIdLookup[$nodeId])
        ));

        $state = [
            'currentNodeId' => $safeCurrentNodeId,
            'history' => $safeHistory,
        ];

        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $activityStates = is_array($metadata['activityStates'] ?? null)
            ? $metadata['activityStates']
            : [];

        $activityStates[(string) $activity->id] = [
            'npcDialogue' => $state,
        ];
        $metadata['activityStates'] = $activityStates;
        $progress->metadata = $metadata;
        $progress->save();

        return $state;
    }

    /**
     * @param  array<int, int>  $completedStepIndexes
     * @return array{completedStepIndexes: list<int>}
     */
    public function updateSharedTaskChecklist(
        User $user,
        LearningActivity $activity,
        string $playRunId,
        array $completedStepIndexes,
    ): array {
        $progress = LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $activity->learning_node_id)
            ->where('current_play_run_id', $playRunId)
            ->firstOrFail();

        $config = is_array($activity->config) ? $activity->config : [];
        $projectSteps = is_array($config['projectSteps'] ?? null)
            ? array_values(array_filter(
                $config['projectSteps'],
                fn (mixed $step): bool => is_string($step) && trim($step) !== '',
            ))
            : [];
        $stepCount = count($projectSteps);
        $normalizedIndexes = array_values(array_unique(array_map('intval', $completedStepIndexes)));
        $invalidIndexes = array_values(array_filter(
            $normalizedIndexes,
            fn (int $index): bool => $index < 0 || $index >= $stepCount,
        ));

        if ($invalidIndexes !== []) {
            throw ValidationException::withMessages([
                'completed_step_indexes' => 'Choose only steps from this project brief.',
            ]);
        }

        $safeIndexes = $normalizedIndexes;
        sort($safeIndexes);

        $state = [
            'completedStepIndexes' => $safeIndexes,
        ];
        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $activityStates = is_array($metadata['activityStates'] ?? null)
            ? $metadata['activityStates']
            : [];
        $activityState = is_array($activityStates[(string) $activity->id] ?? null)
            ? $activityStates[(string) $activity->id]
            : [];

        $activityState['sharedTask'] = $state;
        $activityStates[(string) $activity->id] = $activityState;
        $metadata['activityStates'] = $activityStates;
        $progress->metadata = $metadata;
        $progress->save();

        return $state;
    }

    public function clearActivityState(User $user, LearningActivity $activity, ?string $playRunId): void
    {
        if (! $playRunId) {
            return;
        }

        $progress = LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $activity->learning_node_id)
            ->where('current_play_run_id', $playRunId)
            ->first();

        if (! $progress) {
            return;
        }

        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $activityStates = is_array($metadata['activityStates'] ?? null)
            ? $metadata['activityStates']
            : [];

        unset($activityStates[(string) $activity->id]);

        if ($activityStates === []) {
            unset($metadata['activityStates']);
        } else {
            $metadata['activityStates'] = $activityStates;
        }

        $progress->metadata = $metadata;
        $progress->save();
    }
}
