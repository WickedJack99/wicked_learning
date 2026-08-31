<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearnerMapLocationService;
use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningMap;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\Relation;

class LoadCurrentMenuMapTheme
{
    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearnerMapLocationService $mapLocationService,
        private readonly LearningMapAccessService $mapAccess,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function handle(?User $user): ?array
    {
        $world = $this->worldResolver
            ->query()
            ->with([
                'maps' => /** @param Relation<LearningMap, LearningWorld, mixed> $relation */
                function (Relation $relation) use ($user): void {
                    $this->mapAccess->constrainVisibleQuery($relation->getQuery(), $user);
                },
            ])
            ->first();

        if (! $world) {
            return null;
        }

        $visibleMaps = $this->mapAccess->visibleMaps($world->maps, $user);

        if ($visibleMaps->isEmpty()) {
            return null;
        }

        $map = $user
            ? $this->mapLocationService->preferredMap($user, $visibleMaps)
            : null;

        return $this->serialize($map ?? $visibleMaps->first());
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(LearningMap $map): array
    {
        return [
            'mapId' => $map->id,
            'mapSlug' => $map->slug,
            'backgroundConfig' => $map->background_config ?? [],
        ];
    }
}
