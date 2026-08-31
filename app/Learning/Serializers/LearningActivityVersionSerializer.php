<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivityVersion;

class LearningActivityVersionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningActivityVersion $version): array
    {
        $snapshot = $this->snapshot($version);

        return [
            'id' => $version->id,
            'introduction' => $snapshot['introduction'] ?? null,
            'slug' => $snapshot['slug'] ?? null,
            'title' => $snapshot['title'] ?? null,
            'type' => $snapshot['type'] ?? null,
            'createdAt' => $version->created_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    public function serializeDetails(LearningActivityVersion $version): array
    {
        return [
            ...$this->serialize($version),
            'snapshot' => $this->snapshot($version),
        ];
    }

    /** @return array<string, mixed> */
    private function snapshot(LearningActivityVersion $version): array
    {
        return is_array($version->snapshot) ? $version->snapshot : [];
    }
}
