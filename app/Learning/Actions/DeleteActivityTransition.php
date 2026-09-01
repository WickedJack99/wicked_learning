<?php

namespace App\Learning\Actions;

use App\Models\ActivityTransition;
use App\Models\LearningNode;
use App\Models\User;

class DeleteActivityTransition
{
    public function __construct(private readonly RecordLearningActivityVersion $recordVersion) {}

    public function handle(ActivityTransition $transition, ?User $user = null): LearningNode
    {
        $transition->loadMissing('fromActivity.node');
        $node = $transition->fromActivity->node;

        if ($user instanceof User) {
            $this->recordVersion->handle($user, $transition->fromActivity);
        }

        $transition->delete();

        return $node;
    }
}
