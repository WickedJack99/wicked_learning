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
use App\Models\LearningDialogueSoundSet;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningTopic;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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
        $dialogueSoundSets = $this->dialogueSoundSets($node);

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
                    $dialogueSoundSets,
                    $user,
                    $includeLearnerReviewContext,
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

        $categories = $reviewActivities
            ->map(fn (LearningActivity $activity): array => $this->reviewCategory($activity, $node))
            ->unique(fn (array $category): string => $this->reviewCategoryKey($category))
            ->values();
        $categoryKeys = $categories
            ->mapWithKeys(fn (array $category, int $categoryKey): array => [
                $this->reviewCategoryKey($category) => $categoryKey,
            ])
            ->all();
        $categoryRows = null;

        foreach ($categories as $categoryKey => $category) {
            $categoryRow = DB::query()->selectRaw(
                '? as review_category, ? as category_topic, ? as category_subtopic',
                [$categoryKey, $category[0], $category[1]],
            );
            $categoryRows = $categoryRows?->unionAll($categoryRow) ?? $categoryRow;
        }

        $rankedReflections = LearnerReflection::query()
            ->select('learner_reflections.*')
            ->selectRaw('review_categories.review_category')
            ->selectRaw(
                'ROW_NUMBER() OVER (PARTITION BY review_categories.review_category ORDER BY learner_reflections.created_at DESC, learner_reflections.id DESC) AS review_rank',
            )
            ->join(
                'learner_journal_pages as review_pages',
                'review_pages.id',
                '=',
                'learner_reflections.learner_journal_page_id',
            )
            ->crossJoinSub($categoryRows, 'review_categories')
            ->where('learner_reflections.user_id', $user->id)
            ->whereColumn('review_pages.topic', 'review_categories.category_topic')
            ->where(function (Builder $query): void {
                $query
                    ->where('review_categories.category_subtopic', '')
                    ->orWhereColumn('review_pages.subtopic', 'review_categories.category_subtopic');
            });
        $reflections = LearnerReflection::query()
            ->fromSub($rankedReflections, 'ranked_review_reflections')
            ->where('review_rank', '<=', 3)
            ->with('page')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
        $reflectionsByCategory = $reflections->groupBy(
            fn (LearnerReflection $reflection): int => (int) $reflection->review_category,
        );

        return $reviewActivities
            ->mapWithKeys(function (LearningActivity $activity) use ($node, $categoryKeys, $reflectionsByCategory): array {
                [$topic, $subtopic] = $this->reviewCategory($activity, $node);
                $categoryKey = $categoryKeys[$this->reviewCategoryKey([$topic, $subtopic])] ?? null;

                return [
                    $activity->id => $categoryKey === null
                        ? collect()
                        : $reflectionsByCategory->get($categoryKey, collect())->values(),
                ];
            })
            ->all();
    }

    /** @param array{0: string, 1: string} $category */
    private function reviewCategoryKey(array $category): string
    {
        return $category[0]."\0".$category[1];
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
     * @return Collection<int, LearningDialogueSoundSet>
     */
    private function dialogueSoundSets(LearningNode $node): Collection
    {
        $enabledNodes = $node->activities
            ->filter(fn (LearningActivity $activity): bool => $activity->type === 'npc_dialogue')
            ->flatMap(fn (LearningActivity $activity) => $activity->npcDialogueNodes)
            ->filter(function ($dialogueNode): bool {
                $config = is_array($dialogueNode->config) ? $dialogueNode->config : [];

                return (bool) ($config['typingSoundEnabled'] ?? false);
            });

        if ($enabledNodes->isEmpty()) {
            return collect();
        }

        $ids = $enabledNodes
            ->map(function ($dialogueNode): int {
                $config = is_array($dialogueNode->config) ? $dialogueNode->config : [];

                return is_numeric($config['typingSoundSetId'] ?? null)
                    ? (int) $config['typingSoundSetId']
                    : 0;
            })
            ->filter()
            ->unique()
            ->values();
        $usesDefault = $enabledNodes->contains(function ($dialogueNode): bool {
            $config = is_array($dialogueNode->config) ? $dialogueNode->config : [];

            return ! is_numeric($config['typingSoundSetId'] ?? null);
        });

        return LearningDialogueSoundSet::query()
            ->with('sounds')
            ->where(function ($query) use ($ids, $usesDefault): void {
                if ($ids->isNotEmpty()) {
                    $query->whereIn('id', $ids->all());
                }

                if ($usesDefault) {
                    $query->orWhere('is_default', true);
                }
            })
            ->get()
            ->keyBy('id');
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
            // Learners need the evaluated state, not the authored rule structure.
            $visualConfig['unlock'] = $unlock;
        } else {
            unset($visualConfig['unlock']);
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
        $eligibleStarts = $node->activityStarts
            ->filter(fn (LearningActivityStart $start): bool => $this->routeEligibility->canStart($start->activity))
            ->values();

        return $this->startSerializer->serializeMany($eligibleStarts, $user);
    }
}
