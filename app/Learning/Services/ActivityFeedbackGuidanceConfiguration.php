<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;

/** Normalizes optional author guidance for competence-supportive feedback. */
class ActivityFeedbackGuidanceConfiguration
{
    public const CONFIG_KEY = 'feedbackGuidance';

    /**
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function mergeInto(array $existing, array $data): array
    {
        if (! $this->shouldUpdate($data)) {
            return $existing;
        }

        $guidance = $this->normalize([
            'purpose' => $data['feedback_purpose'] ?? null,
            'evidence' => $data['feedback_evidence'] ?? null,
            'nextAction' => $data['feedback_next_action'] ?? null,
        ]);

        if ($guidance === null) {
            unset($existing[self::CONFIG_KEY]);
        } else {
            $existing[self::CONFIG_KEY] = $guidance;
        }

        return $existing;
    }

    /** @param array<string, mixed> $data */
    public function shouldUpdate(array $data): bool
    {
        return array_key_exists('feedback_purpose', $data)
            || array_key_exists('feedback_evidence', $data)
            || array_key_exists('feedback_next_action', $data);
    }

    /** @return array{purpose: string|null, evidence: string|null, nextAction: string|null}|null */
    public function forActivity(LearningActivity $activity): ?array
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $guidance = is_array($config[self::CONFIG_KEY] ?? null)
            ? $config[self::CONFIG_KEY]
            : [];

        return $this->normalize($guidance);
    }

    public function purposeForActivity(LearningActivity $activity): ?string
    {
        return $this->forActivity($activity)['purpose'] ?? null;
    }

    public function evidenceCriterionForActivity(LearningActivity $activity): ?string
    {
        return $this->forActivity($activity)['evidence'] ?? null;
    }

    /**
     * @param  array<string, mixed>  $guidance
     * @return array{purpose: string|null, evidence: string|null, nextAction: string|null}|null
     */
    private function normalize(array $guidance): ?array
    {
        $normalized = [
            'purpose' => $this->text($guidance['purpose'] ?? null),
            'evidence' => $this->text($guidance['evidence'] ?? null),
            'nextAction' => $this->text($guidance['nextAction'] ?? null),
        ];

        return array_filter($normalized, static fn (?string $value): bool => $value !== null) === []
            ? null
            : $normalized;
    }

    private function text(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }
}
