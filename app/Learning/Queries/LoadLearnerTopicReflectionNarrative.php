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
        $reflections = LearnerReflection::query()
            ->where('user_id', $user->id)
            ->whereHas('learningNode.map.topic', function ($query) use ($topicSlugs): void {
                $query
                    ->where('is_published', true)
                    ->whereIn('slug', $topicSlugs);
            })
            ->with(['learningNode.map.topic', 'learningActivity'])
            ->latest('created_at')
            ->get()
            ->filter(function (LearnerReflection $reflection) use ($topicSlugs): bool {
                $topic = $reflection->learningNode?->map?->topic;

                return $topic?->is_published === true
                    && in_array($topic->slug, $topicSlugs, true);
            })
            ->sortBy('created_at')
            ->values();

        if ($reflections->count() < 2) {
            return null;
        }

        return [
            'earlier' => $this->serialize($reflections->first()),
            'entries' => $reflections
                ->reverse()
                ->take(12)
                ->sortBy('created_at')
                ->values()
                ->map(fn (LearnerReflection $reflection): array => $this->serialize($reflection))
                ->all(),
            'later' => $this->serialize($reflections->last()),
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
