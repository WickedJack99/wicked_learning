<?php

namespace App\Http\Controllers;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadLearningTopics;
use App\Learning\Serializers\LearningTopicSerializer;
use App\Models\LearningTopic;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningTopicController extends Controller
{
    public function __construct(
        private readonly LoadLearningTopics $topics,
        private readonly LearningTopicSerializer $serializer,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('topics/index', [
            'areas' => $this->serializer->overview($this->topics->overview()),
            'canManageTopics' => $request->user()?->hasAccess(
                PermissionCatalog::CONTENT_TOPICS,
                AccessLevel::READ,
            ) ?? false,
        ]);
    }

    public function show(LearningTopic $topic): Response
    {
        return Inertia::render('topics/show', [
            'topic' => $this->serializer->detail(
                $this->topics->publishedDetail($topic),
            ),
        ]);
    }
}
