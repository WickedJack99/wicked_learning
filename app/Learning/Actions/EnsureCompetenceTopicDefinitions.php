<?php

namespace App\Learning\Actions;

use App\Models\CompetenceTopicDefinition;
use Illuminate\Support\Str;

class EnsureCompetenceTopicDefinitions
{
    /**
     * @param  list<array{topic: string, slug: string, weight?: float}>  $topics
     */
    public function handle(array $topics): void
    {
        foreach ($topics as $topic) {
            $name = trim($topic['topic']);
            $slug = trim($topic['slug']);

            if ($name === '' || $slug === '') {
                continue;
            }

            CompetenceTopicDefinition::query()->firstOrCreate([
                'slug' => $slug,
            ], [
                'aura_threshold' => 10,
                'description' => null,
                'emittance_threshold' => 20,
                'growth_threshold' => 20,
                'is_active' => true,
                'name' => Str::limit($name, 120, ''),
            ]);
        }
    }
}
