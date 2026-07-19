<?php

namespace App\Settings\Serializers;

use App\Models\UserPreference;

class SoundPreferenceSerializer
{
    public const DEFAULTS = [
        'muted' => false,
        'effectsVolume' => 100,
        'ambienceVolume' => 100,
    ];

    /**
     * @return array{muted: bool, effectsVolume: int, ambienceVolume: int}
     */
    public function serialize(?UserPreference $preference): array
    {
        $sound = $this->soundSettings($preference);

        return [
            'muted' => (bool) $sound['muted'],
            'effectsVolume' => $this->volume($sound['effectsVolume']),
            'ambienceVolume' => $this->volume($sound['ambienceVolume']),
        ];
    }

    /**
     * @return array{muted: mixed, effectsVolume: mixed, ambienceVolume: mixed}
     */
    private function soundSettings(?UserPreference $preference): array
    {
        $settings = $preference?->settings;

        if (! is_array($settings) || ! is_array($settings['sound'] ?? null)) {
            return self::DEFAULTS;
        }

        return [
            ...self::DEFAULTS,
            ...$settings['sound'],
        ];
    }

    private function volume(mixed $value): int
    {
        if (! is_numeric($value)) {
            return 100;
        }

        return max(0, min(100, (int) $value));
    }
}
