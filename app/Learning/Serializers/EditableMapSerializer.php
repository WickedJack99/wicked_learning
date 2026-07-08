<?php

namespace App\Learning\Serializers;

use App\Models\LearningMap;
use App\Models\LearningNode;

class EditableMapSerializer
{
    public function __construct(private readonly AdminWorldSummarySerializer $summary) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningMap $map): array
    {
        return [
            'world' => $this->summary->world($map->world),
            'map' => [
                ...$this->summary->map($map),
                'backgroundConfig' => $map->background_config ?? [],
                'gridConfig' => $map->grid_config ?? [],
                'nodes' => $map->nodes
                    ->sortBy([['position_q', 'asc'], ['position_r', 'asc']])
                    ->values()
                    ->map(fn (LearningNode $node): array => $this->summary->node($node))
                    ->all(),
            ],
        ];
    }
}
