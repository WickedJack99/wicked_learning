<?php

namespace App\Learning\Serializers;

use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Learning\Services\ActivityTimeGuideConfiguration;
use App\Models\LearnerMessageResponse;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningNodeBookmark;
use App\Models\LearningTopic;
use DateTimeInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LearningDeskSerializer
{
    public function __construct(
        private readonly ActivityCompetenceConfiguration $competence,
        private readonly ActivityTimeGuideConfiguration $timeGuide,
    ) {}

    /**
     * @param  array{
     *     bookmarks: Collection<int, LearningNodeBookmark>,
     *     checkIns: list<array<string, mixed>>,
     *     recallItems: list<array<string, mixed>>,
     *     currentRoutes: Collection<int, LearnerRouteProgress>,
     *     recentRoutes: Collection<int, LearnerRouteProgress>,
     *     revisitInvitations: list<array<string, mixed>>,
     *     supportResponses: Collection<int, LearnerMessageResponse>,
     *     featuredBookmark: LearningNodeBookmark|null
     * }  $desk
     * @return array<string, mixed>
     */
    public function serialize(array $desk): array
    {
        $currentPlaceIds = $desk['currentRoutes']->mapWithKeys(
            fn (LearnerRouteProgress $progress): array => [
                $this->placeKey($progress) => true,
            ],
        );

        return [
            'bookmarks' => $desk['bookmarks']
                ->map(fn (LearningNodeBookmark $bookmark): array => $this->bookmark($bookmark))
                ->values()
                ->all(),
            'checkIns' => array_slice($desk['checkIns'], 0, 4),
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
                ->reject(fn (LearnerRouteProgress $progress): bool => $currentPlaceIds->has($this->placeKey($progress)))
                ->map(fn (LearnerRouteProgress $progress): array => $this->recentRoute($progress))
                ->values()
                ->all(),
            'revisitInvitations' => $desk['revisitInvitations'],
            'recallItems' => $desk['recallItems'],
            'supportResponses' => $desk['supportResponses']
                ->map(fn (LearnerMessageResponse $response): array => $this->supportResponse($response))
                ->values()
                ->all(),
            'featuredBookmark' => $desk['featuredBookmark']
                ? $this->bookmark($desk['featuredBookmark'])
                : null,
        ];
    }

    private function placeKey(LearnerRouteProgress $progress): int
    {
        return $progress->learning_node_id;
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

    /** @return array{id: int, body: string, createdAt: string|null, mapTitle: string, nodeHref: string, nodeTitle: string, topicTitle: string} */
    private function supportResponse(LearnerMessageResponse $response): array
    {
        $topic = $response->message->topic;
        $mapAsset = $topic->mapAsset;
        $node = $mapAsset->node;
        $map = $node->map;

        return [
            'body' => $response->body,
            'createdAt' => $this->dateTimeString($response->created_at),
            'id' => $response->id,
            'mapTitle' => $map->title,
            'nodeHref' => route('world', [
                'map' => $map->slug,
                'focused' => $node->slug,
            ], false),
            'nodeTitle' => $node->title,
            'topicTitle' => $topic->title,
        ];
    }

    /** @return array<string, mixed> */
    private function currentRoute(LearnerRouteProgress $progress): array
    {
        $node = $progress->node;
        $route = $progress->activityStart;
        $activity = $progress->currentActivity ?? $route?->activity;
        $activityId = $progress->current_learning_activity_id;

        if ($activityId === null && $route !== null) {
            $activityId = $route->learning_activity_id;
        }

        $activityId ??= $progress->start_learning_activity_id;
        $currentActivityTitle = $activity?->title;

        if ($currentActivityTitle === null && $route !== null) {
            $currentActivityTitle = $route->activity?->title;
        }

        return [
            'currentActivityTitle' => $currentActivityTitle,
            'deskReason' => 'active_route',
            'href' => route('learning.nodes.play', [
                'node' => $node->id,
                'route' => $route?->id,
                'activity' => $activityId,
            ], false),
            'id' => $progress->id,
            'imageUrl' => $node->mapAsset?->image_url,
            'learningAreas' => $this->learningAreas($activity),
            'learningIntent' => $this->learningIntent($activity),
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
            'timeGuideMinutes' => $this->timeGuideMinutes($activity),
            'topic' => $this->topic($node->map->topic),
        ];
    }

    /** @return array<string, mixed> */
    private function recentRoute(LearnerRouteProgress $progress): array
    {
        $node = $progress->node;
        $route = $progress->activityStart;
        $activity = $route?->activity;

        return [
            'currentActivityTitle' => null,
            'deskReason' => 'recently_completed',
            'href' => route('learning.nodes.play', [
                'node' => $node->id,
                'route' => $route?->id,
            ], false),
            'id' => $progress->id,
            'imageUrl' => $node->mapAsset?->image_url,
            'learningAreas' => $this->learningAreas($activity),
            'learningIntent' => $this->learningIntent($activity),
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
            'timeGuideMinutes' => $this->timeGuideMinutes($activity),
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
            'slug' => $topic->slug,
            'title' => $topic->title,
        ];
    }

    /** @return list<array{name: string, slug: string}> */
    private function learningAreas(?LearningActivity $activity): array
    {
        return array_map(
            fn (array $area): array => [
                'name' => $area['topic'],
                'slug' => $area['slug'],
            ],
            $activity ? $this->competence->topicsForActivity($activity) : [],
        );
    }

    private function learningIntent(?LearningActivity $activity): ?string
    {
        return $activity
            ? $this->competence->learningIntentForActivity($activity)
            : null;
    }

    private function timeGuideMinutes(?LearningActivity $activity): ?int
    {
        return $activity ? $this->timeGuide->forActivity($activity) : null;
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
