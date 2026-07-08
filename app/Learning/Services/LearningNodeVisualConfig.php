<?php

namespace App\Learning\Services;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningMap;
use App\Models\LearningNode;

class LearningNodeVisualConfig
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function fillNode(LearningNode $node, LearningMap $map, array $data): void
    {
        $title = (string) $data['title'];
        $slug = ($data['slug'] ?? null) ?: $this->slugGenerator->forNode(
            $map,
            $title,
            $node->exists ? $node : null,
        );

        $node->forceFill([
            'slug' => $slug,
            'title' => $title,
            'description' => $data['description'] ?? null,
            'state' => $data['state'],
            'visual_config' => array_replace_recursive($this->defaults($title), $this->filterEmptyConfig($data['visual_config'] ?? [])),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function defaults(string $title): array
    {
        return [
            'icon' => 'map',
            'label' => $title,
            'dark' => [
                'tileColor' => '#253047',
                'tileOpacity' => '100',
                'foregroundColor' => '#bfdbfe',
                'foregroundOpacity' => '100',
                'labelColor' => '#ffffff',
                'labelOpacity' => '100',
                'highlightColor' => '#7dd3fc',
                'highlightOpacity' => '100',
            ],
            'light' => [
                'tileColor' => '#dbeafe',
                'tileOpacity' => '100',
                'foregroundColor' => '#1d4ed8',
                'foregroundOpacity' => '100',
                'labelColor' => '#0f172a',
                'labelOpacity' => '100',
                'highlightColor' => '#2563eb',
                'highlightOpacity' => '100',
            ],
        ];
    }

    /**
     * @param  array<int|string, mixed>  $config
     * @return array<int|string, mixed>
     */
    private function filterEmptyConfig(array $config): array
    {
        $filtered = [];

        foreach ($config as $key => $value) {
            $this->filterConfigValue($filtered, $key, $value);
        }

        return $filtered;
    }

    /**
     * @param  array<int|string, mixed>  $filtered
     */
    private function filterConfigValue(array &$filtered, string|int $key, mixed $value): void
    {
        if (is_array($value)) {
            $nested = $this->filterEmptyConfig($value);

            if ($nested !== []) {
                $filtered[$key] = $nested;
            }

            return;
        }

        if ($value !== null && $value !== '') {
            $filtered[$key] = $value;
        }
    }
}
