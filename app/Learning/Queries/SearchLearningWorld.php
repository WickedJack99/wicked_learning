<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\User;

class SearchLearningWorld
{
    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function handle(string $query, ?User $user = null): array
    {
        $term = trim($query);

        return [
            ...$this->mapResults($term, $user),
            ...$this->nodeResults($term, $user),
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
    private function mapResults(string $term, ?User $user): array
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
            ->filter(fn (LearningMap $map): bool => $this->mapAccess->canViewMap($map, $user))
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
    private function nodeResults(string $term, ?User $user): array
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
            ->filter(fn (LearningNode $node): bool => $this->isVisibleNode($node)
                && $this->mapAccess->canViewMap($node->map, $user))
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
