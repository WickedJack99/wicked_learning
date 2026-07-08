<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningNodeVisualConfig;
use App\Models\LearningMap;
use App\Models\LearningNode;

class CreateLearningNode
{
    public function __construct(private readonly LearningNodeVisualConfig $nodeVisualConfig) {}

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

        return $node;
    }
}
