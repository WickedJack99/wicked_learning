<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\User;
use Illuminate\Support\Collection;

class LoadLearningTopics
{
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
            'children' => fn ($query) => $query
                ->where('is_published', true)
                ->orderBy('title')
                ->with('maps'),
            'maps.nodes',
        ]);

        $topic->setRelation('maps', $this->mapAccess->visibleMaps($topic->maps, $user));
        $topic->children->each(fn (LearningTopic $child) => $child->setRelation(
            'maps',
            $this->mapAccess->visibleMaps($child->maps, $user),
        ));

        return $topic;
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
