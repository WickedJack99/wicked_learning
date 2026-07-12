<?php

namespace App\Learning\Services;

class ObstacleActivityConfiguration
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
            'allowedToolIds' => $this->toolIdsFrom($data['obstacle_allowed_tool_ids'] ?? $existing['allowedToolIds'] ?? []),
            'backgroundDark' => $this->string($data, 'obstacle_background_dark', $existing['backgroundDark'] ?? ''),
            'backgroundLight' => $this->string($data, 'obstacle_background_light', $existing['backgroundLight'] ?? ''),
            'backgroundMirrored' => $this->boolean($data, 'obstacle_background_mirrored', $existing['backgroundMirrored'] ?? false),
            'bubbleBorderColorDark' => $this->string($data, 'obstacle_bubble_border_color_dark', $existing['bubbleBorderColorDark'] ?? '#2dd4bf'),
            'bubbleBorderColorLight' => $this->string($data, 'obstacle_bubble_border_color_light', $existing['bubbleBorderColorLight'] ?? '#0891b2'),
            'bubbleColorDark' => $this->string($data, 'obstacle_bubble_color_dark', $existing['bubbleColorDark'] ?? '#0f172a'),
            'bubbleColorLight' => $this->string($data, 'obstacle_bubble_color_light', $existing['bubbleColorLight'] ?? '#ffffff'),
            'bubbleOpacityDark' => $this->number($data, 'obstacle_bubble_opacity_dark', $existing['bubbleOpacityDark'] ?? 92),
            'bubbleOpacityLight' => $this->number($data, 'obstacle_bubble_opacity_light', $existing['bubbleOpacityLight'] ?? 94),
            'obstacleImageDark' => $this->string($data, 'obstacle_image_dark', $existing['obstacleImageDark'] ?? ''),
            'obstacleImageLight' => $this->string($data, 'obstacle_image_light', $existing['obstacleImageLight'] ?? ''),
            'obstacleImageMirrored' => $this->boolean($data, 'obstacle_image_mirrored', $existing['obstacleImageMirrored'] ?? false),
            'persistAfterSolved' => $this->boolean($data, 'obstacle_persist_after_solved', $existing['persistAfterSolved'] ?? true),
            'promptText' => $this->string($data, 'obstacle_prompt_text', $existing['promptText'] ?? ''),
            'obstacleX' => $this->number($data, 'obstacle_x', $existing['obstacleX'] ?? 50),
            'obstacleY' => $this->number($data, 'obstacle_y', $existing['obstacleY'] ?? 50),
            'obstacleWidth' => $this->number($data, 'obstacle_width', $existing['obstacleWidth'] ?? 28),
            'revisitBackgroundDark' => $this->string($data, 'obstacle_revisit_background_dark', $existing['revisitBackgroundDark'] ?? ''),
            'revisitBackgroundLight' => $this->string($data, 'obstacle_revisit_background_light', $existing['revisitBackgroundLight'] ?? ''),
            'revisitBackgroundMirrored' => $this->boolean($data, 'obstacle_revisit_background_mirrored', $existing['revisitBackgroundMirrored'] ?? false),
            'revisitImageDark' => $this->string($data, 'obstacle_revisit_image_dark', $existing['revisitImageDark'] ?? ''),
            'revisitImageLight' => $this->string($data, 'obstacle_revisit_image_light', $existing['revisitImageLight'] ?? ''),
            'revisitImageMirrored' => $this->boolean($data, 'obstacle_revisit_image_mirrored', $existing['revisitImageMirrored'] ?? false),
            'revisitText' => $this->string($data, 'obstacle_revisit_text', $existing['revisitText'] ?? ''),
            'successAnimation' => $this->string($data, 'obstacle_success_animation', $existing['successAnimation'] ?? 'zoom'),
            'successText' => $this->string($data, 'obstacle_success_text', $existing['successText'] ?? ''),
            'typingSpeed' => $this->number($data, 'obstacle_typing_speed', $existing['typingSpeed'] ?? 24),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    public function shouldUpdate(array $data, array $updates): bool
    {
        if (($updates['type'] ?? null) === 'obstacle') {
            return true;
        }

        return array_intersect_key($data, array_flip([
            'obstacle_allowed_tool_ids',
            'obstacle_background_dark',
            'obstacle_background_light',
            'obstacle_background_mirrored',
            'obstacle_bubble_border_color_dark',
            'obstacle_bubble_border_color_light',
            'obstacle_bubble_color_dark',
            'obstacle_bubble_color_light',
            'obstacle_bubble_opacity_dark',
            'obstacle_bubble_opacity_light',
            'obstacle_image_dark',
            'obstacle_image_light',
            'obstacle_image_mirrored',
            'obstacle_persist_after_solved',
            'obstacle_prompt_text',
            'obstacle_x',
            'obstacle_y',
            'obstacle_width',
            'obstacle_revisit_background_dark',
            'obstacle_revisit_background_light',
            'obstacle_revisit_background_mirrored',
            'obstacle_revisit_image_dark',
            'obstacle_revisit_image_light',
            'obstacle_revisit_image_mirrored',
            'obstacle_revisit_text',
            'obstacle_success_animation',
            'obstacle_success_text',
            'obstacle_typing_speed',
        ])) !== [];
    }

    /**
     * @return array<string, mixed>
     */
    private function defaults(): array
    {
        return [
            'allowedToolIds' => [],
            'backgroundDark' => '',
            'backgroundLight' => '',
            'backgroundMirrored' => false,
            'bubbleBorderColorDark' => '#2dd4bf',
            'bubbleBorderColorLight' => '#0891b2',
            'bubbleColorDark' => '#0f172a',
            'bubbleColorLight' => '#ffffff',
            'bubbleOpacityDark' => 92,
            'bubbleOpacityLight' => 94,
            'obstacleImageDark' => '',
            'obstacleImageLight' => '',
            'obstacleImageMirrored' => false,
            'persistAfterSolved' => true,
            'promptText' => '',
            'obstacleX' => 50,
            'obstacleY' => 50,
            'obstacleWidth' => 28,
            'revisitBackgroundDark' => '',
            'revisitBackgroundLight' => '',
            'revisitBackgroundMirrored' => false,
            'revisitImageDark' => '',
            'revisitImageLight' => '',
            'revisitImageMirrored' => false,
            'revisitText' => '',
            'successAnimation' => 'zoom',
            'successText' => '',
            'typingSpeed' => 24,
        ];
    }

    /**
     * @return list<int>
     */
    private function toolIdsFrom(mixed $value): array
    {
        $items = is_array($value) ? $value : explode(',', (string) $value);

        return array_values(array_unique(array_filter(
            array_map(fn (mixed $item): int => (int) trim((string) $item), $items),
            fn (int $id): bool => $id > 0,
        )));
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
    private function number(array $data, string $key, mixed $fallback): float|int
    {
        if (! array_key_exists($key, $data)) {
            return is_numeric($fallback) ? (float) $fallback : 0;
        }

        return is_numeric($data[$key] ?? null) ? (float) $data[$key] : 0;
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
