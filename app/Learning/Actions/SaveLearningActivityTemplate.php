<?php

namespace App\Learning\Actions;

use App\Models\LearningActivity;
use App\Models\LearningActivityTemplate;
use App\Models\User;

class SaveLearningActivityTemplate
{
    public function handle(
        User $user,
        LearningActivity $activity,
        string $name,
    ): LearningActivityTemplate {
        return LearningActivityTemplate::query()->create([
            'created_by_user_id' => $user->id,
            'name' => trim($name),
            'type' => $activity->type,
            'snapshot' => [
                'companionConfig' => $activity->companion_config ?? [],
                'config' => $activity->config ?? [],
                'introduction' => $activity->introduction,
                'title' => $activity->title,
                'type' => $activity->type,
            ],
        ]);
    }
}
