<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use Illuminate\Support\Str;

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
            'rubric' => $data['feedback_rubric'] ?? null,
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
            || array_key_exists('feedback_next_action', $data)
            || array_key_exists('feedback_rubric', $data);
    }

    /** @return array{purpose: string|null, evidence: string|null, nextAction: string|null, rubric?: list<string>}|null */
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

    /** @return list<string> */
    public function rubricForActivity(LearningActivity $activity): array
    {
        return $this->forActivity($activity)['rubric'] ?? [];
    }

    /** @return list<string> */
    public function observedCuesForActivity(LearningActivity $activity, mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $rubric = $this->rubricForActivity($activity);

        return array_values(array_filter(
            $rubric,
            static fn (string $cue): bool => in_array($cue, $value, true),
        ));
    }

    /**
     * @param  array<string, mixed>  $guidance
     * @return array{purpose: string|null, evidence: string|null, nextAction: string|null, rubric?: list<string>}|null
     */
    private function normalize(array $guidance): ?array
    {
        $rubric = $this->rubric($guidance['rubric'] ?? null);
        $normalized = [
            'purpose' => $this->text($guidance['purpose'] ?? null),
            'evidence' => $this->text($guidance['evidence'] ?? null),
            'nextAction' => $this->text($guidance['nextAction'] ?? null),
        ];

        return $normalized['purpose'] === null
            && $normalized['evidence'] === null
            && $normalized['nextAction'] === null
            && $rubric === []
            ? null
            : ($rubric === [] ? $normalized : [...$normalized, 'rubric' => $rubric]);
    }

    private function text(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }

    /** @return list<string> */
    private function rubric(mixed $value): array
    {
        if (! is_string($value) && ! is_array($value)) {
            return [];
        }

        $lines = is_string($value) ? (preg_split('/\R/', $value) ?: []) : $value;

        return array_values(array_filter(
            array_map(
                fn (mixed $line): string => Str::limit(trim((string) $line), 300, ''),
                array_slice($lines, 0, 3),
            ),
            static fn (string $line): bool => $line !== '',
        ));
    }
}
