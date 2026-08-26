<?php

namespace App\Learning\Serializers;

use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivityStart;
use Illuminate\Support\Collection;

class LearningPathSerializer
{
    public function __construct(
        private readonly ActivityCompetenceConfiguration $competence,
    ) {}

    /**
     * @param  array{
     *     routes: Collection<int, LearningActivityStart>,
     *     progress: array<string, LearnerRouteProgress>
     * }  $paths
     * @return list<array<string, mixed>>
     */
    public function serialize(array $paths): array
    {
        return array_values($paths['routes']
            ->map(function (LearningActivityStart $route) use ($paths): array {
                $node = $route->node;
                $map = $node->map;
                $topic = $map->topic;
                $progress = $paths['progress'][$this->progressKey(
                    $route->learning_node_id,
                    $route->learning_activity_id,
                )] ?? null;

                return [
                    'activityTitle' => $route->activity->title,
                    'activityType' => $route->activity->type,
                    'description' => $route->activity->introduction ?: $node->description,
                    'href' => route('learning.nodes.play', [
                        'node' => $node->id,
                        'route' => $route->id,
                    ], false),
                    'id' => $route->id,
                    'imageUrl' => $node->mapAsset?->image_url,
                    'learningIntent' => $this->competence->learningIntentForActivity(
                        $route->activity,
                    ),
                    'label' => $route->label ?: $route->activity->title,
                    'mapHref' => route('world', ['map' => $map->slug], false),
                    'mapTitle' => $map->title,
                    'nodeHref' => route('world', [
                        'map' => $map->slug,
                        'focused' => $node->slug,
                    ], false),
                    'nodeTitle' => $node->title,
                    'progress' => $progress ? [
                        'currentActivityTitle' => $progress->currentActivity?->title,
                        'lastEnteredAt' => $progress->last_entered_at?->toIso8601String(),
                        'status' => $progress->status,
                    ] : null,
                    'topic' => $topic?->is_published ? [
                        'href' => route('topics.show', $topic, false),
                        'title' => $topic->title,
                    ] : null,
                ];
            })
            ->values()
            ->all());
    }

    private function progressKey(int $nodeId, int $activityId): string
    {
        return $nodeId.':'.$activityId;
    }
}
