<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;

/** Normalizes an optional author explanation for the completion choices. */
class ActivityCompletionChoiceConfiguration
{
    public const CONFIG_KEY = 'completionChoicePrompt';

    /** @param array<string, mixed> $existing @param array<string, mixed> $data */
    public function mergeInto(array $existing, array $data): array
    {
        if (! $this->shouldUpdate($data)) {
            return $existing;
        }

        $prompt = trim((string) ($data['completion_choice_prompt'] ?? ''));

        if ($prompt === '') {
            unset($existing[self::CONFIG_KEY]);
        } else {
            $existing[self::CONFIG_KEY] = $prompt;
        }

        return $existing;
    }

    /** @param array<string, mixed> $data */
    public function shouldUpdate(array $data): bool
    {
        return array_key_exists('completion_choice_prompt', $data);
    }

    public function forActivity(LearningActivity $activity): ?string
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $prompt = trim((string) ($config[self::CONFIG_KEY] ?? ''));

        return $prompt === '' ? null : $prompt;
    }
}
