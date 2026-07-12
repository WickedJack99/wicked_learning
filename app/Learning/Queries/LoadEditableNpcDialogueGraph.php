<?php

namespace App\Learning\Queries;

use App\Models\LearningActivity;

class LoadEditableNpcDialogueGraph
{
    public function handle(LearningActivity $activity): LearningActivity
    {
        abort_unless($activity->type === 'npc_dialogue', 404);

        $activity->loadMissing(
            'node.map.world',
            'node.map.world.maps.nodes',
            'npcDialogueNodes',
            'npcDialogueTransitions.fromNode',
            'npcDialogueTransitions.toNode',
        );

        return $activity;
    }
}
