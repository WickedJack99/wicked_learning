<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningWorld;
use App\Models\User;

class LoadLearningWorld
{
    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearningMapAccessService $mapAccess,
    ) {}

    public function forMapView(?User $user = null): ?LearningWorld
    {
        $world = $this->worldResolver
            ->query()
            ->with([
                'maps.nodes.activities.dialogueStages',
                'maps.nodes.activities.question.options',
                'maps.nodes.activities.transitions',
                'maps.nodes.activityStarts.activity',
                'maps.nodes.discoveries' => fn ($query) => $user
                    ? $query->where('user_id', $user->id)
                    : $query,
                'maps.nodes.outgoingPortalLinks.targetNode.map',
            ])
            ->first();

        if (! $world) {
            return null;
        }

        $world->setRelation('maps', $this->mapAccess->visibleMaps($world->maps, $user));

        return $world;
    }
}
