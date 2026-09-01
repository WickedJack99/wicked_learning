<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class LoadLearningTopics
{
    private const int MAP_PAGE_SIZE = 4;

    private const int TOPIC_PAGE_SIZE = 6;

    private const int SUBTOPIC_PAGE_SIZE = 4;

    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /** @return Collection<int, LearningTopicArea> */
    public function overviewAreas(): Collection
    {
        return LearningTopicArea::query()
            ->select(['id', 'slug', 'title', 'description'])
            ->whereHas('rootTopics', fn ($query) => $query->where('is_published', true))
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();
    }

    /**
     * @return LengthAwarePaginator<int, LearningTopic>
     */
    public function overviewTopics(
        LearningTopicArea $area,
        ?User $user = null,
        int $page = 1,
    ): LengthAwarePaginator {
        $query = $area->rootTopics()
            ->where('is_published', true)
            ->withCount([
                'maps as visible_map_count' => fn (Builder $query): Builder => $this->mapAccess
                    ->constrainVisibleQuery($query, $user),
            ])
            ->orderBy('title');
        $page = max(1, $page);
        $topics = $query->paginate(self::TOPIC_PAGE_SIZE, ['*'], 'page', $page);

        if ($topics->currentPage() > $topics->lastPage() && $topics->total() > 0) {
            return $query->paginate(
                self::TOPIC_PAGE_SIZE,
                ['*'],
                'page',
                $topics->lastPage(),
            );
        }

        return $topics;
    }

    public function publishedDetail(LearningTopic $topic, ?User $user = null): LearningTopic
    {
        abort_unless($topic->is_published, 404);

        $topic->load([
            'area',
            'parent',
        ]);

        return $topic;
    }

    /**
     * @return LengthAwarePaginator<int, LearningMap>
     */
    public function publishedMaps(LearningTopic $topic, ?User $user = null, int $page = 1): LengthAwarePaginator
    {
        $query = $this->mapAccess->constrainVisibleQuery(
            $topic->maps()->getQuery()->withCount('nodes'),
            $user,
        )->orderBy('title');
        $page = max(1, $page);
        $maps = $query->paginate(self::MAP_PAGE_SIZE, ['*'], 'maps_page', $page);

        if ($maps->currentPage() > $maps->lastPage() && $maps->total() > 0) {
            return $query->paginate(
                self::MAP_PAGE_SIZE,
                ['*'],
                'maps_page',
                $maps->lastPage(),
            );
        }

        return $maps;
    }

    /**
     * Load only the activity configuration needed to describe a topic's
     * learning areas, without hydrating every map and node relationship.
     *
     * @return Collection<int, LearningActivity>
     */
    public function publishedActivitiesForTopic(LearningTopic $topic, ?User $user = null): Collection
    {
        return LearningActivity::query()
            ->select(['id', 'type', 'config'])
            ->whereHas('node.map', function (Builder $query) use ($topic, $user): void {
                $query
                    ->where('learning_topic_id', $topic->id);
                $this->mapAccess->constrainVisibleQuery($query, $user);
            })
            ->get();
    }

    /**
     * @return LengthAwarePaginator<int, LearningTopic>
     */
    public function publishedSubtopics(LearningTopic $topic, ?User $user = null, int $page = 1): LengthAwarePaginator
    {
        $query = $topic->children()
            ->where('is_published', true)
            ->withCount([
                'maps as visible_map_count' => fn (Builder $query): Builder => $this->mapAccess
                    ->constrainVisibleQuery($query, $user),
            ])
            ->orderBy('title');
        $page = max(1, $page);
        $subtopics = $query->paginate(self::SUBTOPIC_PAGE_SIZE, ['*'], 'subtopics_page', $page);

        if ($subtopics->currentPage() > $subtopics->lastPage() && $subtopics->total() > 0) {
            return $query->paginate(
                self::SUBTOPIC_PAGE_SIZE,
                ['*'],
                'subtopics_page',
                $subtopics->lastPage(),
            );
        }

        return $subtopics;
    }

    /** @return list<string> */
    public function publishedDescendantSlugs(LearningTopic $topic): array
    {
        $topics = LearningTopic::query()
            ->where('learning_topic_area_id', $topic->learning_topic_area_id)
            ->where('is_published', true)
            ->get(['id', 'parent_id', 'slug']);
        $includedIds = collect([$topic->id]);

        do {
            $nextIds = $topics
                ->whereIn('parent_id', $includedIds->all())
                ->pluck('id')
                ->diff($includedIds);
            $includedIds = $includedIds->merge($nextIds)->unique()->values();
        } while ($nextIds->isNotEmpty());

        return array_values($topics
            ->whereIn('id', $includedIds->all())
            ->pluck('slug')
            ->map(fn (mixed $slug): string => (string) $slug)
            ->values()
            ->all());
    }

    /** @return Collection<int, LearningTopicArea> */
    public function administration(): Collection
    {
        return LearningTopicArea::query()
            ->with(['topics' => fn ($query) => $query
                ->orderBy('title')])
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();
    }
}
