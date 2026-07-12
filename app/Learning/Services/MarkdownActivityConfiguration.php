<?php

namespace App\Learning\Services;

use Illuminate\Support\Str;

class MarkdownActivityConfiguration
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function fromData(array $data, array $existing = []): array
    {
        return [
            ...$existing,
            'markdownGraphLayout' => $this->graphLayout($data['markdown_graph_layout'] ?? $existing['markdownGraphLayout'] ?? []),
            'markdownPages' => $this->pages($data['markdown_pages'] ?? $existing['markdownPages'] ?? []),
            'markdownTransitions' => $this->transitions($data['markdown_transitions'] ?? $existing['markdownTransitions'] ?? []),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    public function shouldUpdate(array $data, array $updates): bool
    {
        if (($updates['type'] ?? null) === 'markdown') {
            return true;
        }

        return array_key_exists('markdown_pages', $data)
            || array_key_exists('markdown_graph_layout', $data)
            || array_key_exists('markdown_transitions', $data);
    }

    /**
     * @return array<string, array{x: int|float, y: int|float}>
     */
    private function graphLayout(mixed $value): array
    {
        $items = is_array($value) ? $value : [];
        $layout = [];

        foreach (['start', 'end'] as $key) {
            $position = is_array($items[$key] ?? null) ? $items[$key] : [];

            if (isset($position['x'], $position['y'])) {
                $layout[$key] = [
                    'x' => $this->number($position['x'], $key === 'start' ? -160 : 520),
                    'y' => $this->number($position['y'], 80),
                ];
            }
        }

        return $layout;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function pages(mixed $value): array
    {
        $items = is_array($value) ? $value : [];

        return collect($items)
            ->filter(fn (mixed $item): bool => is_array($item))
            ->map(fn (array $page, int $index): array => $this->page($page, $index))
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $page
     * @return array<string, mixed>
     */
    private function page(array $page, int $index): array
    {
        return [
            'id' => $this->string($page, 'id', 'page-'.Str::uuid()),
            'title' => $this->string($page, 'title', 'Page '.($index + 1)),
            'body' => $this->string($page, 'body', ''),
            'position' => [
                'x' => $this->number($page['position']['x'] ?? null, 120 + $index * 260),
                'y' => $this->number($page['position']['y'] ?? null, 80),
            ],
            'visual' => [
                'pageColorDark' => $this->string($page['visual'] ?? [], 'pageColorDark', '#0f172a'),
                'pageColorLight' => $this->string($page['visual'] ?? [], 'pageColorLight', '#ffffff'),
                'borderColorDark' => $this->string($page['visual'] ?? [], 'borderColorDark', '#2dd4bf'),
                'borderColorLight' => $this->string($page['visual'] ?? [], 'borderColorLight', '#0891b2'),
                'headingColorDark' => $this->string($page['visual'] ?? [], 'headingColorDark', '#67e8f9'),
                'headingColorLight' => $this->string($page['visual'] ?? [], 'headingColorLight', '#0e7490'),
                'textColorDark' => $this->string($page['visual'] ?? [], 'textColorDark', '#f8fafc'),
                'textColorLight' => $this->string($page['visual'] ?? [], 'textColorLight', '#0f172a'),
            ],
        ];
    }

    /**
     * @return list<array<string, string>>
     */
    private function transitions(mixed $value): array
    {
        $items = is_array($value) ? $value : [];

        return collect($items)
            ->filter(fn (mixed $item): bool => is_array($item))
            ->map(fn (array $transition): array => [
                'id' => $this->string($transition, 'id', 'edge-'.Str::uuid()),
                'from' => $this->string($transition, 'from', 'start'),
                'to' => $this->string($transition, 'to', 'end'),
            ])
            ->filter(fn (array $transition): bool => $transition['from'] !== '' && $transition['to'] !== '')
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function string(array $data, string $key, string $fallback): string
    {
        $value = $data[$key] ?? null;

        return is_scalar($value) ? trim((string) $value) : $fallback;
    }

    private function number(mixed $value, float|int $fallback): float|int
    {
        return is_numeric($value) ? (float) $value : $fallback;
    }
}
