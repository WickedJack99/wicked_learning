<?php

namespace App\Learning\Actions;

use App\Learning\Services\QuestionActivityConfiguration;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityVersion;
use App\Models\User;

class RecordLearningActivityVersion
{
    public function __construct(private readonly QuestionActivityConfiguration $questionConfig) {}

    /**
     * @return array<string, mixed>
     */
    public function snapshot(LearningActivity $activity): array
    {
        $transitions = $activity->relationLoaded('transitions')
            ? $activity->transitions
            : $activity->transitions()->with('toActivity')->orderBy('id')->get();
        $transitions->loadMissing('toActivity');

        return [
            'companionConfig' => $activity->companion_config ?? [],
            'config' => $activity->config ?? [],
            'graphPositionX' => $activity->graph_position_x,
            'graphPositionY' => $activity->graph_position_y,
            'introduction' => $activity->introduction,
            'slug' => $activity->slug,
            'title' => $activity->title,
            'type' => $activity->type,
            'question' => $this->questionConfig->snapshot($activity),
            'transitions' => $transitions->map(fn (ActivityTransition $transition): array => [
                'fromConnector' => $transition->from_connector,
                'label' => $transition->label,
                'rules' => $transition->rules ?? [],
                'toActivityId' => $transition->to_activity_id,
                'toActivitySlug' => $transition->toActivity?->slug,
                'toConnector' => $transition->to_connector,
                'trigger' => $transition->trigger,
                'triggerValue' => $transition->trigger_value,
            ])->values()->all(),
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
