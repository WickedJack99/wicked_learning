<?php

namespace App\Learning\Services;

class ItemGrantActivityConfiguration
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function fromData(array $data, array $existing = []): array
    {
        return [
            ...$this->defaults(),
            ...$existing,
            'backgroundDark' => $data['item_grant_background_dark'] ?? $existing['backgroundDark'] ?? '',
            'backgroundLight' => $data['item_grant_background_light'] ?? $existing['backgroundLight'] ?? '',
            'backgroundMirrored' => $this->boolean($data, 'item_grant_background_mirrored', $existing['backgroundMirrored'] ?? false),
            'items' => $this->itemsFrom($data['item_grant_items'] ?? $existing['items'] ?? []),
            'probabilityPercent' => $this->probability($data['item_grant_probability_percent'] ?? $existing['probabilityPercent'] ?? 100),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    public function shouldUpdate(array $data, array $updates): bool
    {
        if (($updates['type'] ?? null) === 'item_grant') {
            return true;
        }

        return array_intersect_key($data, array_flip([
            'item_grant_background_dark',
            'item_grant_background_light',
            'item_grant_background_mirrored',
            'item_grant_items',
            'item_grant_probability_percent',
        ])) !== [];
    }

    /**
     * @return array<string, mixed>
     */
    private function defaults(): array
    {
        return [
            'backgroundDark' => '',
            'backgroundLight' => '',
            'backgroundMirrored' => false,
            'items' => [],
            'probabilityPercent' => 100.0,
        ];
    }

    /**
     * @return list<array{itemId: int, quantity: int}>
     */
    private function itemsFrom(mixed $value): array
    {
        $items = is_array($value) ? $value : [];

        return array_values(array_filter(array_map(
            fn (mixed $item): array => [
                'itemId' => is_array($item) ? (int) ($item['itemId'] ?? 0) : 0,
                'quantity' => max(1, is_array($item) ? (int) ($item['quantity'] ?? 1) : 1),
            ],
            $items,
        ), fn (array $item): bool => $item['itemId'] > 0));
    }

    private function probability(mixed $value): float
    {
        $probability = is_numeric($value) ? (float) $value : 100.0;

        return max(0.01, min(100.0, $probability));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function boolean(array $data, string $key, mixed $fallback): bool
    {
        if (! array_key_exists($key, $data)) {
            return filter_var($fallback, FILTER_VALIDATE_BOOLEAN);
        }

        return filter_var($data[$key] ?? false, FILTER_VALIDATE_BOOLEAN);
    }
}
