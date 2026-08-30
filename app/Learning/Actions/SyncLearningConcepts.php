<?php

namespace App\Learning\Actions;

use App\Models\LearningConcept;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SyncLearningConcepts
{
    /**
     * @param  list<array<string, mixed>>  $concepts
     */
    public function handle(array $concepts): void
    {
        DB::transaction(function () use ($concepts): void {
            $slugs = [];

            foreach ($concepts as $concept) {
                $name = trim((string) ($concept['name'] ?? ''));
                $slug = Str::limit(Str::slug($name), 140, '');

                if ($name === '' || $slug === '') {
                    continue;
                }

                $slugs[] = $slug;

                LearningConcept::query()->updateOrCreate([
                    'slug' => $slug,
                ], [
                    'description' => trim((string) ($concept['description'] ?? '')) ?: null,
                    'is_active' => (bool) ($concept['is_active'] ?? true),
                    'name' => Str::limit($name, 120, ''),
                ]);
            }

            LearningConcept::query()
                ->whereNotIn('slug', array_values(array_unique($slugs)))
                ->delete();
        });
    }
}
