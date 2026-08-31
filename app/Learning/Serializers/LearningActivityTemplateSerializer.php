<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivityTemplate;
use App\Models\User;

class LearningActivityTemplateSerializer
{
    /** @return array<string, mixed> */
    public function serialize(
        LearningActivityTemplate $template,
        ?User $viewer = null,
    ): array {
        $snapshot = is_array($template->snapshot) ? $template->snapshot : [];

        return [
            'id' => $template->id,
            'canManage' => $viewer?->id === $template->created_by_user_id,
            'name' => $template->name,
            'title' => $snapshot['title'] ?? $template->name,
            'type' => $template->type,
            'updatedAt' => $template->updated_at?->toIso8601String(),
            'organization' => $template->organization ? [
                'id' => $template->organization->id,
                'name' => $template->organization->name,
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    public function serializeDetails(
        LearningActivityTemplate $template,
        ?User $viewer = null,
    ): array {
        return [
            ...$this->serialize($template, $viewer),
            'snapshot' => is_array($template->snapshot) ? $template->snapshot : [],
        ];
    }
}
