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
     * @return list<array{id: int, slug: string, title: string}>
     */
    public function overviewAreas(Collection $areas): array
    {
        return array_values($areas
            ->map(fn (LearningTopicArea $area): array => [
                'id' => $area->id,
                'slug' => $area->slug,
                'title' => $area->title,
            ])
            ->values()
            ->all());
    }

    /**
     * @param  Collection<int, LearningTopic>  $topics
     * @return array<string, mixed>
     */
    public function overviewArea(LearningTopicArea $area, Collection $topics): array
    {
        return [
            'description' => $area->description,
            'id' => $area->id,
            'slug' => $area->slug,
            'title' => $area->title,
            'topics' => $topics
                ->map(fn (LearningTopic $topic): array => [
                    ...$this->summary($topic),
                    'mapCount' => (int) ($topic->visible_map_count ?? 0),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $paths
     * @param  array{currentPage: int, lastPage: int, perPage: int, total: int}  $pathsPagination
     * @param  list<array<string, mixed>>  $subtopics
     * @param  array{currentPage: int, lastPage: int, perPage: int, total: int}  $subtopicsPagination
     * @param  list<array<string, mixed>>  $maps
     * @param  array{currentPage: int, lastPage: int, perPage: int, total: int}  $mapsPagination
     * @return array<string, mixed>
     */
    public function detail(
        LearningTopic $topic,
        array $paths = [],
        array $pathsPagination = [],
        ?array $competence = null,
        array $subtopicCompetence = [],
        array $learningAreas = [],
        array $learningPulse = [],
        ?array $reflectionNarrative = null,
        array $subtopics = [],
        array $subtopicsPagination = [],
        array $maps = [],
        array $mapsPagination = [],
        ?string $pathsPurpose = null,
        ?int $pathsTimeBudget = null,
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
            'learningAreas' => $learningAreas,
            'learningPulse' => $learningPulse,
            'reflectionNarrative' => $reflectionNarrative,
            'subtopicCompetence' => array_values(array_filter(
                array_map(fn (array $entry): ?array => $this->competence($entry), $subtopicCompetence),
            )),
            'parent' => $topic->parent ? $this->summary($topic->parent) : null,
            'paths' => $paths,
            'pathsPagination' => $pathsPagination,
            'pathsPurpose' => $pathsPurpose,
            'pathsTimeBudget' => $pathsTimeBudget,
            'subtopics' => $subtopics,
            'subtopicsPagination' => $subtopicsPagination,
            'maps' => $maps,
            'mapsPagination' => $mapsPagination,
        ];
    }

    /**
     * @param  Collection<int, LearningTopic>  $subtopics
     * @return list<array<string, mixed>>
     */
    public function subtopics(Collection $subtopics): array
    {
        return $subtopics
            ->map(fn (LearningTopic $subtopic): array => [
                ...$this->summary($subtopic),
                'mapCount' => (int) ($subtopic->visible_map_count ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, LearningMap>  $maps
     * @return list<array<string, mixed>>
     */
    public function maps(Collection $maps): array
    {
        return $maps
            ->map(fn (LearningMap $map): array => [
                'description' => $map->description,
                'href' => route('world', ['map' => $map->slug], false),
                'id' => $map->id,
                'nodeCount' => (int) ($map->nodes_count ?? 0),
                'slug' => $map->slug,
                'title' => $map->title,
            ])
            ->values()
            ->all();
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
            'evidenceLedger' => is_array($visual['evidenceLedger'] ?? null)
                ? array_values(array_map(
                    fn (array $entry): array => [
                        'activityHref' => is_string($entry['activityHref'] ?? null)
                            ? $entry['activityHref']
                            : null,
                        'activityTitle' => is_string($entry['activityTitle'] ?? null)
                            ? $entry['activityTitle']
                            : null,
                        'evidenceClaim' => (string) ($entry['evidenceClaim'] ?? 'learning_encounter'),
                        'evidenceType' => (string) ($entry['evidenceType'] ?? ''),
                        'independentCheck' => (bool) ($entry['independentCheck'] ?? false),
                        'objective' => is_string($entry['objective'] ?? null)
                            ? $entry['objective']
                            : null,
                        'concepts' => is_array($entry['concepts'] ?? null)
                            ? array_values(array_filter($entry['concepts'], 'is_string'))
                            : [],
                        'evidenceCriterion' => is_string($entry['evidenceCriterion'] ?? null)
                            ? $entry['evidenceCriterion']
                            : null,
                        'evidenceRubric' => is_array($entry['evidenceRubric'] ?? null)
                            ? array_values(array_filter($entry['evidenceRubric'], 'is_string'))
                            : [],
                        'observedCues' => is_array($entry['observedCues'] ?? null)
                            ? array_values(array_filter($entry['observedCues'], 'is_string'))
                            : [],
                        'sources' => is_array($entry['sources'] ?? null)
                            ? array_values(array_map(
                                fn (array $source): array => [
                                    'anchor' => is_string($source['anchor'] ?? null)
                                        ? $source['anchor']
                                        : null,
                                    'excerpt' => is_string($source['excerpt'] ?? null)
                                        ? $source['excerpt']
                                        : null,
                                    'publishedAt' => is_string($source['publishedAt'] ?? null)
                                        ? $source['publishedAt']
                                        : null,
                                    'publisher' => is_string($source['publisher'] ?? null)
                                        ? $source['publisher']
                                        : null,
                                    'rights' => is_string($source['rights'] ?? null)
                                        ? $source['rights']
                                        : null,
                                    'title' => (string) $source['title'],
                                    'url' => (string) $source['url'],
                                ],
                                array_filter(
                                    $entry['sources'],
                                    fn (mixed $source): bool => is_array($source)
                                        && is_string($source['title'] ?? null)
                                        && is_string($source['url'] ?? null),
                                ),
                            ))
                            : [],
                        'id' => (int) ($entry['id'] ?? 0),
                        'learningPurpose' => is_string($entry['learningPurpose'] ?? null)
                            ? $entry['learningPurpose']
                            : null,
                        'nodeTitle' => is_string($entry['nodeTitle'] ?? null)
                            ? $entry['nodeTitle']
                            : null,
                        'recordedAt' => is_string($entry['recordedAt'] ?? null)
                            ? $entry['recordedAt']
                            : null,
                        'confidence' => is_string($entry['confidence'] ?? null)
                            ? $entry['confidence']
                            : null,
                        'confidenceAfterFeedback' => is_string($entry['confidenceAfterFeedback'] ?? null)
                            ? $entry['confidenceAfterFeedback']
                            : null,
                        'outcome' => is_string($entry['outcome'] ?? null)
                            ? $entry['outcome']
                            : null,
                        'attemptNumber' => (int) ($entry['attemptNumber'] ?? 1),
                        'assistanceLevel' => is_string($entry['assistanceLevel'] ?? null)
                            ? $entry['assistanceLevel']
                            : null,
                    ],
                    array_filter(
                        $visual['evidenceLedger'],
                        fn (mixed $entry): bool => is_array($entry),
                    ),
                ))
                : [],
            'evidenceTypes' => is_array($visual['evidenceTypes'] ?? null)
                ? array_values($visual['evidenceTypes'])
                : [],
            'learningPeriods' => is_array($visual['learningPeriods'] ?? null)
                ? array_values($visual['learningPeriods'])
                : [],
            'name' => (string) ($competence['name'] ?? ''),
            'slug' => (string) ($competence['slug'] ?? ''),
            'recentDescription' => (string) ($visual['recentDescription'] ?? ''),
            'revisit' => is_array($competence['revisit'] ?? null)
                ? [
                    'activityHref' => (string) ($competence['revisit']['activityHref'] ?? ''),
                    'activityTitle' => (string) ($competence['revisit']['activityTitle'] ?? ''),
                    'nodeTitle' => (string) ($competence['revisit']['nodeTitle'] ?? ''),
                ]
                : null,
            'topic' => is_array($competence['relatedTopic'] ?? null)
                ? [
                    'href' => (string) ($competence['relatedTopic']['href'] ?? ''),
                    'title' => (string) ($competence['relatedTopic']['title'] ?? ''),
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
