<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningActivityReviewState;
use App\Models\LearningActivity;
use App\Models\NpcDialogueTransition;

class DeleteNpcDialogueTransition
{
    public function __construct(private readonly LearningActivityReviewState $reviewState) {}

    public function handle(NpcDialogueTransition $transition): LearningActivity
    {
        $transition->loadMissing('activity');
        $activity = $transition->activity;
        $transition->delete();
        $this->reviewState->markNeedsReview($activity);

        return $activity;
    }
}
