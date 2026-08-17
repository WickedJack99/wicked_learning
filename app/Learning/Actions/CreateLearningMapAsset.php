<?php

namespace App\Learning\Actions;

use App\Learning\MapAssetInteractionMode;
use App\Learning\Services\LearningNodeVisualConfig;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;

class CreateLearningMapAsset
{
    public function __construct(
        private readonly LearningNodeVisualConfig $nodeVisualConfig,
    ) {}

    /** @param array<string, mixed> $data */
    public function handle(LearningMap $map, array $data): LearningMapAsset
    {
        $interactionMode = $this->interactionMode($data);
        $nodeId = $data['learning_node_id'] ?? null;

        if (! $nodeId) {
            $node = new LearningNode([
                'learning_map_id' => $map->id,
                ...$this->nextNodePosition($map),
            ]);
            $title = trim((string) ($data['title'] ?? $data['text'] ?? 'MapAsset'));

            $this->nodeVisualConfig->fillNode($node, $map, [
                'title' => $title !== '' ? $title : 'MapAsset',
                'description' => $data['description'] ?? null,
                'state' => 'available',
                'visual_config' => $data['visual_config'] ?? [],
            ]);
            $node->save();
            $nodeId = $node->id;
        }

        return $map->assets()->create([
            'learning_node_id' => $nodeId,
            'image_url' => $data['image_url'] ?? null,
            'text' => $data['text'] ?? null,
            'position_x' => $data['position_x'] ?? 50,
            'position_y' => $data['position_y'] ?? 50,
            'position_z' => $data['position_z'] ?? 0,
            'width' => $data['width'] ?? 14,
            'opacity' => $data['opacity'] ?? 1,
            'locked' => $data['locked'] ?? false,
            'focusable' => $interactionMode->opensLearnerPanel(),
            'interaction_mode' => $interactionMode->value,
            'interaction_config' => $data['interaction_config'] ?? null,
            'visual_config' => $data['visual_config'] ?? null,
            'sound_config' => $data['sound_config'] ?? null,
        ]);
    }

    /** @param array<string, mixed> $data */
    private function interactionMode(array $data): MapAssetInteractionMode
    {
        if (isset($data['interaction_mode'])) {
            return MapAssetInteractionMode::from((string) $data['interaction_mode']);
        }

        return ($data['focusable'] ?? true)
            ? MapAssetInteractionMode::Focusable
            : MapAssetInteractionMode::Decorative;
    }

    /** @return array{position_q: int, position_r: int} */
    private function nextNodePosition(LearningMap $map): array
    {
        $positionQ = 0;

        while ($map->nodes()->where('position_q', $positionQ)->where('position_r', 0)->exists()) {
            $positionQ++;
        }

        return ['position_q' => $positionQ, 'position_r' => 0];
    }
}
