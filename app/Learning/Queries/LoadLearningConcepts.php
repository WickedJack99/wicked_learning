<?php

namespace App\Learning\Queries;

use App\Models\LearningConcept;

class LoadLearningConcepts
{
    /** @return list<array<string, mixed>> */
    public function handle(): array
    {
        return LearningConcept::query()
            ->orderBy('name')
            ->limit(200)
            ->get()
            ->map(fn (LearningConcept $concept): array => [
                'description' => $concept->description,
                'isActive' => $concept->is_active,
                'name' => $concept->name,
                'slug' => $concept->slug,
            ])
            ->values()
            ->all();
    }

    /** @return list<string> */
    public function names(): array
    {
        return LearningConcept::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->limit(200)
            ->pluck('name')
            ->map(fn (mixed $name): string => (string) $name)
            ->values()
            ->all();
    }
}
