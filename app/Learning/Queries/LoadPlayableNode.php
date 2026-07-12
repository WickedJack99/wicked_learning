<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Learning\Services\LearningNodeStateResolver;
use App\Models\LearningNode;
use App\Models\User;

class LoadPlayableNode
{
    public function __construct(
        private readonly LearningNodeStateResolver $nodeStateResolver,
        private readonly LearningMapAccessService $mapAccess,
    ) {}

    public function handle(LearningNode $node, ?User $user): LearningNode
    {
        $node->loadMissing([
            'map.world',
            'activities.dialogueStages',
            'activities.npcDialogueNodes',
            'activities.npcDialogueTransitions',
            'activities.question.options',
            'activities.transitions',
            'activityStarts.activity',
            'discoveries',
            'outgoingPortalLinks.targetNode.discoveries',
            'outgoingPortalLinks.targetNode.map',
        ]);

        abort_unless($this->mapAccess->canViewMap($node->map, $user), 404);
        abort_unless($this->nodeStateResolver->canPlay($node, $user?->id), 404);

        return $node;
    }
}
