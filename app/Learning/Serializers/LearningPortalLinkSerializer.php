<?php

namespace App\Learning\Serializers;

use App\Learning\Services\LearningNodeStateResolver;
use App\Models\LearningPortalLink;

class LearningPortalLinkSerializer
{
    public function __construct(
        private readonly LearningNodeStateResolver $nodeStateResolver,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningPortalLink $link, ?int $userId = null): array
    {
        return [
            'id' => $link->id,
            'label' => $link->label,
            'description' => $link->description,
            'sourceActivityId' => $link->source_learning_activity_id,
            'targetActivityId' => $link->target_learning_activity_id,
            'targetMapId' => $link->targetNode->map->id,
            'targetMapSlug' => $link->targetNode->map->slug,
            'targetMapTitle' => $link->targetNode->map->title,
            'targetNodeId' => $link->targetNode->id,
            'targetNodeSlug' => $link->targetNode->slug,
            'targetNodeState' => $this->nodeStateResolver->stateForUser($link->targetNode, $userId),
            'targetNodeTitle' => $link->targetNode->title,
        ];
    }
}
