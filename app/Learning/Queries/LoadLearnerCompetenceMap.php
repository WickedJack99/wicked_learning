<?php

namespace App\Learning\Queries;

use App\Models\CompetenceTopicDefinition;
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
        $definitions = CompetenceTopicDefinition::query()
            ->where('is_active', true)
            ->get()
            ->keyBy('slug');

        $topics = [];

        LearnerCompetenceTopic::query()
            ->where('user_id', $user->id)
            ->where('total_points', '>', 0)
            ->orderByDesc('total_points')
            ->orderBy('topic_name')
            ->get()
            ->each(function (LearnerCompetenceTopic $topic) use (&$topics, $definitions, $months): void {
                $definition = $definitions->get($topic->topic_slug);
                $month = $months->get($topic->topic_slug);
                $hasDefinition = $definition instanceof CompetenceTopicDefinition;

                $topics[] = [
                    'slug' => $topic->topic_slug,
                    'name' => $hasDefinition
                        ? $definition->name
                        : $topic->topic_name,
                    'totalPoints' => round((float) $topic->total_points, 2),
                    'monthlyPoints' => round((float) (
                        $month instanceof LearnerCompetenceTopicMonth
                            ? $month->points
                            : 0
                    ), 2),
                    'growthThreshold' => round((float) (
                        $hasDefinition ? $definition->growth_threshold : 20
                    ), 2),
                    'emittanceThreshold' => round((float) (
                        $hasDefinition ? $definition->emittance_threshold : 20
                    ), 2),
                    'auraThreshold' => round((float) (
                        $hasDefinition ? $definition->aura_threshold : 10
                    ), 2),
                ];
            });

        $topicSlugs = collect($topics)->pluck('slug')->all();
        $transitions = [];

        LearnerCompetenceTopicTransition::query()
            ->where('user_id', $user->id)
            ->whereIn('from_topic_slug', $topicSlugs)
            ->whereIn('to_topic_slug', $topicSlugs)
            ->where('transition_count', '>', 0)
            ->orderByDesc('transition_count')
            ->get()
            ->each(function (LearnerCompetenceTopicTransition $transition) use (&$transitions): void {
                $transitions[] = [
                    'fromTopicSlug' => $transition->from_topic_slug,
                    'fromTopicName' => $transition->from_topic_name,
                    'toTopicSlug' => $transition->to_topic_slug,
                    'toTopicName' => $transition->to_topic_name,
                    'count' => $transition->transition_count,
                ];
            });

        return [
            'monthKey' => $monthKey,
            'topics' => $topics,
            'transitions' => $transitions,
        ];
    }
}
