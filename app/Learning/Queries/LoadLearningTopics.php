<?php

namespace App\Learning\Queries;

use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use Illuminate\Support\Collection;

class LoadLearningTopics
{
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

    public function publishedDetail(LearningTopic $topic): LearningTopic
    {
        abort_unless($topic->is_published, 404);

        return $topic->load([
            'area',
            'parent',
            'children' => fn ($query) => $query
                ->where('is_published', true)
                ->orderBy('title'),
        ]);
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
