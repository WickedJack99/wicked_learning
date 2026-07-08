<?php

namespace App\Learning\Services;

use App\Models\LearningMap;
use App\Models\LearningNode;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HexGridPositionService
{
    /**
     * @param  array<string, mixed>  $data
     * @return array{0: int, 1: int}
     */
    public function directionFrom(array $data): array
    {
        $direction = [(int) $data['direction_q'], (int) $data['direction_r']];
        $allowedDirections = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

        if (! in_array($direction, $allowedDirections, true)) {
            throw ValidationException::withMessages([
                'direction' => 'Choose one neighboring hex direction.',
            ]);
        }

        return $direction;
    }

    public function nodeAt(LearningMap $map, int $q, int $r): ?LearningNode
    {
        return LearningNode::query()
            ->where('learning_map_id', $map->id)
            ->where('position_q', $q)
            ->where('position_r', $r)
            ->first();
    }

    /**
     * @param  array{0: int, 1: int}  $direction
     */
    public function insertAtNeighbor(
        LearningNode $origin,
        array $direction,
        callable $createNode,
    ): void {
        $origin->loadMissing('map');
        $insertQ = $origin->position_q + $direction[0];
        $insertR = $origin->position_r + $direction[1];

        if (! $this->nodeAt($origin->map, $insertQ, $insertR)) {
            throw ValidationException::withMessages([
                'direction' => 'There is no neighboring tile in that direction.',
            ]);
        }

        DB::transaction(function () use ($createNode, $direction, $insertQ, $insertR, $origin): void {
            $this->pushNodeChain($origin->map, $insertQ, $insertR, $direction);
            $createNode($insertQ, $insertR);
        });
    }

    /**
     * @param  array{0: int, 1: int}  $direction
     */
    public function swapWithNeighbor(LearningNode $node, array $direction): void
    {
        $node->loadMissing('map');
        $targetNode = $this->nodeAt(
            $node->map,
            $node->position_q + $direction[0],
            $node->position_r + $direction[1],
        );

        if (! $targetNode) {
            throw ValidationException::withMessages([
                'direction' => 'There is no neighboring tile in that direction.',
            ]);
        }

        $this->swapNodes($node, $targetNode);
    }

    private function swapNodes(LearningNode $sourceNode, LearningNode $targetNode): void
    {
        $sourcePosition = ['q' => $sourceNode->position_q, 'r' => $sourceNode->position_r];
        $targetPosition = ['q' => $targetNode->position_q, 'r' => $targetNode->position_r];

        DB::transaction(function () use ($sourceNode, $sourcePosition, $targetNode, $targetPosition): void {
            $temporaryOffset = 100000;

            $sourceNode->forceFill([
                'position_q' => $sourcePosition['q'] + $temporaryOffset,
                'position_r' => $sourcePosition['r'] + $temporaryOffset,
            ])->save();

            $targetNode->forceFill($this->positionAttributes($sourcePosition))->save();
            $sourceNode->forceFill($this->positionAttributes($targetPosition))->save();
        });
    }

    /**
     * @param  array{q: int, r: int}  $position
     * @return array<string, int>
     */
    private function positionAttributes(array $position): array
    {
        return [
            'position_q' => $position['q'],
            'position_r' => $position['r'],
        ];
    }

    /**
     * @param  array{0: int, 1: int}  $direction
     */
    private function pushNodeChain(LearningMap $map, int $startQ, int $startR, array $direction): void
    {
        $chain = [];
        $q = $startQ;
        $r = $startR;

        while ($node = $this->nodeAt($map, $q, $r)) {
            $chain[] = $node;
            $q += $direction[0];
            $r += $direction[1];
        }

        foreach (array_reverse($chain) as $node) {
            $node->forceFill([
                'position_q' => $node->position_q + $direction[0],
                'position_r' => $node->position_r + $direction[1],
            ])->save();
        }
    }
}
