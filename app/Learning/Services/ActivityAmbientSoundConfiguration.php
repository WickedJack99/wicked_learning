<?php

namespace App\Learning\Services;

/** Keeps optional scene ambience consistent across every activity renderer. */
class ActivityAmbientSoundConfiguration
{
    public const CONFIG_KEY = 'ambientSound';

    /** @param array<string, mixed> $existing @param array<string, mixed> $data @return array<string, mixed> */
    public function mergeInto(array $existing, array $data): array
    {
        if (! $this->shouldUpdate($data)) {
            return $existing;
        }

        $soundId = is_numeric($data['activity_sound_id'] ?? null)
            ? (int) $data['activity_sound_id']
            : null;

        if (! $soundId) {
            unset($existing[self::CONFIG_KEY]);

            return $existing;
        }

        $existing[self::CONFIG_KEY] = [
            'enabled' => filter_var($data['activity_sound_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'soundId' => $soundId,
        ];

        return $existing;
    }

    /** @param array<string, mixed> $data */
    public function shouldUpdate(array $data): bool
    {
        return array_key_exists('activity_sound_enabled', $data)
            || array_key_exists('activity_sound_id', $data);
    }
}
