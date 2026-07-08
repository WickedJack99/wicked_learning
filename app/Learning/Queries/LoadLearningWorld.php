<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Models\LearningWorld;

class LoadLearningWorld
{
    public function __construct(private readonly CurrentWorldResolver $worldResolver) {}

    public function forMapView(): ?LearningWorld
    {
        return $this->worldResolver
            ->query()
            ->with([
                'maps.nodes.activities.dialogueStages',
                'maps.nodes.activities.question.options',
                'maps.nodes.activities.transitions',
                'maps.nodes.activityStarts.activity',
                'maps.nodes.outgoingPortalLinks.targetNode.map',
            ])
            ->first();
    }
}
