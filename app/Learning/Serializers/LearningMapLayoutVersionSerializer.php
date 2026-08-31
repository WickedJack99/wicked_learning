<?php

namespace App\Learning\Serializers;

use App\Models\LearningMapLayoutVersion;

class LearningMapLayoutVersionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(
        LearningMapLayoutVersion $version,
        array $currentNodeIds,
    ): array {
        $snapshotNodeIds = collect($version->snapshot)
            ->pluck('nodeId')
            ->map(fn (mixed $nodeId): int => (int) $nodeId)
            ->sort()
            ->values()
            ->all();

        return [
            'createdAt' => $version->created_at?->toIso8601String(),
            'id' => $version->id,
            'nodeCount' => is_array($version->snapshot) ? count($version->snapshot) : 0,
            'restorable' => $snapshotNodeIds === $currentNodeIds,
        ];
    }
}
