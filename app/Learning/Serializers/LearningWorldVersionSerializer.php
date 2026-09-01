<?php

namespace App\Learning\Serializers;

use App\Models\LearningWorldVersion;

class LearningWorldVersionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningWorldVersion $version): array
    {
        return [
            'description' => $version->description,
            'id' => $version->id,
            'title' => $version->title,
            'createdAt' => $version->created_at?->toIso8601String(),
        ];
    }
}
