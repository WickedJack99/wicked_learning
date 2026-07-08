<?php

namespace App\Learning\Serializers;

use App\Learning\ActivityTypeRegistry;
use App\Learning\Services\ActivityRouteEligibility;
use App\Learning\Services\PortalLinkService;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;

class AdminActivityGraphSerializer
{
    public function __construct(
        private readonly ActivityTypeRegistry $activityTypes,
        private readonly ActivityRouteEligibility $routeEligibility,
        private readonly LearningActivityStartSerializer $startSerializer,
        private readonly PortalLinkService $portalLinkService,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningNode $node): array
    {
        return [
            'world' => $this->world($node),
            'map' => $this->map($node),
            'node' => $this->node($node),
            'activityTypes' => $this->activityTypes->definitions(),
            'portalCandidates' => $this->portalLinkService->candidatesForNode($node),
            'activities' => $node->activities
                ->values()
                ->map(fn (LearningActivity $activity): array => $this->activity($activity))
                ->all(),
            'transitions' => $node->activities
                ->flatMap(fn (LearningActivity $activity) => $activity->transitions)
                ->values()
                ->map(fn (ActivityTransition $transition): array => $this->transition($transition))
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function world(LearningNode $node): array
    {
        return [
            'id' => $node->map->world->id,
            'slug' => $node->map->world->slug,
            'title' => $node->map->world->title,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function map(LearningNode $node): array
    {
        return [
            'id' => $node->map->id,
            'slug' => $node->map->slug,
            'title' => $node->map->title,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function node(LearningNode $node): array
    {
        return [
            'id' => $node->id,
            'slug' => $node->slug,
            'title' => $node->title,
            'description' => $node->description,
            'startActivityId' => $this->eligibleStartActivityId($node),
            'startRoutes' => $this->startRoutes($node),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function activity(LearningActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'slug' => $activity->slug,
            'type' => $activity->type,
            'title' => $activity->title,
            'introduction' => $activity->introduction,
            'config' => $activity->config ?? [],
            'portalLink' => $activity->type === 'portal' ? $this->portalLink($activity) : null,
            'position' => [
                'x' => $activity->graph_position_x,
                'y' => $activity->graph_position_y,
            ],
            'connectors' => $this->activityTypes->connectorsFor($activity),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function portalLink(LearningActivity $activity): ?array
    {
        $activity->loadMissing('outgoingPortalLink.targetActivity.node.map', 'outgoingPortalLink.targetNode.map');
        $link = $activity->outgoingPortalLink;

        if (! $link) {
            return null;
        }

        return [
            'id' => $link->id,
            'label' => $link->label,
            'description' => $link->description,
            'targetActivity' => $link->targetActivity ? [
                'id' => $link->targetActivity->id,
                'title' => $link->targetActivity->title,
                'nodeTitle' => $link->targetActivity->node->title,
                'mapTitle' => $link->targetActivity->node->map->title,
            ] : null,
            'targetNode' => [
                'id' => $link->targetNode->id,
                'title' => $link->targetNode->title,
                'mapTitle' => $link->targetNode->map->title,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transition(ActivityTransition $transition): array
    {
        return [
            'id' => $transition->id,
            'fromActivityId' => $transition->from_activity_id,
            'toActivityId' => $transition->to_activity_id,
            'fromConnector' => $transition->from_connector ?? $transition->trigger,
            'toConnector' => $transition->to_connector ?? 'in',
            'trigger' => $transition->trigger,
            'triggerValue' => $transition->trigger_value,
            'label' => $transition->label,
        ];
    }

    private function eligibleStartActivityId(LearningNode $node): ?int
    {
        $activity = $node->activities
            ->first(fn (LearningActivity $activity): bool => $activity->id === $node->start_activity_id);

        return $this->routeEligibility->canStart($activity) ? $activity?->id : null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function startRoutes(LearningNode $node): array
    {
        return $node->activityStarts
            ->filter(fn (LearningActivityStart $start): bool => $this->routeEligibility->canStart($start->activity))
            ->map(fn (LearningActivityStart $start): array => $this->startSerializer->serialize($start))
            ->values()
            ->all();
    }
}
