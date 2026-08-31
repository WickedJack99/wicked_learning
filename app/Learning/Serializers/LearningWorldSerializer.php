<?php

namespace App\Learning\Serializers;

use App\Learning\Services\LearnerRouteProgressService;
use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Collection;

class LearningWorldSerializer
{
    public function __construct(
        private readonly LearningNodeSerializer $nodeSerializer,
        private readonly LearningMapAssetSerializer $mapAssetSerializer,
        private readonly LearningMapAccessService $mapAccess,
        private readonly LearnerRouteProgressService $routeProgress,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningWorld $world, ?User $user = null): array
    {
        $routeProgressByStartKey = $user
            ? $this->routeProgress->progressForStarts($user, $this->routeStarts($world))
            : null;

        return [
            'id' => $world->id,
            'slug' => $world->slug,
            'title' => $world->title,
            'description' => $world->description,
            'themeConfig' => $world->theme_config ?? [],
            'maps' => $world->maps
                ->map(fn (LearningMap $map): array => $this->map($map, $user, $routeProgressByStartKey))
                ->values(),
        ];
    }

    /**
     * @param  Collection<string, mixed>|null  $routeProgressByStartKey
     * @return array<string, mixed>
     */
    private function map(
        LearningMap $map,
        ?User $user,
        ?Collection $routeProgressByStartKey = null,
    ): array {
        return [
            'id' => $map->id,
            'slug' => $map->slug,
            'title' => $map->title,
            'description' => $map->description,
            'topic' => $map->topic?->is_published ? [
                'competenceHref' => route('competence.index', [
                    'topic' => $map->topic->slug,
                ], false),
                'href' => route('topics.show', $map->topic, false),
                'slug' => $map->topic->slug,
                'title' => $map->topic->title,
            ] : null,
            'accessRoles' => $this->mapAccess->rolesForMap($map),
            'backgroundConfig' => $map->background_config ?? [],
            'gridConfig' => $map->grid_config ?? [],
            'mapAssetsLocked' => (bool) $map->map_assets_locked,
            'mapAssets' => $map->assets
                ->map(fn (LearningMapAsset $asset): array => $this->mapAssetSerializer->serialize($asset))
                ->values(),
            'nodes' => $map->nodes
                ->sortBy([['position_q', 'asc'], ['position_r', 'asc']])
                ->values()
                ->map(fn (LearningNode $node): array => $this->nodeSerializer->serialize(
                    $node,
                    $user,
                    false,
                    $routeProgressByStartKey,
                ))
                ->values(),
        ];
    }

    /** @return Collection<int, LearningActivityStart> */
    private function routeStarts(LearningWorld $world): Collection
    {
        return $world->maps->flatMap(
            fn (LearningMap $map): Collection => $map->nodes->flatMap(
                fn (LearningNode $node): Collection => $node->activityStarts,
            ),
        );
    }
}
