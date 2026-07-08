<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Models\LearningMap;
use App\Models\LearningNode;

class SearchLearningWorld
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function handle(string $query): array
    {
        $term = trim($query);

        return [
            ...$this->mapResults($term),
            ...$this->nodeResults($term),
        ];
    }

    private function escapedLikeTerm(string $term): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
    }

    private function likeTerm(string $term): string
    {
        return '%'.$this->escapedLikeTerm($term).'%';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function mapResults(string $term): array
    {
        $likeTerm = $this->likeTerm($term);

        return LearningMap::query()
            ->whereHas('world', fn ($query) => $query->where('slug', CurrentWorldResolver::DEFAULT_WORLD_SLUG))
            ->where(function ($query) use ($likeTerm): void {
                $query
                    ->where('title', 'like', $likeTerm)
                    ->orWhere('description', 'like', $likeTerm)
                    ->orWhere('slug', 'like', $likeTerm);
            })
            ->limit(8)
            ->get()
            ->map(fn (LearningMap $map): array => [
                'id' => "map:{$map->id}",
                'kind' => 'map',
                'mapId' => $map->id,
                'mapSlug' => $map->slug,
                'subtitle' => 'World map',
                'title' => $map->title,
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function nodeResults(string $term): array
    {
        $likeTerm = $this->likeTerm($term);

        return LearningNode::query()
            ->with('map')
            ->where('state', '!=', 'hidden')
            ->whereHas('map.world', fn ($query) => $query->where('slug', CurrentWorldResolver::DEFAULT_WORLD_SLUG))
            ->where(function ($query) use ($likeTerm): void {
                $query
                    ->where('title', 'like', $likeTerm)
                    ->orWhere('description', 'like', $likeTerm)
                    ->orWhere('slug', 'like', $likeTerm)
                    ->orWhereHas('map', fn ($mapQuery) => $mapQuery->where('title', 'like', $likeTerm));
            })
            ->limit(32)
            ->get()
            ->filter(fn (LearningNode $node): bool => $this->isVisibleNode($node))
            ->take(24)
            ->map(fn (LearningNode $node): array => [
                'id' => "node:{$node->id}",
                'kind' => 'node',
                'mapId' => $node->map->id,
                'mapSlug' => $node->map->slug,
                'nodeId' => $node->id,
                'nodeSlug' => $node->slug,
                'subtitle' => $node->map->title.($node->state === 'locked' ? ' - locked' : ''),
                'title' => $node->title,
            ])
            ->all();
    }

    private function isVisibleNode(LearningNode $node): bool
    {
        return ($node->visual_config['hideEmptySpace'] ?? false) !== true;
    }
}
