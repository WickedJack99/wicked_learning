<?php

namespace App\Learning\Services;

use App\Models\LearnerNodeDiscovery;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class NodeRevealService
{
    /**
     * @return array<string, mixed>
     */
    public function useTool(User $user, LearningNode $node, int $toolId): array
    {
        $tool = $user->learningTools()
            ->where('learning_tools.id', $toolId)
            ->first();

        if (! $tool instanceof LearningTool) {
            throw ValidationException::withMessages([
                'tool_id' => 'This tool is not available in your tool belt.',
            ]);
        }

        if (! $this->isDiscoverable($node)) {
            return [
                'discovered' => false,
                'isUseful' => false,
                'nodeId' => $node->id,
                'toolId' => $tool->id,
            ];
        }

        $isUseful = $this->configuredToolId($node) === $tool->id;

        if (! $isUseful) {
            return [
                'discovered' => false,
                'isUseful' => false,
                'nodeId' => $node->id,
                'toolId' => $tool->id,
            ];
        }

        LearnerNodeDiscovery::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'learning_node_id' => $node->id,
            ],
            [
                'learning_tool_id' => $tool->id,
                'discovered_at' => now(),
                'metadata' => [
                    'source' => 'world-map-tool',
                ],
            ],
        );

        return [
            'discovered' => true,
            'isUseful' => true,
            'nodeId' => $node->id,
            'toolId' => $tool->id,
        ];
    }

    public function isConcealedForUser(LearningNode $node, ?int $userId): bool
    {
        if (! $this->isDiscoverable($node)) {
            return false;
        }

        if ($userId === null) {
            return true;
        }

        return ! $node->discoveries
            ->contains(fn (LearnerNodeDiscovery $discovery): bool => $discovery->user_id === $userId);
    }

    public function isDiscoverable(LearningNode $node): bool
    {
        if ($node->state !== 'hidden') {
            return false;
        }

        $config = is_array($node->visual_config) ? $node->visual_config : [];
        $reveal = is_array($config['reveal'] ?? null) ? $config['reveal'] : [];

        return filter_var($reveal['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && $this->configuredToolId($node) !== null;
    }

    private function configuredToolId(LearningNode $node): ?int
    {
        $config = is_array($node->visual_config) ? $node->visual_config : [];
        $reveal = is_array($config['reveal'] ?? null) ? $config['reveal'] : [];
        $toolId = (int) ($reveal['toolId'] ?? 0);

        return $toolId > 0 ? $toolId : null;
    }
}
