<?php

namespace App\Learning\Serializers;

use App\Models\LearnerRouteProgress;
use App\Models\LearningNodeBookmark;
use App\Models\LearningTopic;
use DateTimeInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LearningDeskSerializer
{
    /**
     * @param  array{
     *     bookmarks: Collection<int, LearningNodeBookmark>,
     *     currentRoutes: Collection<int, LearnerRouteProgress>,
     *     recentRoutes: Collection<int, LearnerRouteProgress>,
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
            'recentRoutes' => $desk['recentRoutes']
                ->map(fn (LearnerRouteProgress $progress): array => $this->recentRoute($progress))
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
            'topic' => $this->topic($map->topic),
            'title' => $node->title,
        ];
    }

    /** @return array<string, mixed> */
    private function currentRoute(LearnerRouteProgress $progress): array
    {
        $node = $progress->node;
        $route = $progress->activityStart;
        $activityId = $progress->current_learning_activity_id;

        if ($activityId === null && $route !== null) {
            $activityId = $route->learning_activity_id;
        }

        $activityId ??= $progress->start_learning_activity_id;
        $currentActivityTitle = $progress->currentActivity?->title;

        if ($currentActivityTitle === null && $route !== null) {
            $currentActivityTitle = $route->activity?->title;
        }

        return [
            'currentActivityTitle' => $currentActivityTitle,
            'href' => route('learning.nodes.play', [
                'node' => $node->id,
                'route' => $route?->id,
                'activity' => $activityId,
            ], false),
            'id' => $progress->id,
            'imageUrl' => $node->mapAsset?->image_url,
            'lastCompletedAt' => $this->dateTimeString($progress->last_completed_at),
            'lastEnteredAt' => $this->dateTimeString($progress->last_entered_at),
            'mapHref' => route('world', ['map' => $node->map->slug], false),
            'mapTitle' => $node->map->title,
            'nodeHref' => route('world', [
                'map' => $node->map->slug,
                'focused' => $node->slug,
            ], false),
            'nodeTitle' => $node->title,
            'routeLabel' => $route?->label ?: $route?->activity?->title,
            'topic' => $this->topic($node->map->topic),
        ];
    }

    /** @return array<string, mixed> */
    private function recentRoute(LearnerRouteProgress $progress): array
    {
        $node = $progress->node;
        $route = $progress->activityStart;

        return [
            'currentActivityTitle' => null,
            'href' => route('learning.nodes.play', [
                'node' => $node->id,
                'route' => $route?->id,
            ], false),
            'id' => $progress->id,
            'imageUrl' => $node->mapAsset?->image_url,
            'lastCompletedAt' => $this->dateTimeString($progress->last_completed_at),
            'lastEnteredAt' => $this->dateTimeString($progress->last_entered_at),
            'mapHref' => route('world', ['map' => $node->map->slug], false),
            'mapTitle' => $node->map->title,
            'nodeHref' => route('world', [
                'map' => $node->map->slug,
                'focused' => $node->slug,
            ], false),
            'nodeTitle' => $node->title,
            'routeLabel' => $route?->label ?: $route?->activity?->title,
            'topic' => $this->topic($node->map->topic),
        ];
    }

    /** @return array{href: string, title: string}|null */
    private function topic(mixed $topic): ?array
    {
        if (! $topic instanceof LearningTopic || ! $topic->is_published) {
            return null;
        }

        return [
            'href' => route('topics.show', $topic, false),
            'title' => $topic->title,
        ];
    }

    private function dateTimeString(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        if (is_string($value) && $value !== '') {
            return Carbon::parse($value)->toIso8601String();
        }

        return null;
    }
}
