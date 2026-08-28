<?php

namespace App\Learning\Services;

use App\Models\AccessRole;
use App\Models\LearningItem;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;

class NodeUnlockReachability
{
    /** @var array<int, LearningNode> */
    private array $nodes = [];

    /** @var array<int, bool> */
    private array $pathCache = [];

    /** @var array<int, true>|null */
    private ?array $answerEventTargets = null;

    /**
     * @return list<array{id: int, title: string}>
     */
    public function unreachablePrerequisites(LearningNode $node): array
    {
        if ($node->state !== 'locked') {
            return [];
        }

        $unlock = $this->unlock($node);
        $prerequisiteIds = $this->prerequisiteIds($node);
        $unreachableIds = is_array($unlock['rules'] ?? null) && $unlock['rules'] !== []
            ? $this->unreachableNodeIdsInRule(
                $unlock['rules'],
                [],
                [...$unlock, 'scheduleUnlockAt' => $this->scheduleUnlockAt($node)],
            )
            : $this->legacyUnreachableNodeIds($prerequisiteIds);
        $unreachable = [];

        foreach ($unreachableIds as $prerequisiteId) {
            $prerequisite = $this->nodes()[$prerequisiteId] ?? null;

            if ($prerequisite) {
                $unreachable[] = [
                    'id' => $prerequisite->id,
                    'title' => $prerequisite->title,
                ];
            }
        }

        return $unreachable;
    }

    /**
     * Keep the legacy requiredNodeIds diagnostic behavior for nodes that do
     * not yet use an authored rule tree.
     *
     * @param  list<int>  $prerequisiteIds
     * @return list<int>
     */
    private function legacyUnreachableNodeIds(array $prerequisiteIds): array
    {
        return array_values(array_filter(
            $prerequisiteIds,
            fn (int $prerequisiteId): bool => ! $this->hasIndependentOpeningPath($prerequisiteId, []),
        ));
    }

    /**
     * Return only node prerequisites that block every possible branch of an
     * authored rule tree. An unreachable OR branch is harmless when another
     * branch can open independently.
     *
     * @param  array<string, mixed>  $rule
     * @param  array<int, true>  $visiting
     * @param  array<string, mixed>  $unlock
     * @return list<int>
     */
    private function unreachableNodeIdsInRule(array $rule, array $visiting, array $unlock): array
    {
        if (($rule['type'] ?? null) === 'node_completed') {
            $nodeId = (int) ($rule['nodeId'] ?? 0);

            return $nodeId > 0 && ! $this->hasIndependentOpeningPath($nodeId, $visiting)
                ? [$nodeId]
                : [];
        }

        if (($rule['type'] ?? null) !== 'group') {
            return [];
        }

        $children = collect(is_array($rule['rules'] ?? null) ? $rule['rules'] : [])
            ->filter(fn (mixed $child): bool => is_array($child))
            ->values();

        if ($children->isEmpty()) {
            return [];
        }

        if (($rule['operator'] ?? 'and') === 'or') {
            $unreachable = [];

            foreach ($children as $child) {
                if ($this->ruleCanOpen($child, $visiting, $unlock)) {
                    return [];
                }

                $unreachable = [
                    ...$unreachable,
                    ...$this->unreachableNodeIdsInRule($child, $visiting, $unlock),
                ];
            }

            return array_values(array_unique($unreachable));
        }

        $unreachable = [];

        foreach ($children as $child) {
            $unreachable = [
                ...$unreachable,
                ...$this->unreachableNodeIdsInRule($child, $visiting, $unlock),
            ];
        }

        return array_values(array_unique($unreachable));
    }

    /** @return array<int, LearningNode> */
    private function nodes(): array
    {
        if ($this->nodes === []) {
            $this->nodes = LearningNode::query()
                ->get(['id', 'title', 'state', 'visual_config'])
                ->keyBy('id')
                ->all();
        }

        return $this->nodes;
    }

    /** @return list<int> */
    private function prerequisiteIds(LearningNode $node): array
    {
        $unlock = $this->unlock($node);

        if (is_array($unlock['rules'] ?? null) && $unlock['rules'] !== []) {
            return $this->nodeIdsInRule($unlock['rules']);
        }

        return is_array($unlock['requiredNodeIds'] ?? null)
            ? array_values(array_unique(array_map('intval', $unlock['requiredNodeIds'])))
            : [];
    }

    /**
     * @param  array<string, mixed>  $rule
     * @return list<int>
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

    /**
     * @param  array<int, true>  $visiting
     */
    private function hasIndependentOpeningPath(int $nodeId, array $visiting): bool
    {
        if ($nodeId <= 0) {
            return false;
        }

        $node = $this->nodes()[$nodeId] ?? null;

        if (! $node || $node->state !== 'locked') {
            return $node !== null;
        }

        if (isset($this->pathCache[$nodeId])) {
            return $this->pathCache[$nodeId];
        }

        if (isset($visiting[$nodeId])) {
            return false;
        }

        $visiting[$nodeId] = true;
        $unlock = $this->unlock($node);

        if ($this->answerEventTargets()[$node->id] ?? false) {
            return $this->pathCache[$nodeId] = true;
        }

        $rule = $this->ruleForNode($node, $unlock);

        if ($rule === null) {
            return $this->pathCache[$nodeId] = false;
        }

        return $this->pathCache[$nodeId] = $this->ruleCanOpen(
            $rule,
            $visiting,
            [...$unlock, 'scheduleUnlockAt' => $this->scheduleUnlockAt($node)],
        );
    }

