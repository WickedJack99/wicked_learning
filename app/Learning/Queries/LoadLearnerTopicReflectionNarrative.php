<?php

namespace App\Learning\Queries;

use App\Models\LearnerReflection;
use App\Models\User;

/** Loads a small private before-and-after view for a learner's topic trail. */
class LoadLearnerTopicReflectionNarrative
{
    /**
     * @param  list<string>  $topicSlugs
     * @return array{earlier: array<string, mixed>, entries: list<array<string, mixed>>, later: array<string, mixed>}|null
     */
    public function handle(User $user, array $topicSlugs): ?array
    {
        $matchingReflections = LearnerReflection::query()
            ->where('user_id', $user->id)
            ->whereHas('learningNode.map.topic', function ($query) use ($topicSlugs): void {
                $query
                    ->where('is_published', true)
                    ->whereIn('slug', $topicSlugs);
            })
            ->with(['learningNode.map.topic', 'learningActivity']);
        $latestReflections = (clone $matchingReflections)
            ->latest('created_at')
            ->latest('id')
            ->limit(12)
            ->get()
            ->filter(function (LearnerReflection $reflection) use ($topicSlugs): bool {
                $topic = $reflection->learningNode?->map?->topic;

                return $topic?->is_published === true
                    && in_array($topic->slug, $topicSlugs, true);
            })
            ->values();
        $earliestReflection = (clone $matchingReflections)
            ->oldest('created_at')
            ->oldest('id')
            ->first();

        if (! $earliestReflection instanceof LearnerReflection || $latestReflections->count() < 2) {
            return null;
        }

        return [
            'earlier' => $this->serialize($earliestReflection),
            'entries' => $latestReflections
                ->sortBy('created_at')
                ->values()
                ->map(fn (LearnerReflection $reflection): array => $this->serialize($reflection))
                ->all(),
            'later' => $this->serialize($latestReflections->first()),
        ];
    }

    /** @return array<string, mixed> */
    private function serialize(LearnerReflection $reflection): array
    {
        return [
            'id' => $reflection->id,
            'activityTitle' => $reflection->learningActivity?->title,
            'createdAt' => $reflection->created_at?->toIso8601String(),
            'journalHref' => '/journal',
            'question' => $reflection->question,
            'reflection' => $reflection->reflection,
        ];
    }
}
