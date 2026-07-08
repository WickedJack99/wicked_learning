<?php

namespace App\Learning\Serializers;

use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;

class AdminWorldSummarySerializer
{
    /**
     * @return array<string, mixed>
     */
    public function world(LearningWorld $world): array
    {
        return [
            'id' => $world->id,
            'slug' => $world->slug,
            'title' => $world->title,
            'description' => $world->description,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function map(LearningMap $map): array
    {
        return [
            'id' => $map->id,
            'slug' => $map->slug,
            'title' => $map->title,
            'description' => $map->description,
            'nodeCount' => $map->nodes->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function node(LearningNode $node): array
    {
        return [
            'id' => $node->id,
            'slug' => $node->slug,
            'title' => $node->title,
            'description' => $node->description,
            'position' => [
                'q' => $node->position_q,
                'r' => $node->position_r,
            ],
            'state' => $node->state,
            'visualConfig' => $node->visual_config ?? [],
        ];
    }
}
