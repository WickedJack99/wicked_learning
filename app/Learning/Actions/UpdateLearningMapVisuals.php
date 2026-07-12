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
        $incoming = $this->configArray($data['background_config'] ?? null);
        $existing = $map->background_config ?? [];

        foreach (['dark', 'light'] as $mode) {
            if (array_key_exists('assets', $incoming[$mode] ?? [])) {
                $existing[$mode]['assets'] = $incoming[$mode]['assets'];
                unset($incoming[$mode]['assets']);
            }
        }

        $map->forceFill([
            'background_config' => $this->configMerger->merge(
                $existing,
                $incoming,
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
