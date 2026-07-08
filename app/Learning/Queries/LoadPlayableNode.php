<?php

namespace App\Learning\Queries;

use App\Models\LearningNode;

class LoadPlayableNode
{
    public function handle(LearningNode $node): LearningNode
    {
        $node->loadMissing([
            'map.world',
            'activities.dialogueStages',
            'activities.question.options',
            'activities.transitions',
            'activityStarts.activity',
            'outgoingPortalLinks.targetNode.map',
        ]);

        abort_if($node->state === 'hidden' || $node->state === 'locked', 404);

        return $node;
    }
}
