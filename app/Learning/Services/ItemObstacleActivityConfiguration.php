<?php

namespace App\Learning\Services;

class ItemObstacleActivityConfiguration
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
            'backgroundDark' => $this->string($data, 'item_obstacle_background_dark', $existing['backgroundDark'] ?? ''),
            'backgroundLight' => $this->string($data, 'item_obstacle_background_light', $existing['backgroundLight'] ?? ''),
            'backgroundMirrored' => $this->boolean($data, 'item_obstacle_background_mirrored', $existing['backgroundMirrored'] ?? false),
            'metBackgroundDark' => $this->string($data, 'item_obstacle_met_background_dark', $existing['metBackgroundDark'] ?? ''),
            'metBackgroundLight' => $this->string($data, 'item_obstacle_met_background_light', $existing['metBackgroundLight'] ?? ''),
            'metBackgroundMirrored' => $this->boolean($data, 'item_obstacle_met_background_mirrored', $existing['metBackgroundMirrored'] ?? false),
            'overlayDark' => $this->string($data, 'item_obstacle_overlay_dark', $existing['overlayDark'] ?? ''),
            'overlayLight' => $this->string($data, 'item_obstacle_overlay_light', $existing['overlayLight'] ?? ''),
            'overlayMirrored' => $this->boolean($data, 'item_obstacle_overlay_mirrored', $existing['overlayMirrored'] ?? false),
            'overlayX' => $this->number($data, 'item_obstacle_overlay_x', $existing['overlayX'] ?? 50),
            'overlayY' => $this->number($data, 'item_obstacle_overlay_y', $existing['overlayY'] ?? 50),
            'overlayWidth' => $this->number($data, 'item_obstacle_overlay_width', $existing['overlayWidth'] ?? 30),
            'slots' => $this->slotsFrom($data['item_obstacle_slots'] ?? $existing['slots'] ?? []),
            'consumeOnEachEntry' => $this->boolean($data, 'item_obstacle_consume_on_each_entry', $existing['consumeOnEachEntry'] ?? false),
            'lockMinutes' => (int) $this->number($data, 'item_obstacle_lock_minutes', $existing['lockMinutes'] ?? 0),
            'sounds' => $this->soundsFrom($data, $existing['sounds'] ?? []),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    public function shouldUpdate(array $data, array $updates): bool
    {
        if (($updates['type'] ?? null) === 'item_obstacle') {
            return true;
        }

        return array_intersect_key($data, array_flip([
            'item_obstacle_background_dark',
            'item_obstacle_background_light',
            'item_obstacle_background_mirrored',
            'item_obstacle_met_background_dark',
            'item_obstacle_met_background_light',
            'item_obstacle_met_background_mirrored',
            'item_obstacle_overlay_dark',
            'item_obstacle_overlay_light',
            'item_obstacle_overlay_mirrored',
            'item_obstacle_overlay_x',
            'item_obstacle_overlay_y',
            'item_obstacle_overlay_width',
            'item_obstacle_slots',
            'item_obstacle_consume_on_each_entry',
            'item_obstacle_lock_minutes',
            'item_obstacle_sound_not_met_enabled',
            'item_obstacle_sound_not_met_id',
            'item_obstacle_sound_met_enabled',
            'item_obstacle_sound_met_id',
            'item_obstacle_sound_transition_enabled',
            'item_obstacle_sound_transition_id',
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
            'metBackgroundDark' => '',
            'metBackgroundLight' => '',
            'metBackgroundMirrored' => false,
            'overlayDark' => '',
            'overlayLight' => '',
            'overlayMirrored' => false,
            'overlayX' => 50,
            'overlayY' => 50,
            'overlayWidth' => 30,
            'slots' => [],
            'consumeOnEachEntry' => false,
            'lockMinutes' => 0,
            'sounds' => [
                'notMet' => ['enabled' => false, 'soundId' => null],
                'met' => ['enabled' => false, 'soundId' => null],
                'transition' => ['enabled' => false, 'soundId' => null],
            ],
        ];
    }

    /**
     * @return list<array{itemId: int, x: float, y: float, width: float}>
     */
    private function slotsFrom(mixed $value): array
    {
        $slots = is_array($value) ? array_slice($value, 0, 10) : [];

        return array_values(array_map(
            fn (mixed $slot): array => [
                'itemId' => is_array($slot) ? (int) ($slot['itemId'] ?? 0) : 0,
                'x' => $this->floatFrom($slot['x'] ?? 50),
                'y' => $this->floatFrom($slot['y'] ?? 50),
                'width' => max(3.0, min(60.0, $this->floatFrom($slot['width'] ?? 10))),
            ],
            array_filter($slots, fn (mixed $slot): bool => is_array($slot) && (int) ($slot['itemId'] ?? 0) > 0),
        ));
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    private function soundsFrom(array $data, array $existing): array
    {
        return [
            'notMet' => $this->soundFrom($data, $existing, 'not_met'),
            'met' => $this->soundFrom($data, $existing, 'met'),
            'transition' => $this->soundFrom($data, $existing, 'transition'),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array{enabled: bool, soundId: int|null}
     */
    private function soundFrom(array $data, array $existing, string $key): array
    {
        $existingKey = match ($key) {
            'not_met' => 'notMet',
            default => $key,
        };
        $current = is_array($existing[$existingKey] ?? null) ? $existing[$existingKey] : [];

        return [
            'enabled' => $this->boolean($data, "item_obstacle_sound_{$key}_enabled", $current['enabled'] ?? false),
            'soundId' => $this->nullableInt($data["item_obstacle_sound_{$key}_id"] ?? $current['soundId'] ?? null),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function string(array $data, string $key, mixed $fallback): string
    {
        return array_key_exists($key, $data) ? (string) ($data[$key] ?? '') : (string) $fallback;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function number(array $data, string $key, mixed $fallback): float
    {
        if (! array_key_exists($key, $data)) {
            return $this->floatFrom($fallback);
        }

        return $this->floatFrom($data[$key] ?? 0);
    }

    private function floatFrom(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
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

    private function nullableInt(mixed $value): ?int
    {
        $id = is_numeric($value) ? (int) $value : null;

        return $id && $id > 0 ? $id : null;
    }
}
