<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningMap;
use App\Models\LearningWorld;

class CreateLearningMap
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningWorld $world, array $data): LearningMap
    {
        $templateMap = $world->maps->first();

        return LearningMap::query()->create([
            'learning_world_id' => $world->id,
            'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forMap($world, (string) $data['title']),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'background_config' => $templateMap->background_config ?? [],
            'grid_config' => $templateMap->grid_config ?? [],
            'time_background_enabled' => false,
        ]);
    }
}
