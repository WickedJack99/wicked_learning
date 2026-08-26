<?php

namespace App\Learning\Services;

/** Keeps the learner-directed prompt for an open practice activity consistent. */
class OpenPracticeActivityConfiguration
{
    public const DEFAULT_NEXT_STEP = 'Choose a useful next step, then continue when you are ready.';

    /** @param array<string, mixed> $data @param array<string, mixed> $existing @return array<string, mixed> */
    public function fromData(array $data, array $existing = []): array
    {
        $nextStep = array_key_exists('open_practice_next_step', $data)
            ? trim((string) $data['open_practice_next_step'])
            : (string) ($existing['nextStep'] ?? self::DEFAULT_NEXT_STEP);

        return [
            ...$existing,
            'nextStep' => $nextStep !== '' ? $nextStep : self::DEFAULT_NEXT_STEP,
        ];
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $updates */
    public function shouldUpdate(array $data, array $updates): bool
    {
        return array_key_exists('type', $updates)
            || array_key_exists('open_practice_next_step', $data);
    }
}
