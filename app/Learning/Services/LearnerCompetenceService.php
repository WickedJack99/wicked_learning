<?php

namespace App\Learning\Services;

use App\Models\LearnerCompetenceTopic;
use App\Models\LearnerCompetenceTopicMonth;
use App\Models\LearnerCompetenceTopicTransition;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LearnerCompetenceService
{
    public function __construct(private readonly ActivityCompetenceConfiguration $activityCompetence) {}

    public function awardActivityCompletion(User $user, LearningActivity $activity, string $playRunId): void
    {
        $topics = $this->activityCompetence->topicsForActivity($activity);

        if ($topics === []) {
            return;
        }

        DB::transaction(function () use ($activity, $playRunId, $topics, $user): void {
            foreach ($topics as $topic) {
                $inserted = DB::table('learner_competence_activity_awards')->insertOrIgnore([
                    'user_id' => $user->id,
                    'learning_activity_id' => $activity->id,
                    'play_run_id' => $playRunId,
                    'topic_slug' => $topic['slug'],
                    'topic_name' => $topic['topic'],
                    'points' => $topic['weight'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if ($inserted !== 1) {
                    continue;
                }

                $this->incrementTopic($user, $topic['slug'], $topic['topic'], $topic['weight']);
                $this->incrementMonthlyTopic($user, $topic['slug'], $topic['topic'], $topic['weight']);
            }
        });
    }

    public function visitActivityTopics(User $user, LearningActivity $activity): void
    {
        $currentTopics = $this->activityCompetence->topicsForActivity($activity);

        if ($currentTopics === []) {
            return;
        }

        $previousTopics = $this->storedTopicSet($user->last_competence_topics);

        DB::transaction(function () use ($currentTopics, $previousTopics, $user): void {
            if ($previousTopics !== [] && ! $this->sameTopicSet($previousTopics, $currentTopics)) {
                $this->recordTopicSetTransition($user, $previousTopics, $currentTopics);
            }

            $user->forceFill([
                'last_competence_topics' => array_map(
                    fn (array $topic): array => [
                        'slug' => $topic['slug'],
                        'topic' => $topic['topic'],
                    ],
                    $currentTopics,
                ),
            ])->save();
        });
    }

    /**
     * @param  list<array{topic: string, slug: string, weight?: float}>  $fromTopics
     * @param  list<array{topic: string, slug: string, weight?: float}>  $toTopics
     */
    private function recordTopicSetTransition(User $user, array $fromTopics, array $toTopics): void
    {
        foreach ($fromTopics as $fromTopic) {
            foreach ($toTopics as $toTopic) {
                if ($fromTopic['slug'] === $toTopic['slug']) {
                    continue;
                }

                $transition = LearnerCompetenceTopicTransition::query()->firstOrNew([
                    'user_id' => $user->id,
                    'from_topic_slug' => $fromTopic['slug'],
                    'to_topic_slug' => $toTopic['slug'],
                ]);

                $transition->from_topic_name = $fromTopic['topic'];
                $transition->to_topic_name = $toTopic['topic'];
                $transition->transition_count = ((int) $transition->transition_count) + 1;
                $transition->save();
            }
        }
    }

    private function incrementTopic(User $user, string $slug, string $name, float $points): void
    {
        $topic = LearnerCompetenceTopic::query()->firstOrNew([
            'user_id' => $user->id,
            'topic_slug' => $slug,
        ]);

        $topic->topic_name = $name;
        $topic->total_points = round(((float) $topic->total_points) + $points, 2);
        $topic->save();
    }

    private function incrementMonthlyTopic(User $user, string $slug, string $name, float $points): void
    {
        $topic = LearnerCompetenceTopicMonth::query()->firstOrNew([
            'user_id' => $user->id,
            'topic_slug' => $slug,
            'month_key' => Carbon::now()->format('Y-m'),
        ]);

        $topic->topic_name = $name;
        $topic->points = round(((float) $topic->points) + $points, 2);
        $topic->save();
    }

    /**
     * @return list<array{topic: string, slug: string}>
     */
    private function storedTopicSet(mixed $topics): array
    {
        if (! is_array($topics)) {
            return [];
        }

        $topicSet = [];

        foreach ($topics as $topic) {
            if (! is_array($topic)) {
                continue;
            }

            $slug = trim((string) ($topic['slug'] ?? ''));
            $name = trim((string) ($topic['topic'] ?? ''));

            if ($slug === '' || $name === '') {
                continue;
            }

            $topicSet[$slug] = [
                'slug' => $slug,
                'topic' => $name,
            ];
        }

        return array_values($topicSet);
    }

    /**
     * @param  list<array{slug: string}>  $first
     * @param  list<array{slug: string}>  $second
     */
    private function sameTopicSet(array $first, array $second): bool
    {
        $firstSlugs = collect($first)->pluck('slug')->sort()->values()->all();
        $secondSlugs = collect($second)->pluck('slug')->sort()->values()->all();

        return $firstSlugs === $secondSlugs;
    }
}
