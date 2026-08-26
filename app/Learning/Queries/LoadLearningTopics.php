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
    public function overview(): Collection
    {
        return LearningTopicArea::query()
            ->with(['rootTopics' => fn ($query) => $query
                ->where('is_published', true)
                ->orderBy('title')])
            ->whereHas('rootTopics', fn ($query) => $query->where('is_published', true))
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();
    }

    public function publishedDetail(LearningTopic $topic, ?User $user = null): LearningTopic
    {
        abort_unless($topic->is_published, 404);

        $topic->load([
            'area',
            'parent',
            'children' => fn ($query) => $query
                ->where('is_published', true)
                ->orderBy('title'),
            'maps',
        ]);

        $topic->setRelation('maps', $this->mapAccess->visibleMaps($topic->maps, $user));

        return $topic;
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
