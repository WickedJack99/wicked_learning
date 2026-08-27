<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTopic;
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
            ...$this->topicResults($term),
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
    private function topicResults(string $term): array
    {
        $likeTerm = $this->likeTerm($term);

        return LearningTopic::query()
            ->where('is_published', true)
            ->where(function ($query) use ($likeTerm): void {
                $query
                    ->whereRaw('LOWER(title) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(description) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(slug) LIKE LOWER(?)', [$likeTerm]);
            })
            ->orderBy('title')
            ->limit(8)
            ->get()
            ->map(fn (LearningTopic $topic): array => [
                'href' => route('topics.show', $topic, false),
                'id' => "topic:{$topic->id}",
                'kind' => 'topic',
                'subtitle' => 'Topic',
                'title' => $topic->title,
            ])
            ->all();
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
                    ->whereRaw('LOWER(title) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(description) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(slug) LIKE LOWER(?)', [$likeTerm]);
            })
            ->limit(8)
            ->get()
            ->filter(fn (LearningMap $map): bool => $this->mapAccess->canViewMap($map, $user))
            ->map(fn (LearningMap $map): array => [
                'href' => route('world', ['map' => $map->slug], false),
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
                    ->whereRaw('LOWER(title) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(description) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(slug) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereHas('map', fn ($mapQuery) => $mapQuery
                        ->whereRaw('LOWER(title) LIKE LOWER(?)', [$likeTerm]));
            })
            ->limit(32)
            ->get()
            ->filter(fn (LearningNode $node): bool => $this->isVisibleNode($node)
                && $this->mapAccess->canViewMap($node->map, $user))
            ->take(24)
            ->map(fn (LearningNode $node): array => [
                'href' => route('world', [
                    'map' => $node->map->slug,
                    'focused' => $node->slug,
                ], false),
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
