<?php

namespace App\Learning\Queries;

use App\Models\LearningNode;

class LoadEditableActivityGraph
{
    public function handle(LearningNode $node): LearningNode
    {
        $node->loadMissing(
            'map.world',
            'activities.npcDialogueNodes',
            'activities.transitions.toActivity',
            'activities.outgoingPortalLink.targetActivity.node.map',
            'activities.outgoingPortalLink.targetNode.map',
            'activityStarts.activity',
        );

        return $node;
    }
}
