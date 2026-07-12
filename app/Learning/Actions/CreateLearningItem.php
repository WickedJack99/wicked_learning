<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningItem;

class CreateLearningItem
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): LearningItem
    {
        return LearningItem::query()->create([
            'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forItem((string) $data['title']),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'image_dark' => $data['image_dark'] ?? null,
            'image_light' => $data['image_light'] ?? null,
            'config' => [],
        ]);
    }
}
