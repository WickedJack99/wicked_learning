<?php

namespace App\Http\Controllers;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadLearnerCompetenceMap;
use App\Learning\Queries\LoadLearningPaths;
use App\Learning\Queries\LoadLearningTopics;
use App\Learning\Serializers\LearningPathSerializer;
use App\Learning\Serializers\LearningTopicSerializer;
use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Models\LearningTopic;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningTopicController extends Controller
{
    public function __construct(
        private readonly LoadLearningTopics $topics,
        private readonly LoadLearningPaths $paths,
        private readonly LoadLearnerCompetenceMap $competenceMap,
        private readonly LearningPathSerializer $pathSerializer,
        private readonly LearningTopicSerializer $serializer,
        private readonly ActivityCompetenceConfiguration $competenceConfiguration,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('topics/index', [
            'areas' => $this->serializer->overview($this->topics->overview($request->user())),
            'canManageTopics' => $request->user()?->hasAccess(
                PermissionCatalog::CONTENT_TOPICS,
                AccessLevel::READ,
            ) ?? false,
        ]);
    }

    public function show(Request $request, LearningTopic $topic): Response
    {
        $competenceMap = $this->competenceMap->handle($request->user());
        $topic = $this->topics->publishedDetail($topic, $request->user());
        $topicSlugs = collect($this->topics->publishedDescendantSlugs($topic));
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
        $learningAreas = $this->learningAreas($topic);

        return Inertia::render('topics/show', [
            'topic' => $this->serializer->detail(
                $topic,
                $this->pathSerializer->serialize(
                    $this->paths->handle($request->user(), $topic),
                ),
                $competence,
                $competenceTopics
                    ->reject(fn (array $entry): bool => $entry['slug'] === $topic->slug)
                    ->all(),
                $learningAreas,
            ),
        ]);
    }

    /** @return list<array{name: string, slug: string, learningIntents: list<string>}> */
    private function learningAreas(LearningTopic $topic): array
    {
        $entries = collect();

        foreach ($topic->maps as $map) {
            foreach ($map->nodes as $node) {
                foreach ($node->activities as $activity) {
                    foreach ($this->competenceConfiguration->topicsForActivity($activity) as $area) {
                        $entries->push([
                            'name' => $area['topic'],
                            'slug' => $area['slug'],
                            'learningIntent' => $this->competenceConfiguration
                                ->learningIntentForActivity($activity),
                        ]);
                    }
                }
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
}
