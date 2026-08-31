<?php

namespace App\Learning\Serializers;

use App\Models\LearningMapVersion;

class LearningMapVersionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningMapVersion $version): array
    {
        return [
            'description' => $version->description,
            'id' => $version->id,
            'learningTopicId' => $version->learning_topic_id,
            'mapAssetsLocked' => (bool) $version->map_assets_locked,
            'title' => $version->title,
            'createdAt' => $version->created_at?->toIso8601String(),
        ];
    }
}
