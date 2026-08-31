<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;

class CaptureLearningActivityTemplateSnapshot
{
    public function __construct(private readonly QuestionActivityConfiguration $questionConfig) {}

    /** @return array{companionConfig: array<string, mixed>, config: array<string, mixed>, introduction: string|null, question: array<string, mixed>, title: string, type: string} */
    public function handle(LearningActivity $activity): array
    {
        return [
            'companionConfig' => is_array($activity->companion_config) ? $activity->companion_config : [],
            'config' => is_array($activity->config) ? $activity->config : [],
            'introduction' => $activity->introduction,
            'question' => $this->questionConfig->snapshot($activity),
            'title' => $activity->title,
            'type' => $activity->type,
        ];
    }

    /** @return array{type: string, snapshot: array<string, mixed>} */
    public function values(LearningActivity $activity): array
    {
        return [
            'type' => $activity->type,
            'snapshot' => $this->handle($activity),
        ];
    }
}
