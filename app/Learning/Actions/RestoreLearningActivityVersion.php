<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningActivityReviewState;
use App\Learning\Services\QuestionActivityConfiguration;
use App\Models\LearningActivity;
use App\Models\LearningActivityVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RestoreLearningActivityVersion
{
    public function __construct(
        private readonly LearningActivityReviewState $reviewState,
        private readonly QuestionActivityConfiguration $questionConfig,
        private readonly RecordLearningActivityVersion $recordVersion,
    ) {}

    public function handle(
        User $user,
        LearningActivity $activity,
        LearningActivityVersion $version,
    ): LearningActivity {
        return DB::transaction(function () use ($activity, $user, $version): LearningActivity {
            $this->recordVersion->handle($user, $activity);
            $snapshot = is_array($version->snapshot) ? $version->snapshot : [];

            $activity->forceFill([
                'companion_config' => is_array($snapshot['companionConfig'] ?? null)
                    ? $snapshot['companionConfig']
                    : [],
                'config' => is_array($snapshot['config'] ?? null)
                    ? $snapshot['config']
                    : [],
                'graph_position_x' => $snapshot['graphPositionX'] ?? null,
                'graph_position_y' => $snapshot['graphPositionY'] ?? null,
                'introduction' => $snapshot['introduction'] ?? null,
                'slug' => (string) ($snapshot['slug'] ?? $activity->slug),
                'title' => (string) ($snapshot['title'] ?? $activity->title),
                'type' => (string) ($snapshot['type'] ?? $activity->type),
            ])->save();

            $this->questionConfig->syncSnapshot(
                $activity,
                is_array($snapshot['question'] ?? null) ? $snapshot['question'] : [],
            );

            $this->reviewState->markNeedsReview($activity);

            return $activity->refresh();
        });
    }
}
