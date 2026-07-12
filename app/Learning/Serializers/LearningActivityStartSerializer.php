<?php

namespace App\Learning\Serializers;

use App\Learning\Services\LearnerRouteProgressService;
use App\Models\LearningActivityStart;
use App\Models\User;

class LearningActivityStartSerializer
{
    public function __construct(private readonly LearnerRouteProgressService $routeProgress) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningActivityStart $start, ?User $user = null): array
    {
        return [
            'id' => $start->id,
            'activityId' => $start->learning_activity_id,
            'buttonBorderColorDark' => $start->button_border_color_dark,
            'buttonBorderColorLight' => $start->button_border_color_light,
            'buttonColorDark' => $start->button_color_dark,
            'buttonColorLight' => $start->button_color_light,
            'imageDark' => $start->image_dark,
            'imageLight' => $start->image_light,
            'label' => $start->label ?: $start->activity->title,
            'progress' => $user ? $this->progress($start, $user) : null,
            'sortOrder' => $start->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function progress(LearningActivityStart $start, User $user): ?array
    {
        $progress = $this->routeProgress->progressForStart($user, $start);

        if (! $progress) {
            return null;
        }

        return [
            'completionCount' => $progress->completion_count,
            'currentActivityId' => $progress->current_learning_activity_id,
            'lastCompletedAt' => $progress->last_completed_at?->toIso8601String(),
            'lastEnteredAt' => $progress->last_entered_at?->toIso8601String(),
            'playRunId' => $progress->current_play_run_id,
            'status' => $progress->status,
        ];
    }
}
