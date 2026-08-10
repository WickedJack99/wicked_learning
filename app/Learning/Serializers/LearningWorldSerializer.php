<?php

namespace App\Learning\Serializers;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;

class LearningWorldSerializer
{
    public function __construct(
        private readonly LearningNodeSerializer $nodeSerializer,
        private readonly LearningMapAccessService $mapAccess,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningWorld $world, ?User $user = null): array
    {
        return [
            'id' => $world->id,
            'slug' => $world->slug,
            'title' => $world->title,
            'description' => $world->description,
            'themeConfig' => $world->theme_config ?? [],
            'maps' => $world->maps
                ->map(fn (LearningMap $map): array => $this->map($map, $user))
                ->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function map(LearningMap $map, ?User $user): array
    {
        return [
            'id' => $map->id,
            'slug' => $map->slug,
            'title' => $map->title,
            'description' => $map->description,
            'accessRoles' => $this->mapAccess->rolesForMap($map),
            'backgroundConfig' => $map->background_config ?? [],
            'gridConfig' => $map->grid_config ?? [],
            'mapAssetsLocked' => (bool) $map->map_assets_locked,
            'mapAssets' => $map->assets
                ->map(fn (LearningMapAsset $asset): array => $this->asset($asset))
                ->values(),
            'nodes' => $map->nodes
                ->sortBy([['position_q', 'asc'], ['position_r', 'asc']])
                ->values()
                ->map(fn (LearningNode $node): array => $this->nodeSerializer->serialize($node, $user))
                ->values(),
        ];
    }

    /** @return array<string, mixed> */
    private function asset(LearningMapAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'nodeId' => $asset->learning_node_id,
            'imageUrl' => $asset->image_url,
            'text' => $asset->text,
            'x' => $asset->position_x,
            'y' => $asset->position_y,
            'z' => $asset->position_z,
            'width' => $asset->width,
            'opacity' => $asset->opacity,
            'locked' => $asset->locked,
            'focusable' => $asset->focusable,
            'visualConfig' => $asset->visual_config ?? [],
            'soundConfig' => $asset->sound_config ?? [],
        ];
    }
}
