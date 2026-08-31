<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningWorld;

class AdminWorldGraphSerializer
{
    public function __construct(private readonly AdminWorldSummarySerializer $summary) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningWorld $world): array
    {
        $reviewCounts = $this->reviewCounts($world);

        return [
            'world' => $this->summary->world($world),
            'maps' => $world->maps
                ->values()
                ->map(fn (LearningMap $map): array => $this->map($map, $reviewCounts))
                ->all(),
            'portalCandidates' => $this->portalCandidates($world),
            'portalLinks' => $this->portalLinks($world),
        ];
    }

    /**
     * @return array<int, int>
     */
    private function reviewCounts(LearningWorld $world): array
    {
        $nodeIds = $world->maps
            ->flatMap(fn (LearningMap $map) => $map->nodes->pluck('id'))
            ->values();

        if ($nodeIds->isEmpty()) {
            return [];
        }

        return LearningActivity::query()
            ->whereIn('learning_node_id', $nodeIds)
            ->where(function ($query): void {
                $query
                    ->whereNull('ai_review_status')
                    ->orWhere('ai_review_status', '!=', LearningActivity::AI_REVIEW_STATUS_REVIEWED);
            })
            ->selectRaw('learning_node_id, COUNT(*) as review_count')
            ->groupBy('learning_node_id')
            ->pluck('review_count', 'learning_node_id')
            ->map(fn (mixed $count): int => (int) $count)
            ->all();
    }

    /**
     * @param  array<int, int>  $reviewCounts
     * @return array<string, mixed>
     */
    private function map(LearningMap $map, array $reviewCounts): array
    {
        $summary = $this->summary->map($map);
        $nodes = array_map(
            fn (array $node): array => [
                ...$node,
                'activityReviewCount' => $reviewCounts[$node['id']] ?? 0,
            ],
            $summary['nodes'],
        );

        return [
            ...$summary,
            'reviewCount' => array_sum(array_map(
                fn (array $node): int => $node['activityReviewCount'],
                $nodes,
            )),
            'nodes' => $nodes,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function portalCandidates(LearningWorld $world): array
    {
        return $world->maps
            ->flatMap(fn (LearningMap $map) => $map->nodes->map(fn (LearningNode $node): array => [
                ...$this->summary->node($node),
                'mapId' => $map->id,
                'mapTitle' => $map->title,
            ]))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function portalLinks(LearningWorld $world): array
    {
        $mapIds = $world->maps->pluck('id');

        return LearningPortalLink::query()
            ->with(['sourceActivity', 'sourceNode.map', 'targetActivity', 'targetNode.map'])
            ->whereHas('sourceNode', fn ($query) => $query->whereIn('learning_map_id', $mapIds))
            ->orWhereHas('targetNode', fn ($query) => $query->whereIn('learning_map_id', $mapIds))
            ->get()
            ->map(fn (LearningPortalLink $link): array => $this->portalLink($link))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function portalLink(LearningPortalLink $link): array
    {
        return [
            'id' => $link->id,
            'label' => $link->label,
            'description' => $link->description,
            'sourceMapId' => $link->sourceNode->map->id,
            'targetMapId' => $link->targetNode->map->id,
            'sourceActivity' => $this->activity($link->sourceActivity),
            'targetActivity' => $this->activity($link->targetActivity),
            'sourceNode' => $this->summary->node($link->sourceNode),
            'targetNode' => $this->summary->node($link->targetNode),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function activity(mixed $activity): ?array
    {
        if (! $activity) {
            return null;
        }

        return [
            'id' => $activity->id,
            'title' => $activity->title,
            'type' => $activity->type,
        ];
    }
}
