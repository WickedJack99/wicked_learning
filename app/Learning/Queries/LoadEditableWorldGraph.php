<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\LearningWorld;
use App\Models\User;

class LoadEditableWorldGraph
{
    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearningMapEditAccessService $mapEditAccess,
    ) {}

    public function handle(?User $user = null): LearningWorld
    {
        $world = $this->worldResolver
            ->query()
            ->with(['maps.nodes'])
            ->firstOrFail();

        if ($user && ! $this->mapEditAccess->canSeeAllEditableMaps($user)) {
            $world->setRelation(
                'maps',
                $world->maps
                    ->filter(fn ($map): bool => $this->mapEditAccess->canEditMap($user, $map))
                    ->values(),
            );
        }

        return $world;
    }
}
