<?php

namespace App\Learning\Actions;

use App\Models\ActivityTransition;
use App\Models\LearningNode;
use Illuminate\Support\Facades\DB;

class DeleteLearningNode
{
    public function handle(LearningNode $node): void
    {
        DB::transaction(function () use ($node): void {
            $activityIds = $node->activities()->pluck('id')->all();

            if ($activityIds !== []) {
                ActivityTransition::query()
                    ->whereIn('to_activity_id', $activityIds)
                    ->delete();
            }

            $this->removeUnlockReferences($node);
            $node->delete();
        });
    }

    private function removeUnlockReferences(LearningNode $deletedNode): void
    {
        $deletedNodeId = (string) $deletedNode->id;

        LearningNode::query()
            ->whereKeyNot($deletedNode->id)
            ->each(function (LearningNode $node) use ($deletedNodeId): void {
                $visualConfig = is_array($node->visual_config) ? $node->visual_config : [];
                $nextVisualConfig = $this->removeNodeIdFromVisualConfig($visualConfig, $deletedNodeId);

                if ($nextVisualConfig === $visualConfig) {
                    return;
                }

                $node->forceFill(['visual_config' => $nextVisualConfig])->save();
            });
    }

    /**
     * @param  array<string, mixed>  $visualConfig
     * @return array<string, mixed>
     */
    private function removeNodeIdFromVisualConfig(array $visualConfig, string $deletedNodeId): array
    {
        if (is_array($visualConfig['unlock'] ?? null)) {
            $unlock = $visualConfig['unlock'];
            $requiredNodeIds = is_array($unlock['requiredNodeIds'] ?? null) ? $unlock['requiredNodeIds'] : [];

            $unlock['requiredNodeIds'] = array_values(array_filter(
                $requiredNodeIds,
                fn (mixed $nodeId): bool => (string) $nodeId !== $deletedNodeId,
            ));

            if (isset($unlock['rules'])) {
                $unlock['rules'] = $this->removeNodeIdFromUnlockRule($unlock['rules'], $deletedNodeId);
            }

            $visualConfig['unlock'] = $unlock;
        }

        foreach (['dark', 'light'] as $theme) {
            if (! is_array($visualConfig[$theme] ?? null)) {
                continue;
            }

            $visualConfig[$theme] = $this->removeNodeIdFromVisualConfig($visualConfig[$theme], $deletedNodeId);
        }

        return $visualConfig;
    }

    private function removeNodeIdFromUnlockRule(mixed $rule, string $deletedNodeId): mixed
    {
        if (! is_array($rule)) {
            return $rule;
        }

        if (($rule['type'] ?? null) === 'node_completed' && (string) ($rule['nodeId'] ?? '') === $deletedNodeId) {
            return null;
        }

        if (! is_array($rule['rules'] ?? null)) {
            return $rule;
        }

        $rule['rules'] = array_values(array_filter(
            array_map(
                fn (mixed $childRule): mixed => $this->removeNodeIdFromUnlockRule($childRule, $deletedNodeId),
                $rule['rules'],
            ),
            fn (mixed $childRule): bool => $childRule !== null,
        ));

        return $rule;
    }
}
