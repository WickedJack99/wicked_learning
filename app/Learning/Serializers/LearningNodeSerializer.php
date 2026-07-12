<?php

namespace App\Learning\Serializers;

use App\Learning\Services\ActivityRouteEligibility;
use App\Learning\Services\LearningNodeStateResolver;
use App\Learning\Services\LearningMapAccessService;
use App\Learning\Services\NodeRevealService;
use App\Learning\Services\NodeUnlockService;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\User;
use Illuminate\Support\Collection;

class LearningNodeSerializer
{
    public function __construct(
        private readonly ActivityRouteEligibility $routeEligibility,
        private readonly LearningActivitySerializer $activitySerializer,
        private readonly LearningActivityStartSerializer $startSerializer,
        private readonly LearningPortalLinkSerializer $portalLinkSerializer,
        private readonly LearningNodeStateResolver $nodeStateResolver,
        private readonly LearningMapAccessService $mapAccess,
        private readonly NodeRevealService $nodeRevealService,
        private readonly NodeUnlockService $nodeUnlockService,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningNode $node, ?User $user = null): array
    {
        $this->loadRelations($node);
        $userId = $user?->id;

        if ($this->nodeRevealService->isConcealedForUser($node, $userId)) {
            return $this->concealedNode($node);
        }

        return [
            ...$this->baseNode($node, null, [
                'isDiscoverable' => $this->nodeRevealService->isDiscoverable($node),
                'isDiscovered' => true,
            ], $this->nodeStateResolver->stateForUser($node, $userId), $userId),
            'outgoingPortalLinks' => $node->outgoingPortalLinks
                ->filter(fn (LearningPortalLink $link): bool => $this->mapAccess->canViewMap($link->targetNode->map, $user))
                ->map(fn (LearningPortalLink $link): array => $this->portalLinkSerializer->serialize($link, $userId))
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
            'discoveries',
            'outgoingPortalLinks.targetNode.discoveries',
            'outgoingPortalLinks.targetNode.map',
        ]);
    }

    /**
     * @param  array{q: int, r: int}|null  $position
     * @param  array<string, mixed>|null  $reveal
     * @return array<string, mixed>
     */
    private function baseNode(
        LearningNode $node,
        ?array $position = null,
        ?array $reveal = null,
        ?string $state = null,
        ?int $userId = null,
    ): array {
        $visualConfig = $node->visual_config ?? [];

        if ($reveal !== null) {
            $visualConfig['reveal'] = [
                ...(is_array($visualConfig['reveal'] ?? null) ? $visualConfig['reveal'] : []),
                ...$reveal,
            ];
        }

        $unlock = $this->nodeUnlockService->unlockState($node, $userId);
        if ($unlock['isUnlockable']) {
            $visualConfig['unlock'] = [
                ...(is_array($visualConfig['unlock'] ?? null) ? $visualConfig['unlock'] : []),
                ...$unlock,
            ];
        }

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
            'state' => $state ?? $node->state,
            'visualConfig' => $visualConfig,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function concealedNode(LearningNode $node): array
    {
        return [
            ...$this->baseNode($node, null, [
                'isDiscoverable' => true,
                'isDiscovered' => false,
            ]),
            'title' => 'Undiscovered place',
            'description' => null,
            'visualConfig' => [
                'hideEmptySpace' => true,
                'reveal' => [
                    'isDiscoverable' => true,
                    'isDiscovered' => false,
                ],
            ],
            'outgoingPortalLinks' => [],
            'startActivityId' => null,
            'startRoutes' => [],
            'activities' => [],
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
