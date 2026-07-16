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
            'portalAssets' => $this->assets($data, $existing['portalAssets'] ?? []),
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
            'portal_assets',
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
     * @param  array<int, mixed>  $fallback
     * @return array<int, array<string, mixed>>
     */
    private function assets(array $data, array $fallback): array
    {
        if (! array_key_exists('portal_assets', $data)) {
            return array_values(array_filter($fallback, 'is_array'));
        }

        if (! is_array($data['portal_assets'])) {
            return [];
        }

        $assets = [];

        foreach (array_values($data['portal_assets']) as $index => $asset) {
            if (! is_array($asset)) {
                continue;
            }

            $assets[] = $this->asset($asset, $index);
        }

        return $assets;
    }

    /**
     * @param  array<string, mixed>  $asset
     * @return array<string, mixed>
     */
    private function asset(array $asset, int $index): array
    {
        return [
            'id' => (string) ($asset['id'] ?? 'portal-asset-'.($index + 1)),
            'imageDark' => (string) ($asset['imageDark'] ?? ''),
            'imageLight' => (string) ($asset['imageLight'] ?? ''),
            'label' => (string) ($asset['label'] ?? 'Asset '.($index + 1)),
            'layer' => $this->assetLayer((string) ($asset['layer'] ?? 'above-background')),
            'mirrored' => filter_var($asset['mirrored'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'opacity' => (float) ($asset['opacity'] ?? 100),
            'width' => (float) ($asset['width'] ?? 28),
            'x' => (float) ($asset['x'] ?? 50),
            'y' => (float) ($asset['y'] ?? 50),
        ];
    }

    private function assetLayer(string $layer): string
    {
        return in_array($layer, [
            'behind-background',
            'above-background',
            'above-foreground',
            'front',
        ], true) ? $layer : 'above-background';
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
