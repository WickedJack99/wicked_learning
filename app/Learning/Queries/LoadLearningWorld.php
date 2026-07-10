<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Models\LearningWorld;

class LoadLearningWorld
{
    public function __construct(private readonly CurrentWorldResolver $worldResolver) {}

    public function forMapView(?int $userId = null): ?LearningWorld
    {
        return $this->worldResolver
            ->query()
            ->with([
                'maps.nodes.activities.dialogueStages',
                'maps.nodes.activities.question.options',
                'maps.nodes.activities.transitions',
                'maps.nodes.activityStarts.activity',
                'maps.nodes.discoveries' => fn ($query) => $userId
                    ? $query->where('user_id', $userId)
                    : $query,
                'maps.nodes.outgoingPortalLinks.targetNode.map',
            ])
            ->first();
    }
}
