<?php

namespace App\Learning\Queries;

use App\Learning\Services\CompetenceVisualScale;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearnerCompetenceTopicTransition;
use App\Models\LearnerEvidenceEvent;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LoadLearnerCompetenceMap
{
    public function __construct(
        private readonly CompetenceVisualScale $visualScale,
        private readonly LoadLearnerActivityCheckIns $checkIns,
    ) {}

    /**
     * @return array{checkIns: list<array{activityId: int, activityTitle: string, feeling: string, nodeTitle: string, nodeHref: string, recordedAt: string, topics: list<array{slug: string, name: string}>}>, monthKey: string, topics: list<array<string, mixed>>, transitions: list<array<string, mixed>>}
     */
    public function handle(User $user): array
    {
        $monthKey = Carbon::now()->format('Y-m');
        $definitions = CompetenceTopicDefinition::query()
            ->where('is_active', true)
            ->get()
            ->keyBy('slug');

        $topics = [];

        LearnerEvidenceEvent::query()
            ->where('user_id', $user->id)
            ->get()
            ->groupBy('topic_slug')
            ->sortByDesc(fn (Collection $events): float => (float) $events->sum('contribution'))
            ->each(function (Collection $events, string $topicSlug) use (&$topics, $definitions, $monthKey): void {
                $event = $events->first();
                $definition = $definitions->get($topicSlug);
                $hasDefinition = $definition instanceof CompetenceTopicDefinition;
                $recentSignal = $events
                    ->filter(fn (LearnerEvidenceEvent $event): bool => $event->created_at?->format('Y-m') === $monthKey)
                    ->sum('contribution');

                $topics[] = [
                    'slug' => $topicSlug,
                    'name' => $hasDefinition
                        ? $definition->name
                        : $event->topic_name,
                    'visual' => $this->visualScale->forTopic(
                        totalSignal: (float) $events->sum('contribution'),
                        recentSignal: (float) $recentSignal,
                        growthThreshold: (float) (
                            $hasDefinition ? $definition->growth_threshold : 20
                        ),
                        brightnessThreshold: (float) (
                            $hasDefinition ? $definition->emittance_threshold : 20
                        ),
                        auraThreshold: (float) (
                            $hasDefinition ? $definition->aura_threshold : 10
                        ),
                        evidenceTypes: $this->evidenceTypes($events),
                    ),
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
            'checkIns' => $this->checkIns->handle($user),
            'monthKey' => $monthKey,
            'topics' => $topics,
            'transitions' => $transitions,
        ];
    }

    /**
     * @param  Collection<int, LearnerEvidenceEvent>  $events
     * @return list<string>
     */
    private function evidenceTypes(Collection $events): array
    {
        $types = [];

        foreach ($events->pluck('evidence_type') as $type) {
            if (! is_string($type) || $type === '' || in_array($type, $types, true)) {
                continue;
            }

            $types[] = $type;
        }

        sort($types);

        return $types;
    }
}
