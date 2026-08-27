<?php

namespace App\Learning\Serializers;

use App\Learning\Services\ActivityRouteEligibility;
use App\Learning\Services\LearningMapAccessService;
use App\Learning\Services\LearningNodeStateResolver;
use App\Learning\Services\NodeRevealService;
use App\Learning\Services\NodeUnlockService;
use App\Models\LearnerReflection;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningTopic;
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
    public function serialize(LearningNode $node, ?User $user = null, bool $includeLearnerReviewContext = false): array
    {
        $this->loadRelations($node);
        $userId = $user?->id;
        $state = $this->nodeStateResolver->stateForUser($node, $userId);

        if ($state === 'hidden') {
            return $this->concealedNode($node);
        }

        $reviewContexts = $includeLearnerReviewContext && $user
            ? $this->reviewContexts($node, $user)
            : [];

        return [
            ...$this->baseNode($node, null, [
                'isDiscoverable' => $this->nodeRevealService->isDiscoverable($node),
                'isDiscovered' => true,
            ], $state, $userId),
            'outgoingPortalLinks' => $node->outgoingPortalLinks
                ->filter(fn (LearningPortalLink $link): bool => $this->mapAccess->canViewMap($link->targetNode->map, $user))
                ->map(fn (LearningPortalLink $link): array => $this->portalLinkSerializer->serialize($link, $userId))
                ->values(),
            'startActivityId' => $this->eligibleStartActivityId($node),
            'startRoutes' => $this->startRoutes($node, $user),
            'activities' => $node->activities
                ->map(fn (LearningActivity $activity): array => $this->activitySerializer->serialize(
                    $activity,
                    $reviewContexts[$activity->id] ?? null,
                ))
                ->values(),
        ];
    }

    /**
     * @return array<int, Collection<int, LearnerReflection>>
     */
    private function reviewContexts(LearningNode $node, User $user): array
    {
        $reviewActivities = $node->activities->filter(function (LearningActivity $activity): bool {
            $config = is_array($activity->config) ? $activity->config : [];

            return in_array($activity->type, ['reflection', 'review'], true)
                && ($activity->type === 'review' || ($config['learningIntent'] ?? null) === 'review');
        });

        if ($reviewActivities->isEmpty()) {
            return [];
        }

        $topics = $reviewActivities
            ->map(fn (LearningActivity $activity): string => $this->reviewTopic($activity, $node))
            ->unique()
            ->values();
        $reflections = LearnerReflection::query()
            ->where('user_id', $user->id)
            ->whereHas('page', fn ($query) => $query->whereIn('topic', $topics->all()))
            ->latest()
            ->with('page')
            ->get();

        return $reviewActivities
            ->mapWithKeys(function (LearningActivity $activity) use ($node, $reflections): array {
                [$topic, $subtopic] = $this->reviewCategory($activity, $node);

                return [
                    $activity->id => $reflections
                        ->filter(fn (LearnerReflection $reflection): bool => $reflection->page->topic === $topic
                            && ($subtopic === '' || $reflection->page->subtopic === $subtopic))
                        ->take(3)
                        ->values(),
                ];
            })
            ->all();
    }

    /** @return array{0: string, 1: string} */
    private function reviewCategory(LearningActivity $activity, LearningNode $node): array
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return [
            trim((string) ($config['topic'] ?? '')) ?: $node->title,
            trim((string) ($config['subtopic'] ?? '')),
        ];
    }

    private function reviewTopic(LearningActivity $activity, LearningNode $node): string
    {
        return $this->reviewCategory($activity, $node)[0];
    }

    /**
     * @param  array{q: int, r: int}  $position
     * @return array<string, mixed>
     */
    public function serializeBookmarkNode(LearningNode $node, array $position): array
    {
        $node->loadMissing('map.topic');

        return [
            ...$this->baseNode($node, $position),
            'outgoingPortalLinks' => [],
            'startActivityId' => null,
            'startRoutes' => [],
            'activities' => [],
        ];
    }

    /** @return array{competenceHref: string, href: string, slug: string, title: string}|null */
    private function topic(mixed $topic): ?array
    {
        if (! $topic instanceof LearningTopic || ! $topic->is_published) {
            return null;
        }

        return [
            'competenceHref' => route('competence.index', [
                'topic' => $topic->slug,
            ], false),
            'href' => route('topics.show', $topic, false),
            'slug' => $topic->slug,
            'title' => $topic->title,
        ];
    }

    private function loadRelations(LearningNode $node): void
    {
        $node->loadMissing([
            'map.topic',
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
            'topic' => $this->topic($node->map->topic),
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
            ], 'hidden'),
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
    private function startRoutes(LearningNode $node, ?User $user): Collection
    {
        return $node->activityStarts
            ->filter(fn (LearningActivityStart $start): bool => $this->routeEligibility->canStart($start->activity))
            ->map(fn (LearningActivityStart $start): array => $this->startSerializer->serialize($start, $user))
            ->values();
    }
}
