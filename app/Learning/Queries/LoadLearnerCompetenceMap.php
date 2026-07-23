<?php

namespace App\Learning\Queries;

use App\Models\LearnerCompetenceTopic;
use App\Models\LearnerCompetenceTopicMonth;
use App\Models\LearnerCompetenceTopicTransition;
use App\Models\User;
use Illuminate\Support\Carbon;

class LoadLearnerCompetenceMap
{
    /**
     * @return array{monthKey: string, topics: list<array<string, mixed>>, transitions: list<array<string, mixed>>}
     */
    public function handle(User $user): array
    {
        $monthKey = Carbon::now()->format('Y-m');
        $months = LearnerCompetenceTopicMonth::query()
            ->where('user_id', $user->id)
            ->where('month_key', $monthKey)
            ->get()
            ->keyBy('topic_slug');

        $topics = LearnerCompetenceTopic::query()
            ->where('user_id', $user->id)
            ->where('total_points', '>', 0)
            ->orderByDesc('total_points')
            ->orderBy('topic_name')
            ->get()
            ->map(fn (LearnerCompetenceTopic $topic): array => [
                'slug' => $topic->topic_slug,
                'name' => $topic->topic_name,
                'totalPoints' => round((float) $topic->total_points, 2),
                'monthlyPoints' => round((float) ($months->get($topic->topic_slug)?->points ?? 0), 2),
            ])
            ->values()
            ->all();

        $topicSlugs = collect($topics)->pluck('slug')->all();

        return [
            'monthKey' => $monthKey,
            'topics' => $topics,
            'transitions' => LearnerCompetenceTopicTransition::query()
                ->where('user_id', $user->id)
                ->whereIn('from_topic_slug', $topicSlugs)
                ->whereIn('to_topic_slug', $topicSlugs)
                ->where('transition_count', '>', 0)
                ->orderByDesc('transition_count')
                ->get()
                ->map(fn (LearnerCompetenceTopicTransition $transition): array => [
                    'fromTopicSlug' => $transition->from_topic_slug,
                    'fromTopicName' => $transition->from_topic_name,
                    'toTopicSlug' => $transition->to_topic_slug,
                    'toTopicName' => $transition->to_topic_name,
                    'count' => $transition->transition_count,
                ])
                ->values()
                ->all(),
        ];
    }
}
