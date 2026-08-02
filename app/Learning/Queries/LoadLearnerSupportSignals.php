<?php

namespace App\Learning\Queries;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\LearnerCompetenceActivityAward;
use App\Models\LearnerCompetenceTopic;
use App\Models\LearnerCompetenceTopicMonth;
use App\Models\User;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LoadLearnerSupportSignals
{
    /**
     * @return array{activityOverview30Days: list<array{activeLearners: int, date: string, pointsAwarded: float, topicAwards: int}>, monthKey: string, learners: list<array<string, mixed>>, summary: array{learners: int, learnersWithSignals: int, topicsWithMonthlyActivity: int}}
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
        $topicsByUser = LearnerCompetenceTopic::query()
            ->whereIn('user_id', $learnerIds)
            ->where('total_points', '>', 0)
            ->orderByDesc('total_points')
            ->orderBy('topic_name')
            ->get()
            ->groupBy('user_id');
        $monthlyTopicsByUser = LearnerCompetenceTopicMonth::query()
            ->whereIn('user_id', $learnerIds)
            ->where('month_key', $monthKey)
            ->where('points', '>', 0)
            ->get()
            ->groupBy('user_id')
            ->map(fn (Collection $topics): Collection => $topics->keyBy('topic_slug'));
        $supportLearners = $learners
            ->map(fn (User $learner): array => $this->learnerSignals(
                $learner,
                $topicsByUser->get($learner->id, collect()),
                $monthlyTopicsByUser->get($learner->id, collect()),
                $lastActivityByUser->get($learner->id),
            ))
            ->values()
            ->all();
        $supportLearnerList = array_values($supportLearners);

        return [
            'activityOverview30Days' => $this->activityOverview($learnerIds, $now),
            'monthKey' => $monthKey,
            'learners' => $supportLearnerList,
            'summary' => [
                'learners' => count($supportLearnerList),
                'learnersWithSignals' => collect($supportLearnerList)
                    ->filter(fn (array $learner): bool => count($learner['topics']) > 0)
                    ->count(),
                'topicsWithMonthlyActivity' => collect($supportLearnerList)
                    ->flatMap(fn (array $learner): array => $learner['topics'])
                    ->filter(fn (array $topic): bool => (float) $topic['monthlyPoints'] > 0)
                    ->count(),
            ],
        ];
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
     * @param  Collection<int, LearnerCompetenceTopic>  $topics
     * @param  Collection<string, LearnerCompetenceTopicMonth>  $monthlyTopics
     * @return array<string, mixed>
     */
    private function learnerSignals(User $learner, Collection $topics, Collection $monthlyTopics, mixed $lastActivityAt): array
    {
        $topicSignals = $topics
            ->map(fn (LearnerCompetenceTopic $topic): array => $this->topicSignal($topic, $monthlyTopics))
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
        ];
    }

    /**
     * @param  Collection<string, LearnerCompetenceTopicMonth>  $monthlyTopics
     * @return array{slug: string, name: string, totalPoints: float, monthlyPoints: float}
     */
    private function topicSignal(LearnerCompetenceTopic $topic, Collection $monthlyTopics): array
    {
        $monthlyTopic = $monthlyTopics->get($topic->topic_slug);

        return [
            'slug' => $topic->topic_slug,
            'name' => $topic->topic_name,
            'totalPoints' => round((float) $topic->total_points, 2),
            'monthlyPoints' => round((float) (
                $monthlyTopic instanceof LearnerCompetenceTopicMonth
                    ? $monthlyTopic->points
                    : 0
            ), 2),
        ];
    }

    /**
     * @param  list<array{slug: string, name: string, totalPoints: float, monthlyPoints: float}>  $topics
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

        $monthlyTotal = array_sum(array_column($topics, 'monthlyPoints'));
        $notes = [];

        if ($monthlyTotal <= 0) {
            $notes[] = [
                'tone' => 'attention',
                'text' => 'No topic activity is visible for the current month. A gentle check-in may be useful.',
            ];
        } else {
            $monthlyTopics = array_values(array_filter(
                $topics,
                fn (array $topic): bool => $topic['monthlyPoints'] > 0,
            ));
            usort(
                $monthlyTopics,
                fn (array $a, array $b): int => $b['monthlyPoints'] <=> $a['monthlyPoints'],
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

        return LearnerCompetenceActivityAward::query()
            ->whereIn('user_id', $learnerIds)
            ->selectRaw('user_id, MAX(created_at) as last_activity_at')
            ->groupBy('user_id')
            ->pluck('last_activity_at', 'user_id');
    }

    /**
     * @param  array<int, int>  $learnerIds
     * @return list<array{activeLearners: int, date: string, pointsAwarded: float, topicAwards: int}>
     */
    private function activityOverview(array $learnerIds, Carbon $now): array
    {
        $buckets = $this->emptyActivityBuckets($now);

        if ($learnerIds === []) {
            return $this->activityBucketList($buckets);
        }

        LearnerCompetenceActivityAward::query()
            ->whereIn('user_id', $learnerIds)
            ->whereBetween('created_at', [
                $now->copy()->subDays(29)->startOfDay(),
                $now->copy()->endOfDay(),
            ])
            ->get(['user_id', 'points', 'created_at'])
            ->each(function (LearnerCompetenceActivityAward $award) use (&$buckets): void {
                $date = $this->dateKey($award->created_at);

                if (! isset($buckets[$date])) {
                    return;
                }

                $buckets[$date]['activeLearnerIds'][(int) $award->user_id] = true;
                $buckets[$date]['pointsAwarded'] = round($buckets[$date]['pointsAwarded'] + (float) $award->points, 2);
                $buckets[$date]['topicAwards']++;
            });

        return $this->activityBucketList($buckets);
    }

    /**
     * @return array<string, array{activeLearnerIds: array<int, true>, date: string, pointsAwarded: float, topicAwards: int}>
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
                'pointsAwarded' => 0.0,
                'topicAwards' => 0,
            ];
        }

        return $buckets;
    }

    /**
     * @param  array<string, array{activeLearnerIds: array<int, true>, date: string, pointsAwarded: float, topicAwards: int}>  $buckets
     * @return list<array{activeLearners: int, date: string, pointsAwarded: float, topicAwards: int}>
     */
    private function activityBucketList(array $buckets): array
    {
        return array_values(array_map(
            fn (array $bucket): array => [
                'activeLearners' => count($bucket['activeLearnerIds']),
                'date' => $bucket['date'],
                'pointsAwarded' => round($bucket['pointsAwarded'], 2),
                'topicAwards' => $bucket['topicAwards'],
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
