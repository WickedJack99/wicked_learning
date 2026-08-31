<?php

namespace App\Learning\Serializers;

use App\Learning\Services\LearnerRouteProgressService;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivityStart;
use App\Models\User;
use Illuminate\Support\Collection;

class LearningActivityStartSerializer
{
    public function __construct(private readonly LearnerRouteProgressService $routeProgress) {}

    /**
     * @param  Collection<int, LearnerRouteProgress>|null  $progressByActivityId
     * @return array<string, mixed>
     */
    public function serialize(
        LearningActivityStart $start,
        ?User $user = null,
        ?Collection $progressByActivityId = null,
    ): array {
        return [
            'id' => $start->id,
            'activityId' => $start->learning_activity_id,
            'buttonBorderColorDark' => $start->button_border_color_dark,
            'buttonBorderColorLight' => $start->button_border_color_light,
            'buttonColorDark' => $start->button_color_dark,
            'buttonColorLight' => $start->button_color_light,
            'description' => $start->description,
            'imageDark' => $start->image_dark,
            'imageLight' => $start->image_light,
            'label' => $start->label ?: $start->activity->title,
            'progress' => $user
                ? ($progressByActivityId !== null
                    ? $progressByActivityId->get($start->learning_activity_id)
                    : $this->progress($start, $user))
                : null,
            'sortOrder' => $start->sort_order,
        ];
    }

    /**
     * @param  Collection<int, LearningActivityStart>  $starts
     * @return Collection<int, array<string, mixed>>
     */
    public function serializeMany(Collection $starts, ?User $user = null): Collection
    {
        $progressByActivityId = $user
            ? $this->routeProgress->progressForStarts($user, $starts)
            : null;

        return $starts
            ->map(fn (LearningActivityStart $start): array => $this->serialize(
                $start,
                $user,
                $progressByActivityId,
            ))
            ->values();
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
