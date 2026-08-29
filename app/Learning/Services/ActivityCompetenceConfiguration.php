<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use Illuminate\Support\Str;

class ActivityCompetenceConfiguration
{
    public const CONFIG_KEY = 'competenceTopics';

    public const EVIDENCE_TYPES = [
        'apply',
        'explain',
        'participate',
        'reflect',
        'retrieve',
        'review',
        'transfer',
    ];

    public const LEARNING_INTENTS = [
        'apply',
        'explain',
        'participate',
        'reflect',
        'retrieve',
        'review',
        'transfer',
    ];

    public function evidenceTypeForActivity(LearningActivity $activity): string
    {
        $intent = $this->learningIntentForActivity($activity);

        return in_array($intent, ['explain', 'transfer'], true)
            && ! $this->hasObservableEvidenceGuide($activity)
            ? 'participate'
            : $intent;
    }

    public function learningIntentForActivity(LearningActivity $activity): string
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $intent = $config['learningIntent'] ?? null;

        if (is_string($intent) && in_array($intent, self::LEARNING_INTENTS, true)) {
            return $intent;
        }

        return match ($activity->type) {
            'question' => 'retrieve',
            'reflection' => 'reflect',
            'review' => 'review',
            'shared_task', 'message_prompt', 'message_wall' => 'explain',
            'obstacle', 'item_obstacle', 'tool_obstacle' => 'apply',
            default => 'participate',
        };
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function mergeInto(array $existing, array $data): array
    {
        if (array_key_exists('learning_intent', $data)) {
            $intent = trim((string) ($data['learning_intent'] ?? ''));

            if ($intent === '') {
                unset($existing['learningIntent']);
            } elseif (in_array($intent, self::LEARNING_INTENTS, true)) {
                $existing['learningIntent'] = $intent;
            }
        }

        if (! array_key_exists('competence_topics', $data)) {
            return $existing;
        }

        $topics = $this->fromSubmittedValue($data['competence_topics']);

        if ($topics === []) {
            unset($existing[self::CONFIG_KEY]);

            return $existing;
        }

        $existing[self::CONFIG_KEY] = $topics;

        return $existing;
    }

    /**
     * @return list<array{topic: string, slug: string, weight: float}>
     */
    public function topicsForActivity(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $topics = is_array($config[self::CONFIG_KEY] ?? null) ? $config[self::CONFIG_KEY] : [];

        return $this->fromSubmittedValue($topics);
    }

    /** @param array<string, mixed> $data */
    public function shouldUpdate(array $data): bool
    {
        return array_key_exists('competence_topics', $data)
            || array_key_exists('learning_intent', $data);
    }

    /**
     * @return list<array{topic: string, slug: string, weight: float}>
     */
    private function fromSubmittedValue(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $topics = [];

        foreach ($value as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $topic = trim((string) ($entry['topic'] ?? ''));
            $weight = round((float) ($entry['weight'] ?? 0), 2);
            $slug = $this->topicSlug($topic);

            if ($topic === '' || $slug === '' || $weight <= 0) {
                continue;
            }

            $topics[$slug] = [
                'topic' => Str::limit($topic, 120, ''),
                'slug' => $slug,
                'weight' => $weight,
            ];
        }

        return array_values($topics);
    }

    private function topicSlug(string $topic): string
    {
        return Str::limit(Str::slug($topic), 140, '');
    }

    private function hasObservableEvidenceGuide(LearningActivity $activity): bool
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $guidance = is_array($config['feedbackGuidance'] ?? null)
            ? $config['feedbackGuidance']
            : [];

        return trim((string) ($guidance['evidence'] ?? '')) !== '';
    }
}
