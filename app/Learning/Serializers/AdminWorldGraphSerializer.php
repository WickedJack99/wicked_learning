<?php

namespace App\Learning\Serializers;

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
        return [
            'world' => $this->summary->world($world),
            'maps' => $world->maps
                ->values()
                ->map(fn (LearningMap $map): array => $this->summary->map($map))
                ->all(),
            'portalCandidates' => $this->portalCandidates($world),
            'portalLinks' => $this->portalLinks($world),
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
