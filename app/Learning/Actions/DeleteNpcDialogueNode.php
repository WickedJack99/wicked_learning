<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningActivityReviewState;
use App\Learning\Services\NpcDialogueConfiguration;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;

class DeleteNpcDialogueNode
{
    public function __construct(
        private readonly NpcDialogueConfiguration $configuration,
        private readonly LearningActivityReviewState $reviewState,
    ) {}

    public function handle(NpcDialogueNode $node): LearningActivity
    {
        $node->loadMissing('activity');
        $activity = $node->activity;

        if ($node->type === 'end') {
            ActivityTransition::query()
                ->where('from_activity_id', $activity->id)
                ->where('from_connector', $this->configuration->connectorId($node))
                ->delete();
        }

        $node->delete();
        $this->reviewState->markNeedsReview($activity);

        return $activity;
    }
}
