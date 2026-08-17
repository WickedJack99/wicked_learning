<?php

namespace App\Learning\Actions;

use App\Learning\MapAssetInteractionMode;
use App\Models\LearningMapAsset;

class UpdateLearningMapAsset
{
    /** @param array<string, mixed> $data */
    public function handle(LearningMapAsset $asset, array $data): LearningMapAsset
    {
        $interactionMode = $this->interactionMode($asset, $data);

        $asset->update([
            'learning_node_id' => array_key_exists('learning_node_id', $data) ? $data['learning_node_id'] : $asset->learning_node_id,
            'image_url' => array_key_exists('image_url', $data) ? $data['image_url'] : $asset->image_url,
            'text' => array_key_exists('text', $data) ? $data['text'] : $asset->text,
            'position_x' => array_key_exists('position_x', $data) ? $data['position_x'] : $asset->position_x,
            'position_y' => array_key_exists('position_y', $data) ? $data['position_y'] : $asset->position_y,
            'position_z' => array_key_exists('position_z', $data) ? $data['position_z'] : $asset->position_z,
            'width' => array_key_exists('width', $data) ? $data['width'] : $asset->width,
            'opacity' => array_key_exists('opacity', $data) ? $data['opacity'] : $asset->opacity,
            'locked' => array_key_exists('locked', $data) ? $data['locked'] : $asset->locked,
            'focusable' => $interactionMode->opensLearnerPanel(),
            'interaction_mode' => $interactionMode->value,
            'interaction_config' => array_key_exists('interaction_config', $data) ? $data['interaction_config'] : $asset->interaction_config,
            'visual_config' => array_key_exists('visual_config', $data) ? $data['visual_config'] : $asset->visual_config,
            'sound_config' => array_key_exists('sound_config', $data) ? $data['sound_config'] : $asset->sound_config,
        ]);

        return $asset->refresh();
    }

    /** @param array<string, mixed> $data */
    private function interactionMode(
        LearningMapAsset $asset,
        array $data,
    ): MapAssetInteractionMode {
        if (isset($data['interaction_mode'])) {
            return MapAssetInteractionMode::from((string) $data['interaction_mode']);
        }

        if (array_key_exists('focusable', $data)) {
            return $data['focusable']
                ? MapAssetInteractionMode::Focusable
                : MapAssetInteractionMode::Decorative;
        }

        return MapAssetInteractionMode::tryFrom((string) $asset->interaction_mode)
            ?? ($asset->focusable
                ? MapAssetInteractionMode::Focusable
                : MapAssetInteractionMode::Decorative);
    }
}
