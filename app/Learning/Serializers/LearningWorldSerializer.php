<?php

namespace App\Learning\Serializers;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningMap;
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
            'nodes' => $map->nodes
                ->sortBy([['position_q', 'asc'], ['position_r', 'asc']])
                ->values()
                ->map(fn (LearningNode $node): array => $this->nodeSerializer->serialize($node, $user))
                ->values(),
        ];
    }
}
