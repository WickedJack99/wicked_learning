<?php

namespace App\Learning\Actions;

use App\Models\LearningNode;

class UpdateNodeActivityGraphLayout
{
    /**
     * @param  array{node: string, position: array{x: int|float, y: int|float}}  $data
     */
    public function handle(LearningNode $node, array $data): LearningNode
    {
        $layout = is_array($node->activity_graph_layout) ? $node->activity_graph_layout : [];

        $layout[(string) $data['node']] = [
            'x' => (int) round((float) $data['position']['x']),
            'y' => (int) round((float) $data['position']['y']),
        ];

        $node->forceFill(['activity_graph_layout' => $layout])->save();

        return $node;
    }
}
