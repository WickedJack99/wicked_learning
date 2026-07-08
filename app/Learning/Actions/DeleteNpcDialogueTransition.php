<?php

namespace App\Learning\Actions;

use App\Models\LearningActivity;
use App\Models\NpcDialogueTransition;

class DeleteNpcDialogueTransition
{
    public function handle(NpcDialogueTransition $transition): LearningActivity
    {
        $transition->loadMissing('activity');
        $activity = $transition->activity;
        $transition->delete();

        return $activity;
    }
}
