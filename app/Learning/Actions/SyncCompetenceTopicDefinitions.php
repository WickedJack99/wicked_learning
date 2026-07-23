<?php

namespace App\Learning\Actions;

use App\Models\CompetenceTopicDefinition;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SyncCompetenceTopicDefinitions
{
    /**
     * @param  list<array<string, mixed>>  $topics
     */
    public function handle(array $topics): void
    {
        DB::transaction(function () use ($topics): void {
            $slugs = [];

            foreach ($topics as $topic) {
                $name = trim((string) ($topic['name'] ?? ''));
                $slug = Str::limit(Str::slug($name), 140, '');

                if ($name === '' || $slug === '') {
                    continue;
                }

                $slugs[] = $slug;

                CompetenceTopicDefinition::query()->updateOrCreate([
                    'slug' => $slug,
                ], [
                    'aura_threshold' => $this->threshold($topic['aura_threshold'] ?? null, 10),
                    'description' => trim((string) ($topic['description'] ?? '')) ?: null,
                    'emittance_threshold' => $this->threshold($topic['emittance_threshold'] ?? null, 20),
                    'growth_threshold' => $this->threshold($topic['growth_threshold'] ?? null, 20),
                    'is_active' => (bool) ($topic['is_active'] ?? true),
                    'name' => Str::limit($name, 120, ''),
                ]);
            }

            CompetenceTopicDefinition::query()
                ->whereNotIn('slug', array_values(array_unique($slugs)))
                ->delete();
        });
    }

    private function threshold(mixed $value, float $fallback): float
    {
        $threshold = round((float) $value, 2);

        return $threshold > 0 ? min($threshold, 100000) : $fallback;
    }
}
