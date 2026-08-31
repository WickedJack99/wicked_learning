<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivityTemplate;

class LearningActivityTemplateSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningActivityTemplate $template): array
    {
        $snapshot = is_array($template->snapshot) ? $template->snapshot : [];

        return [
            'id' => $template->id,
            'name' => $template->name,
            'title' => $snapshot['title'] ?? $template->name,
            'type' => $template->type,
            'updatedAt' => $template->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    public function serializeDetails(LearningActivityTemplate $template): array
    {
        return [
            ...$this->serialize($template),
            'snapshot' => is_array($template->snapshot) ? $template->snapshot : [],
        ];
    }
}
