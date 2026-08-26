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
        $selectedTopic = $selectedTopicSlug
            ? LearningTopic::query()
                ->where('is_published', true)
                ->where('slug', $selectedTopicSlug)
                ->first()
            : null;

        return Inertia::render('competence/index', [
            'competenceMap' => $this->competenceMap->handle($request->user()),
            'selectedTopic' => $selectedTopic
                ? [
                    'href' => route('topics.show', $selectedTopic, false),
                    'title' => $selectedTopic->title,
                ]
                : null,
            'selectedTopicSlug' => $selectedTopicSlug,
        ]);
    }
}
