<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use Illuminate\Support\Str;

class ActivityCompetenceConfiguration
{
    public const CONFIG_KEY = 'competenceTopics';

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function mergeInto(array $existing, array $data): array
    {
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

    public function shouldUpdate(array $data): bool
    {
        return array_key_exists('competence_topics', $data);
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
}
