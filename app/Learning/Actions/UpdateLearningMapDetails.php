<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateLearningMapDetails
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(User $user, LearningMap $map, array $data): LearningMap
    {
        return DB::transaction(function () use ($data, $map, $user): LearningMap {
            $map->versions()->create([
                'changed_by' => $user->id,
                'description' => $map->description,
                'learning_topic_id' => $map->learning_topic_id,
                'map_assets_locked' => (bool) $map->map_assets_locked,
                'title' => $map->title,
            ]);

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

            return $map->refresh();
        });
    }
}
