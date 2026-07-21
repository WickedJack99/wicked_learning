<?php

namespace App\Learning\Services;

/** Normalizes the generic shared task configuration used by learner groups. */
class SharedTaskActivityConfiguration
{
    /** @param array<string, mixed> $data @param array<string, mixed> $existing @return array<string, mixed> */
    public function fromData(array $data, array $existing = []): array
    {
        return [
            ...$existing,
            'taskKind' => $this->choice($data, 'shared_task_kind', $existing, 'taskKind', ['text', 'question', 'reflection'], 'text'),
            'prompt' => $this->string($data, 'shared_task_prompt', $existing, 'prompt', 'Add a useful contribution.'),
            'instructions' => $this->string($data, 'shared_task_instructions', $existing, 'instructions', ''),
            'inputLabel' => $this->string($data, 'shared_task_input_label', $existing, 'inputLabel', 'Your contribution'),
            'threshold' => $this->integer($data, 'shared_task_threshold', $existing, 'threshold', 3, 1, 1000),
            'minimumLength' => $this->integer($data, 'shared_task_minimum_length', $existing, 'minimumLength', 20, 0, 10000),
            'repeatPolicy' => $this->choice($data, 'shared_task_repeat_policy', $existing, 'repeatPolicy', ['once_per_user', 'unlimited'], 'once_per_user'),
            'validationMode' => $this->choice($data, 'shared_task_validation_mode', $existing, 'validationMode', ['minimum_length', 'none'], 'minimum_length'),
            'cycleMode' => $this->choice($data, 'shared_task_cycle_mode', $existing, 'cycleMode', ['none', 'question_response_question'], 'none'),
        ];
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $updates */
    public function shouldUpdate(array $data, array $updates): bool
    {
        return array_key_exists('type', $updates) || array_intersect_key($data, array_flip([
            'shared_task_kind',
            'shared_task_prompt',
            'shared_task_instructions',
            'shared_task_input_label',
            'shared_task_threshold',
            'shared_task_minimum_length',
            'shared_task_repeat_policy',
            'shared_task_validation_mode',
            'shared_task_cycle_mode',
        ])) !== [];
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing */
    private function string(array $data, string $field, array $existing, string $key, string $fallback): string
    {
        return array_key_exists($field, $data)
            ? trim((string) $data[$field])
            : (string) ($existing[$key] ?? $fallback);
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing */
    private function integer(array $data, string $field, array $existing, string $key, int $fallback, int $min, int $max): int
    {
        $value = array_key_exists($field, $data) ? $data[$field] : ($existing[$key] ?? $fallback);
        $integer = is_numeric($value) ? (int) $value : $fallback;

        return min($max, max($min, $integer));
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @param  list<string>  $allowed
     */
    private function choice(array $data, string $field, array $existing, string $key, array $allowed, string $fallback): string
    {
        $value = array_key_exists($field, $data) ? (string) $data[$field] : (string) ($existing[$key] ?? $fallback);

        return in_array($value, $allowed, true) ? $value : $fallback;
    }
}
