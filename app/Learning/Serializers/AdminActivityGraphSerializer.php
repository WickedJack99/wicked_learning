<?php

namespace App\Learning\Serializers;

use App\Learning\ActivityTypeRegistry;
use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Learning\Queries\LoadEditableSourceRecords;
use App\Learning\Queries\LoadLearningConcepts;
use App\Learning\Services\ActivityRouteEligibility;
use App\Learning\Services\PortalLinkService;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningSourceRecord;

class AdminActivityGraphSerializer
{
    public function __construct(
        private readonly ActivityTypeRegistry $activityTypes,
        private readonly LoadCompetenceTopicDefinitions $competenceTopics,
        private readonly LoadLearningConcepts $learningConcepts,
        private readonly ActivityRouteEligibility $routeEligibility,
        private readonly LearningActivityStartSerializer $startSerializer,
        private readonly PortalLinkService $portalLinkService,
        private readonly LoadEditableSourceRecords $sourceRecords,
        private readonly EditableSourceRecordSerializer $sourceRecordSerializer,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningNode $node): array
    {
        $node->loadMissing('activities.reviewRuns');

        return [
            'world' => $this->world($node),
            'map' => $this->map($node),
            'node' => $this->node($node),
            'activityTypes' => $this->activityTypes->definitions(),
            'competenceTopicOptions' => $this->competenceTopics->names(),
            'evidenceConceptOptions' => $this->learningConcepts->names(),
            'portalCandidates' => $this->portalLinkService->candidatesForNode($node),
            'messageTopics' => $node->mapAsset?->messageTopics
                ?->map(fn ($topic): array => [
                    'id' => $topic->id,
                    'title' => $topic->title,
                ])
                ->values()
                ->all() ?? [],
            'sourceRecords' => $this->sourceRecords(),
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
     * @return array{items: list<array<string, mixed>>, pagination: array{currentPage: int, lastPage: int, perPage: int, total: int}}
     */
    private function sourceRecords(): array
    {
        $sources = $this->sourceRecords->paginate();

        return [
            'items' => $sources->getCollection()
                ->map(fn (LearningSourceRecord $source): array => $this->sourceRecordSerializer->serialize($source))
                ->values()
                ->all(),
            'pagination' => [
                'currentPage' => $sources->currentPage(),
                'lastPage' => $sources->lastPage(),
                'perPage' => $sources->perPage(),
                'total' => $sources->total(),
            ],
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
            'graphLayout' => $node->activity_graph_layout ?? [],
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
            'updatedAt' => $activity->updated_at?->toIso8601String(),
            'aiReviewStatus' => $activity->ai_review_status,
            'aiReviewedAt' => $activity->ai_reviewed_at?->toIso8601String(),
            'aiReview' => $activity->ai_review,
            'aiReviewHistory' => $activity->reviewRuns
                ->take(5)
                ->map(fn ($run): array => [
                    'id' => $run->id,
                    'reviewedAt' => $run->created_at?->toIso8601String(),
                    'summary' => data_get($run->review, 'review.summary'),
                    'provider' => $run->provider,
                    'model' => $run->model,
                ])
                ->values()
                ->all(),
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
            'fromConnector' => $transition->from_connector ?? $transition->trigger ?? 'completed',
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
