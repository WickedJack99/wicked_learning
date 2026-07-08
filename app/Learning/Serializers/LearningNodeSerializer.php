<?php

namespace App\Learning\Serializers;

use App\Learning\Services\ActivityRouteEligibility;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use Illuminate\Support\Collection;

class LearningNodeSerializer
{
    public function __construct(
        private readonly ActivityRouteEligibility $routeEligibility,
        private readonly LearningActivitySerializer $activitySerializer,
        private readonly LearningActivityStartSerializer $startSerializer,
        private readonly LearningPortalLinkSerializer $portalLinkSerializer,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningNode $node): array
    {
        $this->loadRelations($node);

        return [
            ...$this->baseNode($node),
            'outgoingPortalLinks' => $node->outgoingPortalLinks
                ->map(fn (LearningPortalLink $link): array => $this->portalLinkSerializer->serialize($link))
                ->values(),
            'startActivityId' => $this->eligibleStartActivityId($node),
            'startRoutes' => $this->startRoutes($node),
            'activities' => $node->activities
                ->map(fn (LearningActivity $activity): array => $this->activitySerializer->serialize($activity))
                ->values(),
        ];
    }

    /**
     * @param  array{q: int, r: int}  $position
     * @return array<string, mixed>
     */
    public function serializeBookmarkNode(LearningNode $node, array $position): array
    {
        $node->loadMissing('map');

        return [
            ...$this->baseNode($node, $position),
            'outgoingPortalLinks' => [],
            'startActivityId' => null,
            'startRoutes' => [],
            'activities' => [],
        ];
    }

    private function loadRelations(LearningNode $node): void
    {
        $node->loadMissing([
            'map',
            'activities.dialogueStages',
            'activities.npcDialogueNodes',
            'activities.npcDialogueTransitions',
            'activities.question.options',
            'activities.transitions',
            'outgoingPortalLinks.targetNode.map',
        ]);
    }

    /**
     * @param  array{q: int, r: int}|null  $position
     * @return array<string, mixed>
     */
    private function baseNode(LearningNode $node, ?array $position = null): array
    {
        return [
            'id' => $node->id,
            'mapId' => $node->map->id,
            'mapSlug' => $node->map->slug,
            'mapTitle' => $node->map->title,
            'slug' => $node->slug,
            'title' => $node->title,
            'description' => $node->description,
            'position' => $position ?? [
                'q' => $node->position_q,
                'r' => $node->position_r,
            ],
            'state' => $node->state,
            'visualConfig' => $node->visual_config ?? [],
        ];
    }

    private function eligibleStartActivityId(LearningNode $node): ?int
    {
        $node->loadMissing('activities');

        $activity = $node->activities
            ->first(fn (LearningActivity $activity): bool => $activity->id === $node->start_activity_id);

        return $this->routeEligibility->canStart($activity) ? $activity?->id : null;
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function startRoutes(LearningNode $node): Collection
    {
        return $node->activityStarts
            ->filter(fn (LearningActivityStart $start): bool => $this->routeEligibility->canStart($start->activity))
            ->map(fn (LearningActivityStart $start): array => $this->startSerializer->serialize($start))
            ->values();
    }
}
