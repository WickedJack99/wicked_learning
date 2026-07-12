<?php

namespace App\Learning\Services;

class ToolGrantActivityConfiguration
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
            'backgroundDark' => $this->string($data, 'tool_grant_background_dark', $existing['backgroundDark'] ?? ''),
            'backgroundLight' => $this->string($data, 'tool_grant_background_light', $existing['backgroundLight'] ?? ''),
            'backgroundMirrored' => $this->boolean($data, 'tool_grant_background_mirrored', $existing['backgroundMirrored'] ?? false),
            'bubbleBorderColorDark' => $this->string($data, 'tool_grant_bubble_border_color_dark', $existing['bubbleBorderColorDark'] ?? '#2dd4bf'),
            'bubbleBorderColorLight' => $this->string($data, 'tool_grant_bubble_border_color_light', $existing['bubbleBorderColorLight'] ?? '#0891b2'),
            'bubbleColorDark' => $this->string($data, 'tool_grant_bubble_color_dark', $existing['bubbleColorDark'] ?? '#0f172a'),
            'bubbleColorLight' => $this->string($data, 'tool_grant_bubble_color_light', $existing['bubbleColorLight'] ?? '#ffffff'),
            'bubbleOpacityDark' => $this->number($data, 'tool_grant_bubble_opacity_dark', $existing['bubbleOpacityDark'] ?? 92),
            'bubbleOpacityLight' => $this->number($data, 'tool_grant_bubble_opacity_light', $existing['bubbleOpacityLight'] ?? 94),
            'fadeDurationSeconds' => $this->number($data, 'tool_grant_fade_duration_seconds', $existing['fadeDurationSeconds'] ?? 0.4),
            'slideDirection' => $this->string($data, 'tool_grant_slide_direction', $existing['slideDirection'] ?? 'left'),
            'slideDurationSeconds' => $this->number($data, 'tool_grant_slide_duration_seconds', $existing['slideDurationSeconds'] ?? 0.6),
            'text' => $this->string($data, 'tool_grant_text', $existing['text'] ?? ''),
            'toolId' => $this->nullableInt($data['tool_grant_tool_id'] ?? $existing['toolId'] ?? null),
            'toolMirrored' => $this->boolean($data, 'tool_grant_tool_mirrored', $existing['toolMirrored'] ?? false),
            'toolX' => $this->number($data, 'tool_grant_tool_x', $existing['toolX'] ?? 50),
            'toolY' => $this->number($data, 'tool_grant_tool_y', $existing['toolY'] ?? 50),
            'typingSpeed' => $this->number($data, 'tool_grant_typing_speed', $existing['typingSpeed'] ?? 24),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    public function shouldUpdate(array $data, array $updates): bool
    {
        if (($updates['type'] ?? null) === 'tool_grant') {
            return true;
        }

        return array_intersect_key($data, array_flip([
            'tool_grant_background_dark',
            'tool_grant_background_light',
            'tool_grant_background_mirrored',
            'tool_grant_bubble_border_color_dark',
            'tool_grant_bubble_border_color_light',
            'tool_grant_bubble_color_dark',
            'tool_grant_bubble_color_light',
            'tool_grant_bubble_opacity_dark',
            'tool_grant_bubble_opacity_light',
            'tool_grant_fade_duration_seconds',
            'tool_grant_slide_direction',
            'tool_grant_slide_duration_seconds',
            'tool_grant_text',
            'tool_grant_tool_id',
            'tool_grant_tool_mirrored',
            'tool_grant_tool_x',
            'tool_grant_tool_y',
            'tool_grant_typing_speed',
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
            'bubbleBorderColorDark' => '#2dd4bf',
            'bubbleBorderColorLight' => '#0891b2',
            'bubbleColorDark' => '#0f172a',
            'bubbleColorLight' => '#ffffff',
            'bubbleOpacityDark' => 92,
            'bubbleOpacityLight' => 94,
            'fadeDurationSeconds' => 0.4,
            'slideDirection' => 'left',
            'slideDurationSeconds' => 0.6,
            'text' => '',
            'toolId' => null,
            'toolMirrored' => false,
            'toolX' => 50,
            'toolY' => 50,
            'typingSpeed' => 24,
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
            return is_numeric($fallback) ? (float) $fallback : 0.0;
        }

        return is_numeric($data[$key] ?? null) ? (float) $data[$key] : 0.0;
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
