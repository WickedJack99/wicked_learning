<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;
use App\Models\LearningMapLayoutVersion;
use App\Models\LearningNode;
use App\Models\User;

class RecordLearningMapLayoutVersion
{
    /** @return list<array{nodeId: int, positionQ: int, positionR: int}> */
    public function snapshot(LearningMap $map): array
    {
        return $map->nodes()
            ->orderBy('id')
            ->get(['id', 'position_q', 'position_r'])
            ->map(fn (LearningNode $node): array => [
                'nodeId' => $node->id,
                'positionQ' => (int) $node->position_q,
                'positionR' => (int) $node->position_r,
            ])
            ->values()
            ->all();
    }

    public function handle(User $user, LearningMap $map): LearningMapLayoutVersion
    {
        return $map->layoutVersions()->create([
            'changed_by' => $user->id,
            'snapshot' => $this->snapshot($map),
        ]);
    }
}
