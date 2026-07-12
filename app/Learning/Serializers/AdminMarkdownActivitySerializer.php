<?php

namespace App\Learning\Serializers;

use App\Learning\ActivityTypeRegistry;
use App\Models\LearningActivity;

class AdminMarkdownActivitySerializer
{
    public function __construct(private readonly ActivityTypeRegistry $activityTypes) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningActivity $activity): array
    {
        $activity->loadMissing('node.map.world');

        return [
            'world' => [
                'id' => $activity->node->map->world->id,
                'slug' => $activity->node->map->world->slug,
                'title' => $activity->node->map->world->title,
            ],
            'map' => [
                'id' => $activity->node->map->id,
                'slug' => $activity->node->map->slug,
                'title' => $activity->node->map->title,
            ],
            'node' => [
                'id' => $activity->node->id,
                'slug' => $activity->node->slug,
                'title' => $activity->node->title,
            ],
            'activity' => [
                'id' => $activity->id,
                'slug' => $activity->slug,
                'type' => $activity->type,
                'title' => $activity->title,
                'introduction' => $activity->introduction,
                'config' => $activity->config ?? [],
                'graphLayout' => $this->graphLayout($activity),
                'portalLink' => null,
                'position' => [
                    'x' => $activity->graph_position_x,
                    'y' => $activity->graph_position_y,
                ],
                'connectors' => $this->activityTypes->connectorsFor($activity),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function graphLayout(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return is_array($config['markdownGraphLayout'] ?? null)
            ? $config['markdownGraphLayout']
            : [];
    }
}
