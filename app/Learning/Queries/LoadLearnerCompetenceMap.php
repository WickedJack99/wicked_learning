<?php

namespace App\Learning\Queries;

use App\Learning\Services\CompetenceVisualScale;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearnerCompetenceTopicTransition;
use App\Models\LearnerEvidenceEvent;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LoadLearnerCompetenceMap
{
    private const RECENT_WINDOW_DAYS = 30;

    public function __construct(
        private readonly CompetenceVisualScale $visualScale,
        private readonly LoadLearnerActivityCheckIns $checkIns,
    ) {}

    /**
     * @return array{checkIns: list<array{activityId: int, activityTitle: string, feeling: string, nodeTitle: string, nodeHref: string, recordedAt: string, topics: list<array{slug: string, name: string}>}>, monthKey: string, recentWindowDays: int, topics: list<array<string, mixed>>, transitions: list<array<string, mixed>>}
     */
    public function handle(User $user): array
    {
        $now = Carbon::now();
        $monthKey = $now->format('Y-m');
        $recentSince = $now->copy()->subDays(self::RECENT_WINDOW_DAYS);
        $definitions = CompetenceTopicDefinition::query()
            ->where('is_active', true)
            ->get()
            ->keyBy('slug');

        $topics = [];

        LearnerEvidenceEvent::query()
            ->where('user_id', $user->id)
            ->with('activity.node')
            ->get()
            ->groupBy('topic_slug')
            ->sortByDesc(fn (Collection $events): float => (float) $events->sum('contribution'))
            ->each(function (Collection $events, string $topicSlug) use (&$topics, $definitions, $recentSince): void {
                $events = $events
                    ->sortByDesc(fn (LearnerEvidenceEvent $event): int => $event->created_at?->getTimestamp() ?? 0)
                    ->values();
                $event = $events->first();
                $definition = $definitions->get($topicSlug);
                $hasDefinition = $definition instanceof CompetenceTopicDefinition;
                $recentSignal = $events
                    ->filter(fn (LearnerEvidenceEvent $event): bool => $event->created_at?->greaterThanOrEqualTo($recentSince) ?? false)
                    ->sum('contribution');

                $topics[] = [
                    'slug' => $topicSlug,
                    'name' => $hasDefinition
                        ? $definition->name
                        : $event->topic_name,
                    'revisit' => $this->revisit($event->activity),
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
                        learningPeriods: $this->learningPeriods($events),
                        evidenceLedger: $this->evidenceLedger($events),
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
            'recentWindowDays' => self::RECENT_WINDOW_DAYS,
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

    /**
     * @param  Collection<int, LearnerEvidenceEvent>  $events
     * @return list<array{id: int, evidenceType: string, activityTitle: string|null, nodeTitle: string|null, nodeHref: string|null, recordedAt: string|null}>
     */
    private function evidenceLedger(Collection $events): array
    {
        return array_values($events
            ->take(6)
            ->map(function (LearnerEvidenceEvent $event): array {
                $activity = $event->activity;
                $node = $activity?->node;

                return [
                    'activityTitle' => $activity?->title,
                    'evidenceType' => $event->evidence_type,
                    'id' => $event->id,
                    'nodeHref' => $node
                        ? route('learning.nodes.play', ['node' => $node])
                        : null,
                    'nodeTitle' => $node?->title,
                    'recordedAt' => $event->created_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all());
    }

    /**
     * Keep the learner's trail qualitative and bounded: each marker means that
     * this topic appeared in at least one learning event during that month.
     *
     * @param  Collection<int, LearnerEvidenceEvent>  $events
     * @return list<string>
     */
    private function learningPeriods(Collection $events): array
    {
        return array_values($events
            ->map(fn (LearnerEvidenceEvent $event): ?string => $event->created_at?->format('Y-m'))
            ->filter(fn (?string $period): bool => $period !== null)
            ->unique()
            ->sortDesc()
            ->take(12)
            ->sort()
            ->values()
            ->map(fn (string $period): string => Carbon::parse($period.'-01')->format('M Y'))
            ->all());
    }

    /** @return array{activityTitle: string, nodeHref: string, nodeTitle: string}|null */
    private function revisit(?LearningActivity $activity): ?array
    {
        if (! $activity instanceof LearningActivity || ! $activity->node) {
            return null;
        }

        return [
            'activityTitle' => $activity->title,
            'nodeHref' => route('learning.nodes.play', ['node' => $activity->node]),
            'nodeTitle' => $activity->node->title,
        ];
    }
}
