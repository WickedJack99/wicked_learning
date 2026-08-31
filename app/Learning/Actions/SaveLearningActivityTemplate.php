<?php

namespace App\Learning\Actions;

use App\Learning\Services\QuestionActivityConfiguration;
use App\Models\LearningActivity;
use App\Models\LearningActivityTemplate;
use App\Models\User;

class SaveLearningActivityTemplate
{
    public function __construct(private readonly QuestionActivityConfiguration $questionConfig) {}

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
                'question' => $this->questionConfig->snapshot($activity),
                'title' => $activity->title,
                'type' => $activity->type,
            ],
        ]);
    }
}
