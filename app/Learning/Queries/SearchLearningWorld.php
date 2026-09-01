<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTopic;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class SearchLearningWorld
{
    private const int DEFAULT_PAGE_SIZE = 5;

    private const int MAX_PAGE_SIZE = 24;

    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /**
     * @return array{
     *     results: array<int, array<string, mixed>>,
     *     pagination: array{currentPage: int, lastPage: int, perPage: int, total: int}
     * }
     */
    public function handle(
        string $query,
        ?User $user = null,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): array {
        $term = trim($query);
        $page = max(1, $page);
        $perPage = max(1, min(self::MAX_PAGE_SIZE, $perPage));

        $topicQuery = $this->topicQuery($term);
        $mapQuery = $this->mapQuery($term, $user);
        $nodeQuery = $this->nodeQuery($term, $user);
        $topicTotal = (clone $topicQuery)->count();
        $mapTotal = (clone $mapQuery)->count();
        $nodeTotal = (clone $nodeQuery)->count();
        $total = $topicTotal + $mapTotal + $nodeTotal;
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $remainingOffset = ($page - 1) * $perPage;
        $remaining = $perPage;

        $results = [
            ...$this->categoryResults(
                $topicQuery,
                $topicTotal,
                $remainingOffset,
                $remaining,
                fn (Builder $query): array => $this->topicResults($query),
            ),
            ...$this->categoryResults(
                $mapQuery,
                $mapTotal,
                $remainingOffset,
                $remaining,
                fn (Builder $query): array => $this->mapResults($query),
            ),
            ...$this->categoryResults(
                $nodeQuery,
                $nodeTotal,
                $remainingOffset,
                $remaining,
                fn (Builder $query): array => $this->nodeResults($query),
            ),
        ];

        return [
            'results' => $results,
            'pagination' => [
                'currentPage' => $page,
                'lastPage' => $lastPage,
                'perPage' => $perPage,
                'total' => $total,
            ],
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
     * @return Builder<LearningTopic>
     */
    private function topicQuery(string $term): Builder
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
            ->orderBy('id');
    }

    /**
     * @param  Builder<LearningTopic>  $query
     * @return array<int, array<string, mixed>>
     */
    private function topicResults(Builder $query): array
    {
        return $query
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
     * @return Builder<LearningMap>
     */
    private function mapQuery(string $term, ?User $user): Builder
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
            ->where(function (Builder $query) use ($user): void {
                $this->mapAccess->constrainVisibleQuery($query, $user);
            })
            ->orderBy('title')
            ->orderBy('id');
    }

    /**
     * @param  Builder<LearningMap>  $query
     * @return array<int, array<string, mixed>>
     */
    private function mapResults(Builder $query): array
    {
        return $query
            ->get()
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
     * @return Builder<LearningNode>
     */
    private function nodeQuery(string $term, ?User $user): Builder
    {
        $likeTerm = $this->likeTerm($term);

        return LearningNode::query()
            ->with('map')
            ->where('state', '!=', 'hidden')
            ->whereHas('map.world', fn ($query) => $query->where('slug', CurrentWorldResolver::DEFAULT_WORLD_SLUG))
            ->whereHas('map', function (Builder $query) use ($user): void {
                $this->mapAccess->constrainVisibleQuery($query, $user);
            })
            ->where(function (Builder $query): void {
                $query
                    ->whereNull('visual_config')
                    ->orWhereJsonDoesntContain('visual_config->hideEmptySpace', true);
            })
            ->where(function ($query) use ($likeTerm): void {
                $query
                    ->whereRaw('LOWER(title) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(description) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereRaw('LOWER(slug) LIKE LOWER(?)', [$likeTerm])
                    ->orWhereHas('map', fn ($mapQuery) => $mapQuery
                        ->whereRaw('LOWER(title) LIKE LOWER(?)', [$likeTerm]));
            })
            ->orderBy('title')
            ->orderBy('id');
    }

    /**
     * @param  Builder<LearningNode>  $query
     * @return array<int, array<string, mixed>>
     */
    private function nodeResults(Builder $query): array
    {
        return $query
            ->get()
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

    /**
     * Restrict each category in SQL while preserving its position in the
     * combined topic, map and node result stream.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @param  callable(Builder<TModel>): array<int, array<string, mixed>>  $serialize
     * @return array<int, array<string, mixed>>
     */
    private function categoryResults(
        Builder $query,
        int $total,
        int &$remainingOffset,
        int &$remaining,
        callable $serialize,
    ): array {
        if ($total === 0 || $remaining === 0) {
            return [];
        }

        if ($remainingOffset >= $total) {
            $remainingOffset -= $total;

            return [];
        }

        $take = min($remaining, $total - $remainingOffset);
        $results = $serialize(
            $query
                ->offset($remainingOffset)
                ->limit($take),
        );
        $remainingOffset = 0;
        $remaining -= $take;

        return $results;
    }
}
