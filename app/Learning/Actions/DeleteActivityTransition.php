<?php

namespace App\Learning\Actions;

use App\Models\ActivityTransition;
use App\Models\LearningNode;

class DeleteActivityTransition
{
    public function handle(ActivityTransition $transition): LearningNode
    {
        $transition->loadMissing('fromActivity.node');
        $node = $transition->fromActivity->node;
        $transition->delete();

        return $node;
    }
}
