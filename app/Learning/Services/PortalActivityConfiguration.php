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
            'portalMode' => $data['portal_mode'] ?? $existing['portalMode'] ?? 'output',
            'portalBackgroundDark' => $data['portal_background_dark'] ?? $existing['portalBackgroundDark'] ?? '',
            'portalBackgroundLight' => $data['portal_background_light'] ?? $existing['portalBackgroundLight'] ?? '',
            'portalDurationSeconds' => (float) ($data['portal_duration_seconds'] ?? $existing['portalDurationSeconds'] ?? 1.5),
            'portalForegroundDark' => $data['portal_foreground_dark'] ?? $existing['portalForegroundDark'] ?? '',
            'portalForegroundLight' => $data['portal_foreground_light'] ?? $existing['portalForegroundLight'] ?? '',
            'portalForegroundX' => (float) ($data['portal_foreground_x'] ?? $existing['portalForegroundX'] ?? 50),
            'portalForegroundY' => (float) ($data['portal_foreground_y'] ?? $existing['portalForegroundY'] ?? 50),
            'portalSwirlEnabled' => (bool) ($data['portal_swirl_enabled'] ?? $existing['portalSwirlEnabled'] ?? true),
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
            'portal_duration_seconds',
            'portal_foreground_dark',
            'portal_foreground_light',
            'portal_foreground_x',
            'portal_foreground_y',
            'portal_mode',
            'portal_swirl_enabled',
        ];
    }
}
