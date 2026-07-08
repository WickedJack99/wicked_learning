<?php

namespace App\Learning\Actions;

use App\Learning\Services\SubmittedConfigMerger;
use App\Models\LearningMap;

class UpdateLearningMapVisuals
{
    public function __construct(private readonly SubmittedConfigMerger $configMerger) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningMap $map, array $data): void
    {
        $map->forceFill([
            'background_config' => $this->configMerger->merge(
                $map->background_config ?? [],
                $this->configArray($data['background_config'] ?? null),
            ),
        ])->save();
    }

    /**
     * @return array<int|string, mixed>
     */
    private function configArray(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }
}
