<?php

namespace App\Learning\Serializers;

use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;

class LearningWorldSerializer
{
    public function __construct(private readonly LearningNodeSerializer $nodeSerializer) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningWorld $world, ?int $userId = null): array
    {
        return [
            'id' => $world->id,
            'slug' => $world->slug,
            'title' => $world->title,
            'description' => $world->description,
            'themeConfig' => $world->theme_config ?? [],
            'maps' => $world->maps
                ->map(fn (LearningMap $map): array => $this->map($map, $userId))
                ->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function map(LearningMap $map, ?int $userId): array
    {
        return [
            'id' => $map->id,
            'slug' => $map->slug,
            'title' => $map->title,
            'description' => $map->description,
            'backgroundConfig' => $map->background_config ?? [],
            'gridConfig' => $map->grid_config ?? [],
            'nodes' => $map->nodes
                ->sortBy([['position_q', 'asc'], ['position_r', 'asc']])
                ->values()
                ->map(fn (LearningNode $node): array => $this->nodeSerializer->serialize($node, $userId))
                ->values(),
        ];
    }
}
