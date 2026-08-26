<?php

namespace App\Learning\Queries;

use App\Models\LearningTopic;

class LoadLearningTopicOptions
{
    /** @return list<array{id: int, label: string, title: string}> */
    public function handle(): array
    {
        return array_values(LearningTopic::query()
            ->with('area')
            ->orderBy('title')
            ->get()
            ->map(fn (LearningTopic $topic): array => [
                'id' => $topic->id,
                'label' => $topic->area->title.' / '.$topic->title,
                'title' => $topic->title,
            ])
            ->values()
            ->all());
    }
}
