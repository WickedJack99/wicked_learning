<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivityTemplateRevision;

class LearningActivityTemplateRevisionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningActivityTemplateRevision $revision): array
    {
        $snapshot = is_array($revision->snapshot) ? $revision->snapshot : [];

        return [
            'createdAt' => $revision->created_at?->toIso8601String(),
            'id' => $revision->id,
            'name' => $revision->name,
            'title' => $snapshot['title'] ?? $revision->name,
            'type' => $revision->type,
        ];
    }

    /** @return array<string, mixed> */
    public function serializeDetails(LearningActivityTemplateRevision $revision): array
    {
        return [
            ...$this->serialize($revision),
            'snapshot' => is_array($revision->snapshot) ? $revision->snapshot : [],
        ];
    }
}
