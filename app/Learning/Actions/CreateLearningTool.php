<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningTool;

class CreateLearningTool
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): LearningTool
    {
        return LearningTool::query()->create([
            'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forTool((string) $data['title']),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'image_dark' => $data['image_dark'] ?? null,
            'image_light' => $data['image_light'] ?? null,
            'animation_dark' => $data['animation_dark'] ?? null,
            'animation_light' => $data['animation_light'] ?? null,
            'config' => $this->configFrom($data),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function configFrom(array $data): array
    {
        return [
            'animationDurationSeconds' => $this->numericOrNull($data['animation_duration_seconds'] ?? null),
            'animationWidthPercent' => $this->numericOrNull($data['animation_width_percent'] ?? null),
            'animationStrategy' => 'uploaded-asset',
            'futureFrameSequenceSupport' => true,
            'imageWidthPercent' => $this->numericOrDefault($data['image_width_percent'] ?? null, 16),
        ];
    }

    private function numericOrNull(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function numericOrDefault(mixed $value, float $fallback): float
    {
        return is_numeric($value) ? (float) $value : $fallback;
    }
}
