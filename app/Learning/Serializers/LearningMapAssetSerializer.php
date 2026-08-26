<?php

namespace App\Learning\Serializers;

use App\Models\LearningMapAsset;

class LearningMapAssetSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningMapAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'nodeId' => $asset->learning_node_id,
            'imageUrl' => $asset->image_url,
            'text' => $asset->text,
            'x' => $asset->position_x,
            'y' => $asset->position_y,
            'z' => $asset->position_z,
            'width' => $asset->width,
            'opacity' => $asset->opacity,
            'locked' => $asset->locked,
            'focusable' => $asset->focusable,
            'interactionMode' => $asset->interaction_mode ?? ($asset->focusable ? 'focusable' : 'decorative'),
            'interactionConfig' => $asset->interaction_config ?? [],
            'visualConfig' => $asset->visual_config ?? [],
            'soundConfig' => $asset->sound_config ?? [],
        ];
    }
}
