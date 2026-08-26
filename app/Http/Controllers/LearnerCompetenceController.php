<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearnerCompetenceMap;
use App\Models\LearningTopic;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearnerCompetenceController extends Controller
{
    public function __construct(private readonly LoadLearnerCompetenceMap $competenceMap) {}

    public function index(Request $request): Response
    {
        $selectedTopicSlug = $request->string('topic')->trim()->toString() ?: null;
        $originTopicSlug = $request->string('from')->trim()->toString() ?: null;
        $selectedTopic = $selectedTopicSlug
            ? LearningTopic::query()
                ->where('is_published', true)
                ->where('slug', $selectedTopicSlug)
                ->first()
            : null;
        $originTopic = $originTopicSlug
            ? LearningTopic::query()
                ->where('is_published', true)
                ->where('slug', $originTopicSlug)
                ->first()
            : null;
        $topicContext = $originTopic ?? $selectedTopic;

        return Inertia::render('competence/index', [
            'competenceMap' => $this->competenceMap->handle($request->user()),
            'selectedTopic' => $topicContext
                ? [
                    'href' => route('topics.show', $topicContext, false),
                    'title' => $topicContext->title,
                ]
                : null,
            'selectedTopicSlug' => $selectedTopicSlug,
        ]);
    }
}
