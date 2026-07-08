<?php

namespace App\Learning\Actions;

use App\Learning\Services\ActivityStartRouteService;
use App\Models\LearningActivity;
use App\Models\LearningNode;

class DeleteLearningActivity
{
    public function __construct(private readonly ActivityStartRouteService $startRouteService) {}

    public function handle(LearningActivity $activity): LearningNode
    {
        $activity->loadMissing('node');
        $node = $activity->node;

        if ($node->start_activity_id === $activity->id) {
            $node->forceFill(['start_activity_id' => null])->save();
        }

        $node->activityStarts()
            ->where('learning_activity_id', $activity->id)
            ->delete();
        $this->startRouteService->syncLegacyStartActivity($node);

        $activity->delete();

        return $node;
    }
}
