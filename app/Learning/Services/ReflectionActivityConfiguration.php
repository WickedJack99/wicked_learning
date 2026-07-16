<?php

namespace App\Learning\Services;

/** Normalizes the small, learner-facing prompt configuration for reflections. */
class ReflectionActivityConfiguration
{
    /** @param array<string, mixed> $data @param array<string, mixed> $existing @return array<string, mixed> */
    public function fromData(array $data, array $existing = []): array
    {
        return [
            ...$existing,
            'prompt' => array_key_exists('reflection_prompt', $data)
                ? trim((string) $data['reflection_prompt'])
                : (string) ($existing['prompt'] ?? 'What feels clearer now?'),
            'note' => array_key_exists('reflection_note', $data)
                ? trim((string) $data['reflection_note'])
                : (string) ($existing['note'] ?? ''),
            'topic' => array_key_exists('reflection_topic', $data)
                ? trim((string) $data['reflection_topic'])
                : (string) ($existing['topic'] ?? ''),
            'subtopic' => array_key_exists('reflection_subtopic', $data)
                ? trim((string) $data['reflection_subtopic'])
                : (string) ($existing['subtopic'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $updates */
    public function shouldUpdate(array $data, array $updates): bool
    {
        return array_key_exists('type', $updates) || array_intersect_key($data, array_flip([
            'reflection_prompt', 'reflection_note', 'reflection_topic', 'reflection_subtopic',
        ])) !== [];
    }
}
