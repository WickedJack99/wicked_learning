<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;

class UpdateLearningMapDetails
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningMap $map, array $data): void
    {
        $map->forceFill([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'learning_topic_id' => array_key_exists('topic_id', $data)
                ? ($data['topic_id'] !== null ? (int) $data['topic_id'] : null)
                : $map->learning_topic_id,
            'map_assets_locked' => array_key_exists('map_assets_locked', $data)
                ? (bool) $data['map_assets_locked']
                : $map->map_assets_locked,
        ])->save();
    }
}
