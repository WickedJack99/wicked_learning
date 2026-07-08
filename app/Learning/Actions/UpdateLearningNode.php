<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningNodeVisualConfig;
use App\Models\LearningNode;

class UpdateLearningNode
{
    public function __construct(private readonly LearningNodeVisualConfig $nodeVisualConfig) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningNode $node, array $data): LearningNode
    {
        $node->loadMissing('map');
        $node->forceFill([
            'position_q' => $data['position_q'],
            'position_r' => $data['position_r'],
        ]);

        $this->nodeVisualConfig->fillNode($node, $node->map, $data);
        $node->save();

        return $node;
    }
}
