<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningTool;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ObstacleToolService
{
    public function __construct(private readonly LearnerProgressService $progressService) {}

    /**
     * @return array<string, mixed>
     */
    public function useTool(User $user, LearningActivity $activity, int $toolId): array
    {
        abort_unless($activity->type === 'obstacle', 404);

        $tool = $user->learningTools()
            ->where('learning_tools.id', $toolId)
            ->first();

        if (! $tool instanceof LearningTool) {
            throw ValidationException::withMessages([
                'tool_id' => 'This tool is not available in your tool belt.',
            ]);
        }

        $isUseful = in_array($tool->id, $this->allowedToolIds($activity), true);
        $progress = $isUseful && $this->persistsAfterSolved($activity)
            ? $this->progressService->markObstacleDestroyed($user->id, $activity)
            : null;

        return [
            'isUseful' => $isUseful,
            'progress' => $progress?->metadata,
            'toolId' => $tool->id,
        ];
    }

    /**
     * @return list<int>
     */
    private function allowedToolIds(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $rawIds = is_array($config['allowedToolIds'] ?? null) ? $config['allowedToolIds'] : [];

        return array_values(array_filter(
            array_map(fn (mixed $id): int => (int) $id, $rawIds),
            fn (int $id): bool => $id > 0,
        ));
    }

    private function persistsAfterSolved(LearningActivity $activity): bool
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return filter_var($config['persistAfterSolved'] ?? true, FILTER_VALIDATE_BOOLEAN);
    }
}
