<?php

namespace App\Learning\Actions;

use App\Learning\Services\HexGridPositionService;
use App\Learning\Services\LearningNodeVisualConfig;
use App\Models\LearningNode;

class InsertLearningNodeIntoHexGrid
{
    public function __construct(
        private readonly HexGridPositionService $positions,
        private readonly LearningNodeVisualConfig $nodeVisualConfig,
        private readonly CreateLearningMapAsset $createMapAsset,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningNode $origin, array $data): void
    {
        $origin->loadMissing('map');
        $direction = $this->positions->directionFrom($data);

        $this->positions->insertAtNeighbor(
            $origin,
            $direction,
            fn (int $q, int $r) => $this->createNodeAt($origin, $data, $q, $r),
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function createNodeAt(LearningNode $origin, array $data, int $q, int $r): void
    {
        $node = new LearningNode([
            'learning_map_id' => $origin->learning_map_id,
            'position_q' => $q,
            'position_r' => $r,
        ]);

        $this->nodeVisualConfig->fillNode($node, $origin->map, $data);
        $node->save();
        $this->createMapAsset->handle($origin->map, [
            'learning_node_id' => $node->id,
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 14,
            'opacity' => 1,
            'locked' => false,
        ]);
    }
}
