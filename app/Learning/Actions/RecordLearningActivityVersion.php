<?php

namespace App\Learning\Actions;

use App\Models\LearningActivity;
use App\Models\LearningActivityVersion;
use App\Models\User;

class RecordLearningActivityVersion
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(LearningActivity $activity): array
    {
        return [
            'companionConfig' => $activity->companion_config ?? [],
            'config' => $activity->config ?? [],
            'graphPositionX' => $activity->graph_position_x,
            'graphPositionY' => $activity->graph_position_y,
            'introduction' => $activity->introduction,
            'slug' => $activity->slug,
            'title' => $activity->title,
            'type' => $activity->type,
        ];
    }

    public function handle(
        User $user,
        LearningActivity $activity,
        ?array $snapshot = null,
    ): LearningActivityVersion {
        return $activity->versions()->create([
            'changed_by' => $user->id,
            'snapshot' => $snapshot ?? $this->snapshot($activity),
        ]);
    }
}
