<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class LoadLearningTopics
{
    private const int SUBTOPIC_PAGE_SIZE = 4;

    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /** @return Collection<int, LearningTopicArea> */
    public function overview(?User $user = null): Collection
    {
        $areas = LearningTopicArea::query()
            ->with(['rootTopics' => fn ($query) => $query
                ->where('is_published', true)
                ->orderBy('title')
                ->with('maps')])
            ->whereHas('rootTopics', fn ($query) => $query->where('is_published', true))
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();

        $areas->each(fn (LearningTopicArea $area) => $area->rootTopics->each(
            fn (LearningTopic $topic) => $topic->setRelation(
                'maps',
                $this->mapAccess->visibleMaps($topic->maps, $user),
            ),
        ));

        return $areas;
    }

    public function publishedDetail(LearningTopic $topic, ?User $user = null): LearningTopic
    {
        abort_unless($topic->is_published, 404);

        $topic->load([
            'area',
            'parent',
            'maps.nodes.activities',
        ]);

        $topic->setRelation('maps', $this->mapAccess->visibleMaps($topic->maps, $user));

        return $topic;
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

        return $topics
            ->whereIn('id', $includedIds->all())
            ->pluck('slug')
            ->values()
            ->all();
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
