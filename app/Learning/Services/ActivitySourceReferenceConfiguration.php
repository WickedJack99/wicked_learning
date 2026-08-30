<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;

/** Normalizes bounded source references attached to learner-facing activities. */
class ActivitySourceReferenceConfiguration
{
    public const CONFIG_KEY = 'sourceReferences';

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

        $references = $this->normalize($data['source_references'] ?? null);

        if ($references === []) {
            unset($existing[self::CONFIG_KEY]);
        } else {
            $existing[self::CONFIG_KEY] = $references;
        }

        return $existing;
    }

    /** @param array<string, mixed> $data */
    public function shouldUpdate(array $data): bool
    {
        return array_key_exists('source_references', $data);
    }

    /** @return list<array<string, string|null>> */
    public function forActivity(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return $this->normalize($config[self::CONFIG_KEY] ?? null);
    }

    /**
     * @return list<array<string, string|null>>
     */
    public function normalize(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $references = [];

        foreach (array_slice($value, 0, 5) as $reference) {
            if (! is_array($reference)) {
                continue;
            }

            $title = $this->text($reference['title'] ?? null);
            $url = $this->text($reference['url'] ?? null);

            if ($title === null || $url === null) {
                continue;
            }

            $normalized = [
                'title' => $title,
                'url' => $url,
                'publisher' => $this->text($reference['publisher'] ?? null),
                'publishedAt' => $this->text($reference['publishedAt'] ?? null),
                'rights' => $this->text($reference['rights'] ?? null),
                'anchor' => $this->text($reference['anchor'] ?? null),
                'excerpt' => $this->text($reference['excerpt'] ?? null, 800),
            ];

            $concepts = $this->concepts($reference['concepts'] ?? null);

            if ($concepts !== []) {
                $normalized['concepts'] = $concepts;
            }

            $references[] = $normalized;
        }

        return $references;
    }

    private function text(mixed $value, ?int $limit = null): ?string
    {
        $text = trim((string) ($value ?? ''));

        if ($limit !== null) {
            $text = mb_substr($text, 0, $limit);
        }

        return $text === '' ? null : $text;
    }

    /** @return list<string> */
    private function concepts(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $concepts = [];
        $seen = [];

        foreach (array_slice($value, 0, 8) as $concept) {
            $name = $this->text($concept, 120);
            $key = $name === null ? null : mb_strtolower($name);

            if ($name === null || $key === null || isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $concepts[] = $name;
        }

        return $concepts;
    }
}
