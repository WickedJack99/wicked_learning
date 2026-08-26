<?php

namespace App\Learning\Serializers;

use App\Models\LearningMap;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use Illuminate\Support\Collection;

class LearningTopicSerializer
{
    /**
     * @param  Collection<int, LearningTopicArea>  $areas
     * @return list<array<string, mixed>>
     */
    public function overview(Collection $areas): array
    {
        return array_values($areas
            ->map(fn (LearningTopicArea $area): array => [
                'description' => $area->description,
                'id' => $area->id,
                'slug' => $area->slug,
                'title' => $area->title,
                'topics' => $area->rootTopics
                    ->map(fn (LearningTopic $topic): array => [
                        ...$this->summary($topic),
                        'mapCount' => $topic->maps->count(),
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all());
    }

    /**
     * @param  list<array<string, mixed>>  $paths
     * @return array<string, mixed>
     */
    public function detail(
        LearningTopic $topic,
        array $paths = [],
        ?array $competence = null,
    ): array {
        return [
            ...$this->summary($topic),
            'area' => [
                'id' => $topic->area->id,
                'slug' => $topic->area->slug,
                'title' => $topic->area->title,
            ],
            'content' => $topic->content,
            'competence' => $this->competence($competence),
            'parent' => $topic->parent ? $this->summary($topic->parent) : null,
            'paths' => $paths,
            'subtopics' => $topic->children
                ->map(fn (LearningTopic $child): array => [
                    ...$this->summary($child),
                    'mapCount' => $child->maps->count(),
                ])
                ->values()
                ->all(),
            'maps' => $topic->maps
                ->map(fn (LearningMap $map): array => [
                    'description' => $map->description,
                    'href' => route('world', ['map' => $map->slug], false),
                    'id' => $map->id,
                    'nodeCount' => $map->nodes->count(),
                    'slug' => $map->slug,
                    'title' => $map->title,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Collection<int, LearningTopicArea>  $areas
     * @return list<array<string, mixed>>
     */
    public function administration(Collection $areas): array
    {
        return array_values($areas
            ->map(fn (LearningTopicArea $area): array => [
                'description' => $area->description,
                'id' => $area->id,
                'slug' => $area->slug,
                'sortOrder' => $area->sort_order,
                'title' => $area->title,
                'topics' => $area->topics
                    ->map(fn (LearningTopic $topic): array => [
                        ...$this->summary($topic),
                        'content' => $topic->content,
                        'isPublished' => $topic->is_published,
                        'parentId' => $topic->parent_id,
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all());
    }

    /** @return array<string, mixed> */
    private function summary(LearningTopic $topic): array
    {
        return [
            'description' => $topic->description,
            'href' => route('topics.show', $topic, false),
            'id' => $topic->id,
            'slug' => $topic->slug,
            'title' => $topic->title,
        ];
    }

    /** @param array<string, mixed>|null $competence */
    private function competence(?array $competence): ?array
    {
        if ($competence === null || ! is_array($competence['visual'] ?? null)) {
            return null;
        }

        $visual = $competence['visual'];

        return [
            'evidenceTypes' => is_array($visual['evidenceTypes'] ?? null)
                ? array_values($visual['evidenceTypes'])
                : [],
            'learningPeriods' => is_array($visual['learningPeriods'] ?? null)
                ? array_values($visual['learningPeriods'])
                : [],
            'recentDescription' => (string) ($visual['recentDescription'] ?? ''),
            'revisit' => is_array($competence['revisit'] ?? null)
                ? [
                    'activityHref' => (string) ($competence['revisit']['activityHref'] ?? ''),
                    'activityTitle' => (string) ($competence['revisit']['activityTitle'] ?? ''),
                    'nodeTitle' => (string) ($competence['revisit']['nodeTitle'] ?? ''),
                ]
                : null,
            'visual' => [
                'auraRatio' => (float) ($visual['auraRatio'] ?? 0),
                'brightnessRatio' => (float) ($visual['brightnessRatio'] ?? 0),
                'description' => (string) ($visual['description'] ?? ''),
                'sizeRatio' => (float) ($visual['sizeRatio'] ?? 0),
            ],
        ];
    }
}
