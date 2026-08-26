<?php

namespace App\Learning\Queries;

use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Models\CompetenceTopicDefinition;
use App\Models\LearningActivity;

class LoadCompetenceTopicDefinitions
{
    public function __construct(
        private readonly ActivityCompetenceConfiguration $activityCompetence,
    ) {}

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

        if (! $activeOnly) {
            $this->appendActivityTopics($definitions);
        }

        usort(
            $definitions,
            fn (array $a, array $b): int => strnatcasecmp((string) $a['name'], (string) $b['name']),
        );

        return $definitions;
    }

    /** @return list<string> */
    public function names(bool $activeOnly = true): array
    {
        return CompetenceTopicDefinition::query()
            ->when($activeOnly, fn ($query) => $query->where('is_active', true))
            ->orderBy('name')
            ->pluck('name')
            ->map(fn (mixed $name): string => (string) $name)
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $definitions
     */
    private function appendActivityTopics(array &$definitions): void
    {
        $knownSlugs = [];

        foreach ($definitions as $definition) {
            $slug = (string) ($definition['slug'] ?? '');

            if ($slug !== '') {
                $knownSlugs[$slug] = true;
            }
        }

        LearningActivity::query()
            ->whereNotNull('config')
            ->get()
            ->each(function (LearningActivity $activity) use (&$definitions, &$knownSlugs): void {
                foreach ($this->activityCompetence->topicsForActivity($activity) as $topic) {
                    if (isset($knownSlugs[$topic['slug']])) {
                        continue;
                    }

                    $knownSlugs[$topic['slug']] = true;
                    $definitions[] = [
                        'auraThreshold' => 10,
                        'description' => null,
                        'emittanceThreshold' => 20,
                        'growthThreshold' => 20,
                        'isActive' => true,
                        'name' => $topic['topic'],
                        'slug' => $topic['slug'],
                    ];
                }
            });
    }
}
