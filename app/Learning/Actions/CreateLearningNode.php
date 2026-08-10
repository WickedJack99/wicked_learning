<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningNodeVisualConfig;
use App\Models\LearningMap;
use App\Models\LearningNode;

class CreateLearningNode
{
    public function __construct(
        private readonly LearningNodeVisualConfig $nodeVisualConfig,
        private readonly CreateLearningMapAsset $createMapAsset,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningMap $map, array $data): LearningNode
    {
        $node = new LearningNode([
            'learning_map_id' => $map->id,
            'position_q' => $data['position_q'],
            'position_r' => $data['position_r'],
        ]);

        $this->nodeVisualConfig->fillNode($node, $map, $data);
        $node->save();
        $this->createMapAsset->handle($map, [
            'learning_node_id' => $node->id,
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 14,
            'opacity' => 1,
            'locked' => false,
        ]);

        return $node;
    }
}
