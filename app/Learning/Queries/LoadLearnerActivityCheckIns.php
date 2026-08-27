<?php

namespace App\Learning\Queries;

use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;

/** Loads the current learner's recent private check-in history. */
class LoadLearnerActivityCheckIns
{
    public function __construct(private readonly ActivityCompetenceConfiguration $competence) {}

    /**
     * @return list<array{activityId: int, activityTitle: string, activityHref: string, feeling: string|null, note: string|null, nodeTitle: string, nodeHref: string, originTopicSlug: string|null, recordedAt: string, topics: list<array{slug: string, name: string}>}>
     */
    public function handle(User $user): array
    {
        $checkIns = [];

        LearnerActivityProgress::query()
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->with('activity.node.map.topic')
            ->latest('updated_at')
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

                    if (($feeling === null || $feeling === '') && ($note === null || $note === '')) {
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
