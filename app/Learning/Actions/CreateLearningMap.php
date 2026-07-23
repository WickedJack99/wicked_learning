<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningMap;
use App\Models\LearningWorld;
use App\Models\User;

class CreateLearningMap
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningWorld $world, array $data, ?User $creator = null): LearningMap
    {
        $templateMap = $world->maps->first();

        return LearningMap::query()->create([
            'learning_world_id' => $world->id,
            'created_by_user_id' => $creator?->id,
            'updated_by_user_id' => $creator?->id,
            'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forMap($world, (string) $data['title']),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'background_config' => $templateMap->background_config ?? [],
            'grid_config' => $templateMap->grid_config ?? [],
            'time_background_enabled' => false,
        ]);
    }
}
