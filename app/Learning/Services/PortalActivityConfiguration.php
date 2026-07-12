<?php

namespace App\Learning\Services;

class PortalActivityConfiguration
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
            'portalMode' => $this->string($data, 'portal_mode', $existing['portalMode'] ?? 'output', 'output'),
            'portalBackgroundDark' => $this->string($data, 'portal_background_dark', $existing['portalBackgroundDark'] ?? ''),
            'portalBackgroundLight' => $this->string($data, 'portal_background_light', $existing['portalBackgroundLight'] ?? ''),
            'portalBackgroundMirrored' => $this->boolean($data, 'portal_background_mirrored', $existing['portalBackgroundMirrored'] ?? false),
            'portalDurationSeconds' => $this->number($data, 'portal_duration_seconds', $existing['portalDurationSeconds'] ?? 1.5),
            'portalForegroundDark' => $this->string($data, 'portal_foreground_dark', $existing['portalForegroundDark'] ?? ''),
            'portalForegroundLight' => $this->string($data, 'portal_foreground_light', $existing['portalForegroundLight'] ?? ''),
            'portalForegroundMirrored' => $this->boolean($data, 'portal_foreground_mirrored', $existing['portalForegroundMirrored'] ?? false),
            'portalForegroundWidth' => $this->number($data, 'portal_foreground_width', $existing['portalForegroundWidth'] ?? 28),
            'portalForegroundX' => $this->number($data, 'portal_foreground_x', $existing['portalForegroundX'] ?? 50),
            'portalForegroundY' => $this->number($data, 'portal_foreground_y', $existing['portalForegroundY'] ?? 50),
            'portalShowOnArrival' => (bool) ($data['portal_show_on_arrival'] ?? $existing['portalShowOnArrival'] ?? true),
            'portalSwirlEnabled' => (bool) ($data['portal_swirl_enabled'] ?? $existing['portalSwirlEnabled'] ?? true),
            'portalWaitForEnter' => (bool) ($data['portal_wait_for_enter'] ?? $existing['portalWaitForEnter'] ?? false),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    public function shouldUpdate(array $data, array $updates): bool
    {
        if (array_key_exists('type', $updates)) {
            return true;
        }

        foreach ($this->keys() as $key) {
            if (array_key_exists($key, $data)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, string>
     */
    private function keys(): array
    {
        return [
            'portal_background_dark',
            'portal_background_light',
            'portal_background_mirrored',
            'portal_duration_seconds',
            'portal_foreground_dark',
            'portal_foreground_light',
            'portal_foreground_mirrored',
            'portal_foreground_width',
            'portal_foreground_x',
            'portal_foreground_y',
            'portal_mode',
            'portal_show_on_arrival',
            'portal_swirl_enabled',
            'portal_wait_for_enter',
        ];
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

    /**
     * @param  array<string, mixed>  $data
     */
    private function number(array $data, string $key, mixed $fallback): float
    {
        if (! array_key_exists($key, $data) || $data[$key] === null) {
            return (float) $fallback;
        }

        return (float) $data[$key];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function string(array $data, string $key, mixed $fallback, string $blankFallback = ''): string
    {
        if (! array_key_exists($key, $data)) {
            return (string) $fallback;
        }

        return $data[$key] === null ? $blankFallback : (string) $data[$key];
    }
}
