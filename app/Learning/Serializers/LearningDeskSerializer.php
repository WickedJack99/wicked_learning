<?php

namespace App\Learning\Serializers;

use App\Models\LearnerRouteProgress;
use App\Models\LearningNodeBookmark;
use Illuminate\Support\Collection;

class LearningDeskSerializer
{
    /**
     * @param  array{
     *     bookmarks: Collection<int, LearningNodeBookmark>,
     *     currentRoutes: Collection<int, LearnerRouteProgress>,
     *     featuredBookmark: LearningNodeBookmark|null
     * }  $desk
     * @return array<string, mixed>
     */
    public function serialize(array $desk): array
    {
        return [
            'bookmarks' => $desk['bookmarks']
                ->map(fn (LearningNodeBookmark $bookmark): array => $this->bookmark($bookmark))
                ->values()
                ->all(),
            'connections' => $desk['bookmarks']
                ->reject(fn (LearningNodeBookmark $bookmark): bool => $bookmark->is($desk['featuredBookmark']))
                ->take(3)
                ->map(fn (LearningNodeBookmark $bookmark): array => $this->bookmark($bookmark))
                ->values()
                ->all(),
            'currentRoutes' => $desk['currentRoutes']
                ->map(fn (LearnerRouteProgress $progress): array => $this->currentRoute($progress))
                ->values()
                ->all(),
            'featuredBookmark' => $desk['featuredBookmark']
                ? $this->bookmark($desk['featuredBookmark'])
                : null,
        ];
    }

    /** @return array<string, mixed> */
    private function bookmark(LearningNodeBookmark $bookmark): array
    {
        $node = $bookmark->node;
        $map = $node->map;

        return [
            'description' => $node->description,
            'href' => route('world', [
                'map' => $map->slug,
                'focused' => $node->slug,
            ], false),
            'id' => $bookmark->id,
            'imageUrl' => $node->mapAsset?->image_url,
            'mapTitle' => $map->title,
            'nodeId' => $node->id,
            'title' => $node->title,
        ];
    }

    /** @return array<string, mixed> */
    private function currentRoute(LearnerRouteProgress $progress): array
    {
        $node = $progress->node;
        $route = $progress->activityStart;
        $activityId = $progress->current_learning_activity_id
            ?? $route?->learning_activity_id
            ?? $progress->start_learning_activity_id;

        return [
            'currentActivityTitle' => $progress->currentActivity?->title
                ?? $route?->activity?->title,
            'href' => route('learning.nodes.play', [
                'node' => $node->id,
                'route' => $route?->id,
                'activity' => $activityId,
            ], false),
            'id' => $progress->id,
            'imageUrl' => $node->mapAsset?->image_url,
            'lastEnteredAt' => $progress->last_entered_at?->toIso8601String(),
            'mapTitle' => $node->map->title,
            'nodeTitle' => $node->title,
            'routeLabel' => $route?->label ?: $route?->activity?->title,
        ];
    }
}
