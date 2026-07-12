<?php

namespace App\Learning\Services;

use App\Models\LearnerActivityProgress;
use App\Models\LearnerNodeDiscovery;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class NodeUnlockService
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

        if (! $this->isToolUnlockable($node)) {
            return $this->toolResult($node, $tool, false, $this->isUnlockedForUser($node, $user->id));
        }

        $isUseful = $this->configuredToolId($node) === $tool->id;

        if ($isUseful) {
            $this->recordToolUse($user, $node, $tool);
            $node->load('discoveries');
        }

        return $this->toolResult($node, $tool, $isUseful, $this->isUnlockedForUser($node, $user->id));
    }

    public function isUnlockedForUser(LearningNode $node, ?int $userId): bool
    {
        if ($node->state !== 'locked') {
            return true;
        }

        if (! $this->hasUnlockRules($node) || $userId === null) {
            return false;
        }

        return $this->evaluateRule(
            $this->ruleTree($node),
            $this->completedNodeIds($userId),
            $this->hasToolUnlock($node, $userId),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function unlockState(LearningNode $node, ?int $userId): array
    {
        $isUnlockable = $this->hasUnlockRules($node);
        $isUnlocked = $this->isUnlockedForUser($node, $userId);

        return [
            'isUnlockable' => $isUnlockable,
            'isUnlocked' => $isUnlocked,
            'isToolUnlockable' => $this->isToolUnlockable($node),
            'toolUsed' => $userId !== null && $this->hasToolUnlock($node, $userId),
        ];
    }

    private function hasUnlockRules(LearningNode $node): bool
    {
        $unlock = $this->unlockConfig($node);

        return filter_var($unlock['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && $this->ruleTree($node) !== [];
    }

    private function isToolUnlockable(LearningNode $node): bool
    {
        if ($node->state !== 'locked') {
            return false;
        }

        $tool = $this->toolConfig($node);

        return filter_var($tool['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && $this->configuredToolId($node) !== null;
    }

    /**
     * @return array<string, mixed>
     */
    private function unlockConfig(LearningNode $node): array
    {
        $config = is_array($node->visual_config) ? $node->visual_config : [];

        return is_array($config['unlock'] ?? null) ? $config['unlock'] : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function toolConfig(LearningNode $node): array
    {
        $unlock = $this->unlockConfig($node);

        return is_array($unlock['tool'] ?? null) ? $unlock['tool'] : [];
    }

    private function configuredToolId(LearningNode $node): ?int
    {
        $toolId = (int) ($this->toolConfig($node)['toolId'] ?? 0);

        return $toolId > 0 ? $toolId : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function ruleTree(LearningNode $node): array
    {
        $unlock = $this->unlockConfig($node);

        return is_array($unlock['rules'] ?? null) ? $unlock['rules'] : [];
    }

    /**
     * @return array<int, true>
     */
    private function completedNodeIds(int $userId): array
    {
        $progressNodeIds = LearnerActivityProgress::query()
            ->where('user_id', $userId)
            ->where('status', 'completed')
            ->whereNotNull('learning_node_id')
            ->pluck('learning_node_id')
            ->all();

        return collect($progressNodeIds)
            ->map(fn (mixed $nodeId): int => (int) $nodeId)
            ->filter(fn (int $nodeId): bool => $nodeId > 0)
            ->unique()
            ->mapWithKeys(fn (int $nodeId): array => [$nodeId => true])
            ->all();
    }

    /**
     * @param  array<int, true>  $completedNodeIds
     * @param  array<string, mixed>  $rule
     */
    private function evaluateRule(array $rule, array $completedNodeIds, bool $toolUsed): bool
    {
        if (($rule['type'] ?? null) === 'node_completed') {
            $nodeId = (int) ($rule['nodeId'] ?? 0);

            return $nodeId > 0 && isset($completedNodeIds[$nodeId]);
        }

        if (($rule['type'] ?? null) === 'tool_used') {
            return $toolUsed;
        }

        if (($rule['type'] ?? null) !== 'group') {
            return false;
        }

        $rules = collect(is_array($rule['rules'] ?? null) ? $rule['rules'] : [])
            ->filter(fn (mixed $item): bool => is_array($item))
            ->values();

        if ($rules->isEmpty()) {
            return false;
        }

        $operator = ($rule['operator'] ?? 'and') === 'or' ? 'or' : 'and';

        return $operator === 'or'
            ? $rules->contains(fn (array $child): bool => $this->evaluateRule($child, $completedNodeIds, $toolUsed))
            : $rules->every(fn (array $child): bool => $this->evaluateRule($child, $completedNodeIds, $toolUsed));
    }

    private function hasToolUnlock(LearningNode $node, int $userId): bool
    {
        $node->loadMissing('discoveries');

        return $node->discoveries->contains(function (LearnerNodeDiscovery $discovery) use ($userId): bool {
            $metadata = is_array($discovery->metadata) ? $discovery->metadata : [];
            $unlock = is_array($metadata['unlock'] ?? null) ? $metadata['unlock'] : [];

            return $discovery->user_id === $userId
                && isset($unlock['unlockedAt']);
        });
    }

    private function recordToolUse(User $user, LearningNode $node, LearningTool $tool): void
    {
        $discovery = LearnerNodeDiscovery::query()->firstOrNew([
            'user_id' => $user->id,
            'learning_node_id' => $node->id,
        ]);
        $metadata = is_array($discovery->metadata) ? $discovery->metadata : [];
        $existingUnlock = is_array($metadata['unlock'] ?? null) ? $metadata['unlock'] : [];
        $metadata['unlock'] = [
            'source' => 'world-map-lock-tool',
            'toolId' => $tool->id,
            'unlockedAt' => $existingUnlock['unlockedAt'] ?? Carbon::now()->toIso8601String(),
        ];

        $discovery->learning_tool_id = $tool->id;
        $discovery->discovered_at ??= Carbon::now();
        $discovery->metadata = $metadata;
        $discovery->save();
    }

    /**
     * @return array<string, mixed>
     */
    private function toolResult(LearningNode $node, LearningTool $tool, bool $isUseful, bool $isUnlocked): array
    {
        return [
            'isUseful' => $isUseful,
            'isUnlocked' => $isUnlocked,
            'nodeId' => $node->id,
            'toolId' => $tool->id,
        ];
    }
}
