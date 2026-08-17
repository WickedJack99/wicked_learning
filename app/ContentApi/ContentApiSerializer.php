<?php

namespace App\ContentApi;

use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;

class ContentApiSerializer
{
    /** @return array<string, mixed> */
    public function map(LearningMap $map): array
    {
        return [
            'id' => $map->id,
            'slug' => $map->slug,
            'title' => $map->title,
            'description' => $map->description,
        ];
    }

    /** @return array<string, mixed> */
    public function mapAsset(LearningMapAsset $asset): array
    {
        $asset->loadMissing('node');

        return [
            'id' => $asset->id,
            'mapId' => $asset->learning_map_id,
            'title' => $asset->node->title,
            'description' => $asset->node->description,
            'imageUrl' => $asset->image_url,
            'text' => $asset->text,
            'position' => [
                'x' => $asset->position_x,
                'y' => $asset->position_y,
                'z' => $asset->position_z,
            ],
            'width' => $asset->width,
            'opacity' => $asset->opacity,
            'locked' => $asset->locked,
            'interactionMode' => $asset->interaction_mode,
            'interactionConfig' => $asset->interaction_config ?? [],
            'visualConfig' => $asset->visual_config ?? [],
            'soundConfig' => $asset->sound_config ?? [],
            'activityCount' => $asset->node->activities()->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function activity(LearningActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'mapAssetId' => $activity->node?->mapAsset?->id,
            'slug' => $activity->slug,
            'type' => $activity->type,
            'title' => $activity->title,
            'introduction' => $activity->introduction,
            'config' => $activity->config ?? [],
            'position' => [
                'x' => $activity->graph_position_x,
                'y' => $activity->graph_position_y,
            ],
        ];
    }
}
