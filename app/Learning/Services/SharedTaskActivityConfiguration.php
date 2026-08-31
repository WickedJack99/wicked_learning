<?php

namespace App\Learning\Services;

/** Normalizes the generic shared task configuration used by learner groups. */
class SharedTaskActivityConfiguration
{
    /** @var list<string> */
    private const TASK_KINDS = ['text', 'question', 'reflection'];

    /** @param array<string, mixed> $data @param array<string, mixed> $existing @return array<string, mixed> */
    public function fromData(array $data, array $existing = []): array
    {
        $taskKind = $this->choice($data, 'shared_task_kind', $existing, 'taskKind', self::TASK_KINDS, 'text');

        return [
            ...$existing,
            'taskKind' => $taskKind,
            'showContributions' => $this->boolean($data, 'shared_task_show_contributions', $existing['showContributions'] ?? false),
            'prompt' => $this->string($data, 'shared_task_prompt', $existing, 'prompt', 'Add a useful contribution.'),
            'instructions' => $this->string($data, 'shared_task_instructions', $existing, 'instructions', ''),
            'inputLabel' => $this->inputLabel($data, $existing, $taskKind),
            'projectGoal' => $this->string($data, 'shared_task_project_goal', $existing, 'projectGoal', ''),
            'projectDeliverable' => $this->string($data, 'shared_task_project_deliverable', $existing, 'projectDeliverable', ''),
            'projectSteps' => $this->steps($data, $existing),
            'peerReviewEnabled' => $this->boolean($data, 'shared_task_peer_review_enabled', $existing['peerReviewEnabled'] ?? false),
            'peerReviewPrompt' => $this->string($data, 'shared_task_peer_review_prompt', $existing, 'peerReviewPrompt', 'What does this contribution help you notice, question, or extend?'),
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
            'shared_task_show_contributions',
            'shared_task_prompt',
            'shared_task_instructions',
            'shared_task_input_label',
            'shared_task_project_goal',
            'shared_task_project_deliverable',
            'shared_task_project_steps',
            'shared_task_peer_review_enabled',
            'shared_task_peer_review_prompt',
            'shared_task_threshold',
            'shared_task_minimum_length',
            'shared_task_repeat_policy',
            'shared_task_validation_mode',
            'shared_task_cycle_mode',
        ])) !== [];
    }

    /** @param array<string, mixed> $config */
    public function taskKind(array $config): string
    {
        $taskKind = (string) ($config['taskKind'] ?? 'text');

        return in_array($taskKind, self::TASK_KINDS, true) ? $taskKind : 'text';
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing */
    private function inputLabel(array $data, array $existing, string $taskKind): string
    {
        if (array_key_exists('shared_task_input_label', $data)) {
            return trim((string) $data['shared_task_input_label']);
        }

        $existingLabel = (string) ($existing['inputLabel'] ?? '');

        if ($existingLabel !== '' && $existingLabel !== 'Your contribution') {
            return $existingLabel;
        }

        return match ($taskKind) {
            'question' => 'Your question',
            'reflection' => 'Your reflection',
            default => 'Your contribution',
        };
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing @return list<string> */
    private function steps(array $data, array $existing): array
    {
        $value = array_key_exists('shared_task_project_steps', $data)
            ? (string) $data['shared_task_project_steps']
            : implode("\n", is_array($existing['projectSteps'] ?? null) ? $existing['projectSteps'] : []);

        return collect(preg_split('/\r?\n/', $value) ?: [])
            ->map(fn (string $step): string => trim($step))
            ->filter()
            ->map(fn (string $step): string => mb_substr($step, 0, 240))
            ->take(6)
            ->values()
            ->all();
    }

    /** @param array<string, mixed> $data */
    private function boolean(array $data, string $field, mixed $fallback): bool
    {
        return array_key_exists($field, $data)
            ? filter_var($data[$field], FILTER_VALIDATE_BOOLEAN)
            : (bool) $fallback;
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
