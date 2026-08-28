<?php

namespace App\Learning\Services;

use App\Models\AccessRole;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerNodeDiscovery;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class NodeUnlockService
{
    /** @var array<int, list<string>> */
    private array $userRoleSlugs = [];

    public function __construct(
        private readonly LearnerNodeAnswerEventService $answerEvents,
        private readonly NodeAvailabilitySchedule $availabilitySchedule,
    ) {}

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

        if ($this->answerEvents->isUnlockedForUser($node, $userId)) {
            return true;
        }

        $hasUnlockRules = $this->hasUnlockRules($node);

        if (! $hasUnlockRules) {
            return $userId !== null && $this->hasToolUnlock($node, $userId);
        }

        if ($userId === null) {
            return false;
        }

        $ruleTree = $this->ruleTree($node);
        $timeUnlocked = $this->availabilitySchedule->isUnlockedBySchedule($node);
        $roleSlugs = $this->roleSlugs($userId);

        if ($ruleTree === []) {
            return $timeUnlocked;
        }

        return $this->evaluateRule(
            $ruleTree,
            $this->completedNodeIds($userId),
            $this->hasToolUnlock($node, $userId),
            $timeUnlocked,
            $roleSlugs,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function unlockState(LearningNode $node, ?int $userId): array
    {
        $isUnlockable = $this->hasUnlockRules($node) || $this->isToolUnlockable($node);
        $isUnlocked = $this->isUnlockedForUser($node, $userId);

        return [
            'isUnlockable' => $isUnlockable,
            'isUnlocked' => $isUnlocked,
            'isToolUnlockable' => $this->isToolUnlockable($node),
            'toolUsed' => $userId !== null && $this->hasToolUnlock($node, $userId),
            'requirements' => $isUnlockable ? $this->requirements($node, $userId) : [],
        ];
    }

    /**
     * Return a learner-safe version of the configured rule tree. It contains
     * only actionable labels and the learner's own completion state.
     *
     * @return array<string, mixed>
     */
    private function requirements(LearningNode $node, ?int $userId): array
    {
        $completedNodeIds = $userId !== null ? $this->completedNodeIds($userId) : [];
        $toolUsed = $userId !== null && $this->hasToolUnlock($node, $userId);
        $timeUnlocked = $this->availabilitySchedule->isUnlockedBySchedule($node);
        $roleSlugs = $this->roleSlugs($userId);
        $rule = $this->ruleTree($node);

        if ($rule === []) {
            $rules = [];
            $unlock = $this->unlockConfig($node);
            $requiredNodeIds = is_array($unlock['requiredNodeIds'] ?? null)
                ? $unlock['requiredNodeIds']
                : [];

            foreach ($requiredNodeIds as $nodeId) {
                $rules[] = [
                    'type' => 'node_completed',
                    'nodeId' => (int) $nodeId,
                ];
            }

            if ($this->isToolUnlockable($node)) {
                $rules[] = ['type' => 'tool_used'];
            }

            if ($roleSlug = $this->configuredRoleSlug($node)) {
                $rules[] = [
                    'type' => 'role_has',
                    'roleSlug' => $roleSlug,
                ];
            }

            if ($this->availabilitySchedule->hasUnlockSchedule($node)) {
                $rules[] = ['type' => 'time_after'];
            }

            $rule = [
                'type' => 'group',
                'operator' => ($unlock['topOperator'] ?? 'and') === 'or' ? 'or' : 'and',
                'rules' => $rules,
            ];
        }

        $nodeIds = $this->nodeIdsInRule($rule);
        $nodeDetails = $nodeIds === []
            ? []
            : LearningNode::query()
                ->with('map:id,slug')
                ->whereIn('id', $nodeIds)
                ->get(['id', 'learning_map_id', 'slug', 'title'])
                ->mapWithKeys(fn (LearningNode $requiredNode): array => [
                    $requiredNode->id => [
                        'mapSlug' => $requiredNode->map?->slug,
                        'nodeSlug' => $requiredNode->slug,
                        'title' => $requiredNode->title,
                    ],
                ])
                ->all();
        $configuredToolId = $this->configuredToolId($node);
        $toolTitle = $configuredToolId === null
            ? null
            : LearningTool::query()->whereKey($configuredToolId)->value('title');
        $configuredRoleSlug = $this->configuredRoleSlug($node);
        $roleTitle = $configuredRoleSlug === null
            ? null
            : AccessRole::query()->where('slug', $configuredRoleSlug)->value('name');
        $unlockAt = $this->availabilitySchedule->unlockAt($node)?->toIso8601String();

        return $this->transformRequirement(
            $rule,
            $completedNodeIds,
            $toolUsed,
            $timeUnlocked,
            $roleSlugs,
            $nodeDetails,
            is_string($toolTitle) ? $toolTitle : null,
            is_string($roleTitle) ? $roleTitle : null,
            $unlockAt,
        );
    }

    /**
     * @param  array<string, mixed>  $rule
     * @param  array<int, true>  $completedNodeIds
     * @param  list<string>  $roleSlugs
     * @param  array<int|string, mixed>  $nodeDetails
     * @return array<string, mixed>
     */
    private function transformRequirement(
        array $rule,
        array $completedNodeIds,
        bool $toolUsed,
        bool $timeUnlocked,
        array $roleSlugs,
        array $nodeDetails,
        ?string $toolTitle,
        ?string $roleTitle,
        ?string $unlockAt,
    ): array {
        $type = $rule['type'] ?? null;

        if ($type === 'node_completed') {
            $nodeId = (int) ($rule['nodeId'] ?? 0);

            return [
                'mapSlug' => $nodeDetails[$nodeId]['mapSlug'] ?? null,
                'nodeSlug' => $nodeDetails[$nodeId]['nodeSlug'] ?? null,
                'type' => 'node_completed',
                'nodeTitle' => $nodeDetails[$nodeId]['title'] ?? null,
                'satisfied' => $nodeId > 0 && isset($completedNodeIds[$nodeId]),
            ];
        }

        if ($type === 'tool_used') {
            return [
                'type' => 'tool_used',
                'toolTitle' => $toolTitle,
                'satisfied' => $toolUsed,
            ];
        }

        if ($type === 'time_after') {
            return [
                'availableAt' => $unlockAt,
                'type' => 'time_after',
                'satisfied' => $timeUnlocked,
            ];
        }

        if ($type === 'role_has') {
            $roleSlug = trim((string) ($rule['roleSlug'] ?? ''));

            return [
                'roleSlug' => $roleSlug !== '' ? $roleSlug : null,
                'roleTitle' => $roleTitle ?? $roleSlug,
                'type' => 'role_has',
                'satisfied' => $roleSlug !== '' && in_array($roleSlug, $roleSlugs, true),
            ];
        }

        $children = collect(is_array($rule['rules'] ?? null) ? $rule['rules'] : [])
            ->filter(fn (mixed $child): bool => is_array($child))
            ->map(fn (array $child): array => $this->transformRequirement(
                $child,
                $completedNodeIds,
                $toolUsed,
                $timeUnlocked,
                $roleSlugs,
                $nodeDetails,
                $toolTitle,
                $roleTitle,
                $unlockAt,
            ))
            ->values()
            ->all();
        $operator = ($rule['operator'] ?? 'and') === 'or' ? 'or' : 'and';

        return [
            'operator' => $operator,
            'requirements' => $children,
            'satisfied' => $operator === 'or'
                ? collect($children)->contains(fn (array $child): bool => $child['satisfied'] === true)
                : collect($children)->isNotEmpty()
                    && collect($children)->every(fn (array $child): bool => $child['satisfied'] === true),
            'type' => 'group',
        ];
    }

    /**
     * @param  array<string, mixed>  $rule
     * @return array<int, int>
     */
    private function nodeIdsInRule(array $rule): array
    {
        $ids = [];

        if (($rule['type'] ?? null) === 'node_completed') {
            $nodeId = (int) ($rule['nodeId'] ?? 0);

            if ($nodeId > 0) {
                $ids[] = $nodeId;
            }
        }

        foreach (is_array($rule['rules'] ?? null) ? $rule['rules'] : [] as $child) {
            if (is_array($child)) {
                $ids = [...$ids, ...$this->nodeIdsInRule($child)];
            }
        }

        return array_values(array_unique($ids));
    }

    private function hasUnlockRules(LearningNode $node): bool
    {
        $unlock = $this->unlockConfig($node);

        return filter_var($unlock['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && ($this->ruleTree($node) !== [] || $this->availabilitySchedule->hasUnlockSchedule($node));
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

    private function configuredRoleSlug(LearningNode $node): ?string
    {
        $roleSlug = trim((string) ($this->unlockConfig($node)['roleSlug'] ?? ''));

        return $roleSlug !== '' ? $roleSlug : null;
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

        if (is_array($unlock['rules'] ?? null) && $unlock['rules'] !== []) {
            return $unlock['rules'];
        }

        $rules = [];
        $requiredNodeIds = is_array($unlock['requiredNodeIds'] ?? null)
            ? $unlock['requiredNodeIds']
            : [];

        foreach ($requiredNodeIds as $nodeId) {
            $rules[] = [
                'type' => 'node_completed',
                'nodeId' => (int) $nodeId,
            ];
        }

        if ($this->isToolUnlockable($node)) {
            $rules[] = ['type' => 'tool_used'];
        }

        if ($roleSlug = $this->configuredRoleSlug($node)) {
            $rules[] = [
                'type' => 'role_has',
                'roleSlug' => $roleSlug,
            ];
        }

        if ($this->availabilitySchedule->hasUnlockSchedule($node)) {
            $rules[] = ['type' => 'time_after'];
        }

        return $rules === [] ? [] : [
            'type' => 'group',
            'operator' => ($unlock['topOperator'] ?? 'and') === 'or' ? 'or' : 'and',
            'rules' => $rules,
        ];
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
    private function evaluateRule(
        array $rule,
        array $completedNodeIds,
        bool $toolUsed,
        bool $timeUnlocked,
        array $roleSlugs,
    ): bool {
        if (($rule['type'] ?? null) === 'node_completed') {
            $nodeId = (int) ($rule['nodeId'] ?? 0);

            return $nodeId > 0 && isset($completedNodeIds[$nodeId]);
        }

        if (($rule['type'] ?? null) === 'tool_used') {
            return $toolUsed;
        }

        if (($rule['type'] ?? null) === 'time_after') {
            return $timeUnlocked;
        }

        if (($rule['type'] ?? null) === 'role_has') {
            $roleSlug = trim((string) ($rule['roleSlug'] ?? ''));

            return $roleSlug !== '' && in_array($roleSlug, $roleSlugs, true);
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
            ? $rules->contains(fn (array $child): bool => $this->evaluateRule($child, $completedNodeIds, $toolUsed, $timeUnlocked, $roleSlugs))
            : $rules->every(fn (array $child): bool => $this->evaluateRule($child, $completedNodeIds, $toolUsed, $timeUnlocked, $roleSlugs));
    }

    /** @return list<string> */
    private function roleSlugs(?int $userId): array
    {
        if ($userId === null) {
            return [];
        }

        if (array_key_exists($userId, $this->userRoleSlugs)) {
            return $this->userRoleSlugs[$userId];
        }

        $user = User::query()->with('accessRoles')->find($userId);

        return $this->userRoleSlugs[$userId] = $user?->assignedRoles() ?? [];
    }

    private function hasToolUnlock(LearningNode $node, int $userId): bool
    {
        $node->loadMissing('discoveries');

        return $node->discoveries->contains(function (LearnerNodeDiscovery $discovery) use ($userId): bool {
            $metadata = is_array($discovery->metadata) ? $discovery->metadata : [];
            $unlock = is_array($metadata['unlock'] ?? null) ? $metadata['unlock'] : [];

            return $discovery->user_id === $userId
                && ($unlock['source'] ?? null) === 'world-map-lock-tool'
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