    /**
     * @param  array<string, mixed>  $rule
     * @param  array<int, true>  $visiting
     * @param  array<string, mixed>  $unlock
     */
    private function ruleCanOpen(array $rule, array $visiting, array $unlock): bool
    {
        $type = $rule['type'] ?? null;

        if ($type === 'node_completed') {
            return $this->hasIndependentOpeningPath((int) ($rule['nodeId'] ?? 0), $visiting);
        }

        if ($type === 'tool_used') {
            return $this->hasConfiguredTool($unlock);
        }

        if ($type === 'item_owned') {
            return $this->hasConfiguredItem($unlock);
        }

        if ($type === 'role_has') {
            return AccessRole::query()->where('slug', trim((string) ($rule['roleSlug'] ?? '')))->exists();
        }

        if ($type === 'time_after') {
            return ($unlock['scheduleUnlockAt'] ?? null) !== null;
        }

        if ($type !== 'group') {
            return false;
        }

        $children = collect(is_array($rule['rules'] ?? null) ? $rule['rules'] : [])
            ->filter(fn (mixed $child): bool => is_array($child))
            ->values();

        if ($children->isEmpty()) {
            return false;
        }

        return ($rule['operator'] ?? 'and') === 'or'
            ? $children->contains(fn (array $child): bool => $this->ruleCanOpen($child, $visiting, $unlock))
            : $children->every(fn (array $child): bool => $this->ruleCanOpen($child, $visiting, $unlock));
    }

    /** @param array<string, mixed> $unlock */
    private function hasConfiguredTool(array $unlock): bool
    {
        $tool = is_array($unlock['tool'] ?? null) ? $unlock['tool'] : [];
        $toolId = (int) ($tool['toolId'] ?? 0);

        return filter_var($tool['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && $toolId > 0
            && LearningTool::query()->whereKey($toolId)->exists();
    }

    /** @param array<string, mixed> $unlock */
    private function hasConfiguredItem(array $unlock): bool
    {
        $item = is_array($unlock['item'] ?? null) ? $unlock['item'] : [];
        $itemId = (int) ($item['itemId'] ?? 0);

        return filter_var($unlock['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && filter_var($item['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && $itemId > 0
            && LearningItem::query()->whereKey($itemId)->exists();
    }

    /**
     * Return the rule tree used by the learner unlock evaluator, including
     * legacy top-level fields that predate authored rule trees.
     *
     * @param  array<string, mixed>  $unlock
     * @return array<string, mixed>|null
     */
    private function ruleForNode(LearningNode $node, array $unlock): ?array
    {
        if (! filter_var($unlock['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return $this->hasConfiguredTool($unlock) ? ['type' => 'tool_used'] : null;
        }

        if (is_array($unlock['rules'] ?? null) && $unlock['rules'] !== []) {
            return $unlock['rules'];
        }

        $rules = [];
        foreach (is_array($unlock['requiredNodeIds'] ?? null) ? $unlock['requiredNodeIds'] : [] as $nodeId) {
            $rules[] = ['type' => 'node_completed', 'nodeId' => (int) $nodeId];
        }

        if ($this->hasConfiguredTool($unlock)) {
            $rules[] = ['type' => 'tool_used'];
        }

        $item = is_array($unlock['item'] ?? null) ? $unlock['item'] : [];
        if (filter_var($item['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN) && (int) ($item['itemId'] ?? 0) > 0) {
            $rules[] = ['type' => 'item_owned'];
        }

        $roleSlug = trim((string) ($unlock['roleSlug'] ?? ''));
        if ($roleSlug !== '') {
            $rules[] = ['type' => 'role_has', 'roleSlug' => $roleSlug];
        }

        if ($this->scheduleUnlockAt($node) !== null) {
            $rules[] = ['type' => 'time_after'];
        }

        if ($rules === []) {
            return null;
        }

        return count($rules) === 1
            ? $rules[0]
            : [
                'type' => 'group',
                'operator' => ($unlock['topOperator'] ?? 'and') === 'or' ? 'or' : 'and',
                'rules' => $rules,
            ];
    }

    private function scheduleUnlockAt(LearningNode $node): ?string
    {
        $config = is_array($node->visual_config) ? $node->visual_config : [];
        $schedule = is_array($config['schedule'] ?? null) ? $config['schedule'] : [];
        $unlockAt = $schedule['unlockAt'] ?? null;

        return is_string($unlockAt) && trim($unlockAt) !== '' ? $unlockAt : null;
    }

    /** @return array<int, true> */
    private function answerEventTargets(): array
    {
        if ($this->answerEventTargets !== null) {
            return $this->answerEventTargets;
        }

        $this->answerEventTargets = [];

        NpcDialogueNode::query()
            ->get(['config'])
            ->each(function (NpcDialogueNode $dialogue): void {
                $config = is_array($dialogue->config) ? $dialogue->config : [];
                $events = is_array($config['events'] ?? null) ? $config['events'] : [];

                foreach (is_array($events['unlockNodeIds'] ?? null) ? $events['unlockNodeIds'] : [] as $nodeId) {
                    $nodeId = (int) $nodeId;

                    if ($nodeId > 0) {
                        $this->answerEventTargets[$nodeId] = true;
                    }
                }
            });

        return $this->answerEventTargets;
    }

    /** @return array<string, mixed> */
    private function unlock(LearningNode $node): array
    {
        $config = is_array($node->visual_config) ? $node->visual_config : [];

        return is_array($config['unlock'] ?? null) ? $config['unlock'] : [];
    }
}
