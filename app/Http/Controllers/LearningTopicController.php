<?php

namespace App\Http\Controllers;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadLearnerCompetenceMap;
use App\Learning\Queries\LoadLearnerTopicReflectionNarrative;
use App\Learning\Queries\LoadLearningPaths;
use App\Learning\Queries\LoadLearningTopics;
use App\Learning\Serializers\LearningPathSerializer;
use App\Learning\Serializers\LearningTopicSerializer;
use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Models\LearningActivity;
use App\Models\LearningTopic;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class LearningTopicController extends Controller
{
    private const array TOPIC_SECTIONS = ['trail', 'routes', 'maps', 'overview'];

    public function __construct(
        private readonly LoadLearningTopics $topics,
        private readonly LoadLearningPaths $paths,
        private readonly LoadLearnerCompetenceMap $competenceMap,
        private readonly LoadLearnerTopicReflectionNarrative $reflectionNarrative,
        private readonly LearningPathSerializer $pathSerializer,
        private readonly LearningTopicSerializer $serializer,
        private readonly ActivityCompetenceConfiguration $competenceConfiguration,
    ) {}

    public function index(Request $request): Response
    {
        $areas = $this->topics->overviewAreas();
        $selectedAreaSlug = $request->query('area');
        $search = mb_substr(trim((string) $request->query('search', '')), 0, 120);
        $selectedArea = $areas->firstWhere(
            'slug',
            is_string($selectedAreaSlug) ? $selectedAreaSlug : '',
        ) ?? $areas->first();
        $topicPage = $selectedArea
            ? $this->topics->overviewTopics(
                $selectedArea,
                $request->user(),
                page: max(1, (int) $request->query('page', 1)),
                search: $search,
            )
            : null;

        return Inertia::render('topics/index', [
            'areaOptions' => $this->serializer->overviewAreas($areas),
            'selectedArea' => $selectedArea && $topicPage
                ? $this->serializer->overviewArea(
                    $selectedArea,
                    $topicPage->getCollection(),
                )
                : null,
            'pagination' => $topicPage
                ? [
                    'currentPage' => $topicPage->currentPage(),
                    'lastPage' => max(1, $topicPage->lastPage()),
                    'perPage' => $topicPage->perPage(),
                    'total' => $topicPage->total(),
                ]
                : [
                    'currentPage' => 1,
                    'lastPage' => 1,
                    'perPage' => 6,
                    'total' => 0,
                ],
            'search' => $search,
            'canManageTopics' => $request->user()?->hasAccess(
                PermissionCatalog::CONTENT_TOPICS,
                AccessLevel::READ,
            ) ?? false,
        ]);
    }

    public function show(Request $request, LearningTopic $topic): Response
    {
        $section = $this->topicSection($request->query('section'));
        $purpose = $request->query('purpose');
        $purpose = is_string($purpose)
            && in_array($purpose, ActivityCompetenceConfiguration::LEARNING_INTENTS, true)
            ? $purpose
            : null;
        $timeBudget = $request->query('time');
        $timeBudget = is_numeric($timeBudget)
            && in_array((int) $timeBudget, [15, 30], true)
            ? (int) $timeBudget
            : null;
        $topic = $this->topics->publishedDetail($topic, $request->user());
        $paths = $section === 'routes'
            ? $this->paths->handle(
                $request->user(),
                $topic,
                page: max(1, (int) $request->query('page', 1)),
                purpose: $purpose,
                timeBudget: $timeBudget,
            )
            : null;
        $maps = $section === 'maps'
            ? $this->topics->publishedMaps(
                $topic,
                $request->user(),
                page: max(1, (int) $request->query('maps_page', 1)),
            )
            : null;
        $subtopics = $section === 'overview'
            ? $this->topics->publishedSubtopics(
                $topic,
                $request->user(),
                page: max(1, (int) $request->query('subtopics_page', 1)),
            )
            : null;

        $competenceMap = $section === 'trail'
            ? $this->competenceMap->handle($request->user())
            : ['topics' => [], 'checkIns' => []];
        $activities = $section === 'trail'
            ? $this->topics->publishedActivitiesForTopic($topic, $request->user())
            : collect();
        $topicSlugs = $section === 'trail'
            ? collect($this->topics->publishedDescendantSlugs($topic))
            : collect();
        $competenceTopics = collect($competenceMap['topics'])
            ->filter(function (array $entry) use ($topicSlugs): bool {
                if ($topicSlugs->contains($entry['slug'] ?? null)) {
                    return true;
                }

                return collect($entry['relatedTopics'] ?? [])->contains(
                    fn (mixed $relatedTopic): bool => is_array($relatedTopic)
                        && $topicSlugs->contains($relatedTopic['slug'] ?? null),
                );
            })
            ->values();
        $competence = $competenceTopics->firstWhere('slug', $topic->slug);
        $learningAreas = $this->learningAreas($activities);
        $learningPulse = $this->learningPulse(
            $competenceMap['checkIns'] ?? [],
            $learningAreas,
        );
        $reflectionNarrative = $section === 'trail'
            ? $this->reflectionNarrative->handle(
                $request->user(),
                $topicSlugs->all(),
            )
            : null;

        return Inertia::render('topics/show', [
            'topic' => $this->serializer->detail(
                $topic,
                paths: $paths ? $this->pathSerializer->serialize($paths) : [],
                pathsPagination: $paths['pagination'] ?? $this->emptyPagination(6),
                competence: $competence,
                subtopicCompetence: $competenceTopics
                    ->reject(fn (array $entry): bool => $entry['slug'] === $topic->slug)
                    ->all(),
                learningAreas: $learningAreas,
                learningPulse: $learningPulse,
                reflectionNarrative: $reflectionNarrative,
                loadedSection: $section,
                subtopics: $subtopics
                    ? $this->serializer->subtopics($subtopics->getCollection())
                    : [],
                subtopicsPagination: $subtopics
                    ? [
                        'currentPage' => $subtopics->currentPage(),
                        'lastPage' => max(1, $subtopics->lastPage()),
                        'perPage' => $subtopics->perPage(),
                        'total' => $subtopics->total(),
                    ]
                    : $this->emptyPagination(4),
                maps: $maps ? $this->serializer->maps($maps->getCollection()) : [],
                mapsPagination: $maps
                    ? [
                        'currentPage' => $maps->currentPage(),
                        'lastPage' => max(1, $maps->lastPage()),
                        'perPage' => $maps->perPage(),
                        'total' => $maps->total(),
                    ]
                    : $this->emptyPagination(4),
                pathsPurpose: $paths['purpose'] ?? null,
                pathsTimeBudget: $paths['timeBudget'] ?? null,
            ),
        ]);
    }

    private function topicSection(mixed $section): string
    {
        return is_string($section) && in_array($section, self::TOPIC_SECTIONS, true)
            ? $section
            : 'trail';
    }

    /** @return array{currentPage: int, lastPage: int, perPage: int, total: int} */
    private function emptyPagination(int $perPage): array
    {
        return [
            'currentPage' => 1,
            'lastPage' => 1,
            'perPage' => $perPage,
            'total' => 0,
        ];
    }

    /**
     * @param  Collection<int, LearningActivity>  $activities
     * @return list<array{name: string, slug: string, learningIntents: list<string>}>
     */
    private function learningAreas(Collection $activities): array
    {
        $entries = collect();

        foreach ($activities as $activity) {
            foreach ($this->competenceConfiguration->topicsForActivity($activity) as $area) {
                $entries->push([
                    'name' => $area['topic'],
                    'slug' => $area['slug'],
                    'learningIntent' => $this->competenceConfiguration
                        ->learningIntentForActivity($activity),
                ]);
            }
        }

        return $entries
            ->groupBy('slug')
            ->map(fn ($areaEntries): array => [
                'name' => (string) $areaEntries->first()['name'],
                'slug' => (string) $areaEntries->first()['slug'],
                'learningIntents' => $areaEntries
                    ->pluck('learningIntent')
                    ->unique()
                    ->sort()
                    ->values()
                    ->all(),
            ])
            ->sortBy('name')
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $checkIns
     * @param  list<array{name: string, slug: string, learningIntents: list<string>}>  $learningAreas
     * @return list<array<string, mixed>>
     */
    private function learningPulse(array $checkIns, array $learningAreas): array
    {
        $areaSlugs = collect($learningAreas)->pluck('slug');

        return collect($checkIns)
            ->filter(fn (array $checkIn): bool => collect($checkIn['topics'] ?? [])
                ->contains(fn (mixed $area): bool => is_array($area)
                    && $areaSlugs->contains($area['slug'] ?? null)))
            ->take(4)
            ->values()
            ->all();
    }
}
