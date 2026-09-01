<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateLearningMapDetails
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(
        User $user,
        LearningMap $map,
        array $data,
        ?string $expectedUpdatedAt = null,
    ): LearningMap {
        return DB::transaction(function () use ($data, $expectedUpdatedAt, $map, $user): LearningMap {
            $currentMap = LearningMap::query()
                ->whereKey($map->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $expectedUpdatedAt !== null
                && $currentMap->updated_at?->toIso8601String() !== Carbon::parse($expectedUpdatedAt)->toIso8601String()
            ) {
                throw ValidationException::withMessages([
                    'updated_at' => 'These map details changed while you were editing. Reload them before saving again.',
                ]);
            }

            $currentMap->versions()->create([
                'changed_by' => $user->id,
                'description' => $currentMap->description,
                'learning_topic_id' => $currentMap->learning_topic_id,
                'map_assets_locked' => (bool) $currentMap->map_assets_locked,
                'title' => $currentMap->title,
            ]);

            $currentMap->forceFill([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'learning_topic_id' => array_key_exists('topic_id', $data)
                    ? ($data['topic_id'] !== null ? (int) $data['topic_id'] : null)
                    : $currentMap->learning_topic_id,
                'map_assets_locked' => array_key_exists('map_assets_locked', $data)
                    ? (bool) $data['map_assets_locked']
                    : $currentMap->map_assets_locked,
            ])->save();

            return $currentMap->refresh();
        });
    }
}
