<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;

/** Keeps an optional, learner-facing activity time guide in the activity config. */
class ActivityTimeGuideConfiguration
{
    public const CONFIG_KEY = 'timeGuideMinutes';

    /** @param array<string, mixed> $existing @param array<string, mixed> $data */
    public function mergeInto(array $existing, array $data): array
    {
        if (! $this->shouldUpdate($data)) {
            return $existing;
        }

        $minutes = is_numeric($data['time_guide_minutes'] ?? null)
            ? (int) $data['time_guide_minutes']
            : null;

        if (! $minutes) {
            unset($existing[self::CONFIG_KEY]);
        } else {
            $existing[self::CONFIG_KEY] = $minutes;
        }

        return $existing;
    }

    /** @param array<string, mixed> $data */
    public function shouldUpdate(array $data): bool
    {
        return array_key_exists('time_guide_minutes', $data);
    }

    public function forActivity(LearningActivity $activity): ?int
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $minutes = $config[self::CONFIG_KEY] ?? null;

        return is_numeric($minutes) && (int) $minutes > 0 ? (int) $minutes : null;
    }
}
