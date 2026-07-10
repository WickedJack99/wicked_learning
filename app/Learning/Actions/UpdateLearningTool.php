<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningTool;

class UpdateLearningTool
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningTool $tool, array $data): void
    {
        $tool->forceFill([
            'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forTool((string) $data['title'], $tool),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'image_dark' => $data['image_dark'] ?? null,
            'image_light' => $data['image_light'] ?? null,
            'animation_dark' => $data['animation_dark'] ?? null,
            'animation_light' => $data['animation_light'] ?? null,
            'config' => $this->configFrom($tool, $data),
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function configFrom(LearningTool $tool, array $data): array
    {
        return [
            ...($tool->config ?? []),
            'animationDurationSeconds' => $this->numericOrNull($data['animation_duration_seconds'] ?? null),
            'animationStrategy' => 'uploaded-asset',
            'futureFrameSequenceSupport' => true,
        ];
    }

    private function numericOrNull(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }
}
