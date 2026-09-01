<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\Relation;

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
            ->with([
                'maps' => /** @param Relation<LearningMap, LearningWorld, mixed> $relation */
                function (Relation $relation) use ($viewer): void {
                    $this->mapEditAccess->scopeMapsUserCanEdit($relation->getQuery(), $viewer);
                    $relation->select(['id', 'learning_world_id', 'title']);
                    $relation->with('nodes:id,learning_map_id,title,state');
                },
            ])
            ->first();

        if (! $world instanceof LearningWorld) {
            return [];
        }

        $targets = $world->maps
            ->map(function (LearningMap $map): array {
                $nodes = array_values($map->nodes
                    ->filter(fn (LearningNode $node): bool => $node->state === 'locked')
                    ->sortBy('title')
                    ->map(fn (LearningNode $node): array => [
                        'id' => (int) $node->id,
                        'title' => (string) $node->title,
                    ])
                    ->values()
                    ->all());

                return [
                    'id' => (int) $map->id,
                    'title' => (string) $map->title,
                    'nodes' => $nodes,
                ];
            })
            ->filter(fn (array $map): bool => $map['nodes'] !== [])
            ->sortBy('title')
            ->values()
            ->all();

        return array_values($targets);
    }
}
