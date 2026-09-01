<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningActivityReviewState;
use App\Learning\Services\QuestionActivityConfiguration;
use App\Models\LearningActivity;
use App\Models\LearningActivityVersion;
use App\Models\User;
use Illuminate\Support\Collection;
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

            if (array_key_exists('transitions', $snapshot) && is_array($snapshot['transitions'])) {
                $this->restoreTransitions($activity, $snapshot['transitions']);
            }

            $this->reviewState->markNeedsReview($activity);

            return $activity->refresh();
        });
    }

    /**
     * @param  array<int, mixed>  $snapshots
     */
    private function restoreTransitions(LearningActivity $activity, array $snapshots): void
    {
        $activity->loadMissing('node');
        $nodeActivities = $activity->node->activities()->get(['id', 'slug'])->keyBy('id');
        $activitiesBySlug = $nodeActivities->keyBy('slug');

        $activity->transitions()->delete();

        foreach ($snapshots as $snapshot) {
            if (! is_array($snapshot)) {
                continue;
            }

            $target = $this->targetActivity($snapshot, $nodeActivities, $activitiesBySlug);
            $hasTarget = array_key_exists('toActivityId', $snapshot)
                || array_key_exists('toActivitySlug', $snapshot);

            if ($hasTarget && $target === null && ($snapshot['toActivityId'] ?? null) !== null) {
                continue;
            }

            $fromConnector = trim((string) ($snapshot['fromConnector'] ?? ''));
            $toConnector = trim((string) ($snapshot['toConnector'] ?? ''));

            if ($fromConnector === '' || $toConnector === '') {
                continue;
            }

            $activity->transitions()->create([
                'to_activity_id' => $target?->id,
                'from_connector' => $fromConnector,
                'to_connector' => $toConnector,
                'trigger' => (string) ($snapshot['trigger'] ?? 'completed'),
                'trigger_value' => isset($snapshot['triggerValue'])
                    ? (string) $snapshot['triggerValue']
                    : null,
                'label' => isset($snapshot['label']) ? (string) $snapshot['label'] : null,
                'rules' => is_array($snapshot['rules'] ?? null) ? $snapshot['rules'] : [],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @param  Collection<int, LearningActivity>  $nodeActivities
     * @param  Collection<string, LearningActivity>  $activitiesBySlug
     */
    private function targetActivity(
        array $snapshot,
        Collection $nodeActivities,
        Collection $activitiesBySlug,
    ): ?LearningActivity {
        if (array_key_exists('toActivityId', $snapshot)) {
            $targetId = $snapshot['toActivityId'];

            if (is_numeric($targetId) && $nodeActivities->has((int) $targetId)) {
                return $nodeActivities->get((int) $targetId);
            }

            return null;
        }

        $targetSlug = trim((string) ($snapshot['toActivitySlug'] ?? ''));

        return $targetSlug !== '' ? $activitiesBySlug->get($targetSlug) : null;
    }
}
