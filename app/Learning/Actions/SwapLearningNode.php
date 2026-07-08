<?php

namespace App\Learning\Actions;

use App\Learning\Services\HexGridPositionService;
use App\Models\LearningNode;

class SwapLearningNode
{
    public function __construct(private readonly HexGridPositionService $positions) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningNode $node, array $data): void
    {
        $this->positions->swapWithNeighbor(
            $node,
            $this->positions->directionFrom($data),
        );
    }
}
