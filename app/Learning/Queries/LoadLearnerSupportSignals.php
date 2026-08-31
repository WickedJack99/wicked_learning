<?php

namespace App\Learning\Queries;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\LearnerEvidenceEvent;
use App\Models\LearnerNodeDiscovery;
use App\Models\User;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LoadLearnerSupportSignals
{
    public function __construct(
        private readonly LoadLearnerPeerSupportDigest $peerSupportDigest,
    ) {}

    /**
     * @return array{activityOverview30Days: list<array{activeLearners: int, date: string, contributionRecorded: float, evidenceEvents: int}>, monthKey: string, learners: list<array<string, mixed>>, peerSupport: list<array{activityId: int, activityTitle: string, contributorCount: int, latestReviewAt: string|null, mapId: int, mapTitle: string, nodeId: int, nodeTitle: string, unresolvedReviewCount: int}>, summary: array{learners: int, learnersWithSignals: int, topicsWithMonthlyActivity: int}}
     */
    public function handle(User $viewer): array
    {
        $now = Carbon::now();
        $monthKey = $now->format('Y-m');
        $learners = $this->visibleLearners($viewer)
            ->orderBy('name')
            ->orderBy('id')
            ->get();
        $learnerIds = $learners
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->values()
            ->all();
        $lastActivityByUser = $this->lastActivityByUser($learnerIds);
        $eventsByUser = LearnerEvidenceEvent::query()
            ->whereIn('user_id', $learnerIds)
            ->get()
            ->groupBy('user_id');
        $manualUnlocksByUser = $this->manualUnlocksByUser($learnerIds);
        $supportLearners = $learners
            ->map(fn (User $learner): array => $this->learnerSignals(
                $learner,
                $eventsByUser->get($learner->id, collect()),
                $monthKey,
                $lastActivityByUser->get($learner->id),
                $manualUnlocksByUser->get($learner->id, collect()),
            ))
            ->values()
            ->all();
        $supportLearnerList = array_values($supportLearners);

        return [
            'activityOverview30Days' => $this->activityOverview($learnerIds, $now),
            'monthKey' => $monthKey,
            'learners' => $supportLearnerList,
            'peerSupport' => $this->peerSupportDigest->handle($learnerIds),
            'summary' => [
                'learners' => count($supportLearnerList),
                'learnersWithSignals' => collect($supportLearnerList)
                    ->filter(fn (array $learner): bool => count($learner['topics']) > 0)
                    ->count(),
                'topicsWithMonthlyActivity' => collect($supportLearnerList)
                    ->flatMap(fn (array $learner): array => $learner['topics'])
                    ->filter(fn (array $topic): bool => (float) $topic['monthlyContribution'] > 0)
                    ->count(),
            ],
        ];
    }

    public function canViewLearner(User $viewer, int $learnerId): bool
    {
        return $this->visibleLearners($viewer)->whereKey($learnerId)->exists();
    }

    /**
     * @return Builder<User>
     */
    private function visibleLearners(User $viewer): Builder
    {
        $scope = $viewer->accessScopeFor(
            PermissionCatalog::LEARNER_SUPPORT_SIGNALS,
            AccessLevel::READ,
        );
        $query = User::query()
            ->select(['id', 'name', 'username', 'email'])
            ->with('learningGroups:id,name,study_topic');

        if (AccessScope::allows($scope, AccessScope::ALL)) {
            return $query;
        }

        if (AccessScope::allows($scope, AccessScope::GROUP)) {
            $groupIds = $viewer->learningGroups()
                ->pluck('learning_groups.id')
                ->all();

            return $groupIds === []
                ? $query->whereRaw('1 = 0')
                : $query->whereHas(
                    'learningGroups',
                    fn (Builder $groups): Builder => $groups->whereIn('learning_groups.id', $groupIds),
                );
        }

        if (AccessScope::allows($scope, AccessScope::OWN)) {
            return $query->whereKey($viewer->id);
        }

        return $query->whereRaw('1 = 0');
    }

    /**
     * @param  Collection<int, LearnerEvidenceEvent>  $events
     * @return array<string, mixed>
     */
    private function learnerSignals(
        User $learner,
        Collection $events,
        string $monthKey,
        mixed $lastActivityAt,
        Collection $manualUnlocks,
    ): array {
        $topicSignals = $events
            ->groupBy('topic_slug')
            ->map(fn (Collection $topicEvents): array => $this->topicSignal($topicEvents, $monthKey))
            ->sortByDesc('totalContribution')
            ->values()
            ->all();
        $topicSignalList = array_values($topicSignals);

        return [
            'id' => $learner->id,
            'name' => $learner->name,
            'username' => $learner->username,
            'email' => $learner->email,
            'lastActivityAt' => $this->timestamp($lastActivityAt),
            'groups' => $learner->learningGroups
                ->map(fn ($group): array => [
                    'id' => $group->id,
                    'name' => $group->name,
                    'studyTopic' => $group->study_topic,
                ])
                ->values()
                ->all(),
            'topics' => $topicSignalList,
            'signals' => $this->supportNotes($topicSignalList),
            'manualUnlocks' => $manualUnlocks
                ->map(fn (LearnerNodeDiscovery $discovery): array => [
                    'nodeId' => (int) $discovery->learning_node_id,
                    'mapTitle' => $discovery->node?->map?->title,
                    'nodeTitle' => $discovery->node?->title,
                    'grantedAt' => data_get($discovery->metadata, 'manualUnlock.grantedAt'),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  list<int>  $learnerIds
     * @return Collection<int, Collection<int, LearnerNodeDiscovery>>
     */
    private function manualUnlocksByUser(array $learnerIds): Collection
    {
        if ($learnerIds === []) {
            return collect();
        }

        return LearnerNodeDiscovery::query()
            ->with(['node:id,learning_map_id,title', 'node.map:id,title'])
            ->whereIn('user_id', $learnerIds)
            ->get()
            ->filter(fn (LearnerNodeDiscovery $discovery): bool => is_array($discovery->metadata)
                && is_array($discovery->metadata['manualUnlock'] ?? null)
                && isset($discovery->metadata['manualUnlock']['grantedAt']))
            ->groupBy('user_id');
    }

    /**
     * @param  Collection<int, LearnerEvidenceEvent>  $events
     * @return array{slug: string, name: string, totalContribution: float, monthlyContribution: float, evidenceTypes: list<string>}
     */
    private function topicSignal(Collection $events, string $monthKey): array
    {
        /** @var LearnerEvidenceEvent $firstEvent */
        $firstEvent = $events->first();

        return [
            'slug' => $firstEvent->topic_slug,
            'name' => $firstEvent->topic_name,
            'totalContribution' => round((float) $events->sum('contribution'), 2),
            'monthlyContribution' => round((float) $events
                ->filter(fn (LearnerEvidenceEvent $event): bool => $event->created_at?->format('Y-m') === $monthKey)
                ->sum('contribution'), 2),
            'evidenceTypes' => $this->evidenceTypes($events),
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
     * @param  list<array{slug: string, name: string, totalContribution: float, monthlyContribution: float, evidenceTypes: list<string>}>  $topics
     * @return list<array{tone: string, text: string}>
     */
    private function supportNotes(array $topics): array
    {
        if ($topics === []) {
            return [[
                'tone' => 'quiet',
                'text' => 'No competence signals have been recorded yet. This is a starting point, not a deficit.',
            ]];
        }

        $monthlyTotal = array_sum(array_column($topics, 'monthlyContribution'));
        $notes = [];

        if ($monthlyTotal <= 0) {
            $notes[] = [
                'tone' => 'attention',
                'text' => 'No topic activity is visible for the current month. A gentle check-in may be useful.',
            ];
        } else {
            $monthlyTopics = array_values(array_filter(
                $topics,
                fn (array $topic): bool => $topic['monthlyContribution'] > 0,
            ));
            usort(
                $monthlyTopics,
                fn (array $a, array $b): int => $b['monthlyContribution'] <=> $a['monthlyContribution'],
            );

            $notes[] = [
                'tone' => 'support',
                'text' => 'Current focus: '.$monthlyTopics[0]['name'].'.',
            ];
        }

        if (count($topics) >= 3) {
            $notes[] = [
                'tone' => 'support',
                'text' => 'Activity is spread across several topics. This can be a useful bridge for mentoring conversations.',
            ];
        }

        return $notes;
    }

    /**
     * @param  array<int, int>  $learnerIds
     * @return Collection<int, mixed>
     */
    private function lastActivityByUser(array $learnerIds): Collection
    {
        if ($learnerIds === []) {
            return collect();
        }

        return LearnerEvidenceEvent::query()
            ->whereIn('user_id', $learnerIds)
            ->selectRaw('user_id, MAX(created_at) as last_activity_at')
            ->groupBy('user_id')
            ->pluck('last_activity_at', 'user_id');
    }

    /**
     * @param  array<int, int>  $learnerIds
     * @return list<array{activeLearners: int, date: string, contributionRecorded: float, evidenceEvents: int}>
     */
    private function activityOverview(array $learnerIds, Carbon $now): array
    {
        $buckets = $this->emptyActivityBuckets($now);

        if ($learnerIds === []) {
            return $this->activityBucketList($buckets);
        }

        LearnerEvidenceEvent::query()
            ->whereIn('user_id', $learnerIds)
            ->whereBetween('created_at', [
                $now->copy()->subDays(29)->startOfDay(),
                $now->copy()->endOfDay(),
            ])
            ->get(['user_id', 'contribution', 'created_at'])
            ->each(function (LearnerEvidenceEvent $event) use (&$buckets): void {
                $date = $this->dateKey($event->created_at);

                if (! isset($buckets[$date])) {
                    return;
                }

                $buckets[$date]['activeLearnerIds'][(int) $event->user_id] = true;
                $buckets[$date]['contributionRecorded'] = round($buckets[$date]['contributionRecorded'] + (float) $event->contribution, 2);
                $buckets[$date]['evidenceEvents']++;
            });

        return $this->activityBucketList($buckets);
    }

    /**
     * @return array<string, array{activeLearnerIds: array<int, true>, date: string, contributionRecorded: float, evidenceEvents: int}>
     */
    private function emptyActivityBuckets(Carbon $now): array
    {
        $buckets = [];
        $start = $now->copy()->subDays(29)->startOfDay();

        for ($day = 0; $day < 30; $day++) {
            $date = $start->copy()->addDays($day)->toDateString();
            $buckets[$date] = [
                'activeLearnerIds' => [],
                'date' => $date,
                'contributionRecorded' => 0.0,
                'evidenceEvents' => 0,
            ];
        }

        return $buckets;
    }

    /**
     * @param  array<string, array{activeLearnerIds: array<int, true>, date: string, contributionRecorded: float, evidenceEvents: int}>  $buckets
     * @return list<array{activeLearners: int, date: string, contributionRecorded: float, evidenceEvents: int}>
     */
    private function activityBucketList(array $buckets): array
    {
        return array_values(array_map(
            fn (array $bucket): array => [
                'activeLearners' => count($bucket['activeLearnerIds']),
                'date' => $bucket['date'],
                'contributionRecorded' => round($bucket['contributionRecorded'], 2),
                'evidenceEvents' => $bucket['evidenceEvents'],
            ],
            $buckets,
        ));
    }

    private function timestamp(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return Carbon::instance($value)->toIso8601String();
        }

        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return Carbon::parse($value)->toIso8601String();
    }

    private function dateKey(mixed $value): string
    {
        if ($value instanceof DateTimeInterface) {
            return Carbon::instance($value)->toDateString();
        }

        return Carbon::parse((string) $value)->toDateString();
    }
}
