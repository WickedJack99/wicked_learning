<?php

namespace App\Http\Controllers;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadLearnerCompetenceMap;
use App\Learning\Queries\LoadLearningPaths;
use App\Learning\Queries\LoadLearningTopics;
use App\Learning\Serializers\LearningPathSerializer;
use App\Learning\Serializers\LearningTopicSerializer;
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
        $topicSlugs = $this->topics->publishedDescendantSlugs($topic);
        $competenceTopics = collect($competenceMap['topics'])
            ->whereIn('slug', $topicSlugs)
            ->values();
        $competence = $competenceTopics->firstWhere('slug', $topic->slug);

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
            ),
        ]);
    }
}
