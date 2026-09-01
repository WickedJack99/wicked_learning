<?php

namespace App\Learning\Serializers;

use App\Models\LearningMap;
use App\Models\LearningPortalLink;
use App\Models\LearningWorld;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class LearningWorldExportSerializer
{
    public function __construct(private readonly LearningMapExportSerializer $mapExporter) {}

    /**
     * Serialize only the already-authorized maps supplied by the caller.
     *
     * @param  Collection<int, LearningMap>  $maps
     * @return array<string, mixed>
     */
    public function serialize(LearningWorld $world, Collection $maps): array
    {
        $maps = $maps->sortBy('id')->values();
        $maps->load([
            'world',
            'topic',
            'nodes.activities.transitions.toActivity',
            'nodes.activityStarts.activity',
            'nodes.activities.question.options',
            'nodes.activities.npcDialogueNodes',
            'nodes.activities.npcDialogueTransitions',
            'nodes.activities.translations',
            'assets',
            'assets.messageTopics',
        ]);

        $portalTargetsByMap = $this->loadPortalTargetsByMap($this->mapIds($maps));
        $mapExports = $maps
            ->map(fn (LearningMap $map): array => $this->mapExporter->serialize(
                $map,
                $portalTargetsByMap[$map->id] ?? [],
            ))
            ->values()
            ->all();

        return [
            'format' => 'wicked-learning-world',
            'formatVersion' => 1,
            'exportedAt' => now()->toIso8601String(),
            'world' => [
                'slug' => $world->slug,
                'title' => $world->title,
                'description' => $world->description,
            ],
            'maps' => $mapExports,
            'references' => [
                'mediaUrls' => collect($mapExports)
                    ->flatMap(fn (array $map): array => is_array(data_get($map, 'references.mediaUrls'))
                        ? data_get($map, 'references.mediaUrls')
                        : [])
                    ->filter(fn (mixed $url): bool => is_string($url) && trim($url) !== '')
                    ->unique()
                    ->values()
                    ->all(),
            ],
        ];
    }

    /**
     * @param  list<int>  $mapIds
     * @return array<int, list<array<string, mixed>>>
     */
    private function loadPortalTargetsByMap(array $mapIds): array
    {
        if ($mapIds === []) {
            return [];
        }

        return LearningPortalLink::query()
            ->with([
                'sourceActivity',
                'sourceNode',
                'targetActivity',
                'targetNode.map',
            ])
            ->whereHas('sourceNode', function (Builder $query) use ($mapIds): void {
                $query->whereIn('learning_map_id', $mapIds);
            })
            ->orderBy('id')
            ->get()
            ->groupBy(fn (LearningPortalLink $link): int => (int) $link->sourceNode->learning_map_id)
            ->map(fn (Collection $links): array => $this->mapExporter->serializePortalTargets($links))
            ->all();
    }

    /**
     * @param  Collection<int, LearningMap>  $maps
     * @return list<int>
     */
    private function mapIds(Collection $maps): array
    {
        $mapIds = [];

        foreach ($maps as $map) {
            $mapIds[] = (int) $map->getKey();
        }

        return $mapIds;
    }
}
