<?php

namespace App\Learning\Queries;

use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Loads the current learner's recent private check-in history. */
class LoadLearnerActivityCheckIns
{
    private const MAX_PROGRESS_ROWS = 30;

    public function __construct(private readonly ActivityCompetenceConfiguration $competence) {}

    /**
     * @return list<array{activityId: int, activityTitle: string, activityHref: string, feeling: string|null, note: string|null, nextDirection: string|null, nodeTitle: string, nodeHref: string, originTopicSlug: string|null, recordedAt: string, topics: list<array{slug: string, name: string}>}>
     */
    public function handle(User $user): array
    {
        $checkIns = [];

        LearnerActivityProgress::query()
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->where(function (Builder $query): void {
                $query
                    ->whereNotNull('metadata->learningCheckIns')
                    ->orWhereNotNull('metadata->learningCheckIn');
            })
            ->select(['id', 'learning_activity_id', 'metadata', 'updated_at'])
            ->with('activity.node.map.topic')
            ->latest('updated_at')
            ->latest('id')
            ->limit(self::MAX_PROGRESS_ROWS)
            ->get()
            ->each(function (LearnerActivityProgress $progress) use (&$checkIns): void {
                $metadata = is_array($progress->metadata) ? $progress->metadata : [];
                $history = is_array($metadata['learningCheckIns'] ?? null)
                    ? $metadata['learningCheckIns']
                    : [];
                $history = $history !== []
                    ? $history
                    : [$metadata['learningCheckIn'] ?? null];
                $activity = $progress->activity;

                if (! $activity instanceof LearningActivity) {
                    return;
                }

                foreach ($history as $checkIn) {
                    if (! is_array($checkIn) || ! is_string($checkIn['recordedAt'] ?? null)) {
                        continue;
                    }

                    $feeling = is_string($checkIn['feeling'] ?? null)
                        ? trim($checkIn['feeling'])
                        : null;
                    $note = is_string($checkIn['note'] ?? null)
                        ? trim($checkIn['note'])
                        : null;
                    $nextDirection = is_string($checkIn['nextDirection'] ?? null)
                        ? trim($checkIn['nextDirection'])
                        : null;
                    if (! in_array($nextDirection, ['revisit', 'related', 'settle'], true)) {
                        $nextDirection = null;
                    }

                    if (($feeling === null || $feeling === '')
                        && ($note === null || $note === '')
                        && ($nextDirection === null || $nextDirection === '')) {
                        continue;
                    }

                    $checkIns[] = [
                        'activityId' => $activity->id,
                        'activityTitle' => $activity->title,
                        'activityHref' => route('learning.nodes.play', [
                            'activity_id' => $activity->id,
                            'node' => $activity->node,
                        ]),
                        'feeling' => $feeling !== '' ? $feeling : null,
                        'note' => $note !== '' ? $note : null,
                        'nextDirection' => $nextDirection !== '' ? $nextDirection : null,
                        'nodeTitle' => $activity->node->title,
                        'nodeHref' => route('learning.nodes.play', ['node' => $activity->node]),
                        'originTopicSlug' => $activity->node->map->topic?->is_published
                            ? $activity->node->map->topic->slug
                            : null,
                        'recordedAt' => $checkIn['recordedAt'],
                        'topics' => array_map(
                            fn (array $topic): array => [
                                'slug' => $topic['slug'],
                                'name' => $topic['topic'],
                            ],
                            $this->competence->topicsForActivity($activity),
                        ),
                    ];
                }
            });

        usort(
            $checkIns,
            fn (array $left, array $right): int => strcmp($right['recordedAt'], $left['recordedAt']),
        );

        return array_slice($checkIns, 0, 30);
    }
}
