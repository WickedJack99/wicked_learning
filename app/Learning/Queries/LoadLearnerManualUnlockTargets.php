<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\LearningWorld;
use App\Models\User;

class LoadLearnerManualUnlockTargets
{
    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearningMapEditAccessService $mapEditAccess,
    ) {}

    /**
     * Only locked nodes on maps the viewer can edit are offered as targets.
     *
     * @return list<array{id: int, title: string, nodes: list<array{id: int, title: string}>}>
     */
    public function handle(User $viewer): array
    {
        $world = $this->worldResolver->query()
            ->with(['maps.nodes:id,learning_map_id,title,state'])
            ->first();

        if (! $world instanceof LearningWorld) {
            return [];
        }

        return $world->maps
            ->filter(fn ($map): bool => $this->mapEditAccess->canEditMap($viewer, $map))
            ->map(function ($map): array {
                $nodes = $map->nodes
                    ->filter(fn ($node): bool => $node->state === 'locked')
                    ->sortBy('title')
                    ->map(fn ($node): array => [
                        'id' => (int) $node->id,
                        'title' => $node->title,
                    ])
                    ->values()
                    ->all();

                return [
                    'id' => (int) $map->id,
                    'title' => $map->title,
                    'nodes' => $nodes,
                ];
            })
            ->filter(fn (array $map): bool => $map['nodes'] !== [])
            ->sortBy('title')
            ->values()
            ->all();
    }
}
