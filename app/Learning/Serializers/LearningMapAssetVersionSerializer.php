<?php

namespace App\Learning\Serializers;

use App\Models\LearningMapAssetVersion;

class LearningMapAssetVersionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningMapAssetVersion $version): array
    {
        return [
            'id' => $version->id,
            'imageUrl' => $version->image_url,
            'text' => $version->text,
            'x' => $version->position_x,
            'y' => $version->position_y,
            'z' => $version->position_z,
            'width' => $version->width,
            'opacity' => $version->opacity,
            'locked' => (bool) $version->locked,
            'focusable' => (bool) $version->focusable,
            'interactionMode' => $version->interaction_mode,
            'interactionConfig' => $version->interaction_config ?? [],
            'visualConfig' => $version->visual_config ?? [],
            'soundConfig' => $version->sound_config ?? [],
            'createdAt' => $version->created_at?->toIso8601String(),
        ];
    }
}
