<?php

namespace App\Learning\Queries;

use App\Models\CompetenceTopicDefinition;

class LoadCompetenceTopicDefinitions
{
    /**
     * @return list<array<string, mixed>>
     */
    public function handle(bool $activeOnly = false): array
    {
        $definitions = [];

        CompetenceTopicDefinition::query()
            ->when($activeOnly, fn ($query) => $query->where('is_active', true))
            ->orderBy('name')
            ->get()
            ->each(function (CompetenceTopicDefinition $topic) use (&$definitions): void {
                $definitions[] = [
                    'auraThreshold' => round((float) $topic->aura_threshold, 2),
                    'description' => $topic->description,
                    'emittanceThreshold' => round((float) $topic->emittance_threshold, 2),
                    'growthThreshold' => round((float) $topic->growth_threshold, 2),
                    'isActive' => $topic->is_active,
                    'name' => $topic->name,
                    'slug' => $topic->slug,
                ];
            });

        return $definitions;
    }
}
