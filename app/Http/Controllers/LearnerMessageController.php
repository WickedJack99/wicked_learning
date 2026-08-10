<?php

namespace App\Http\Controllers;

use App\Learning\Actions\CreateLearnerMessage;
use App\Learning\Queries\LoadLearnerMessages;
use App\Learning\Services\LearningMapAccessService;
use App\Learning\Services\LearningNodeStateResolver;
use App\Learning\Services\MessageTopicForActivity;
use App\Models\LearningActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearnerMessageController extends Controller
{
    public function __construct(
        private readonly MessageTopicForActivity $topicForActivity,
        private readonly LoadLearnerMessages $messages,
        private readonly CreateLearnerMessage $createMessage,
        private readonly LearningMapAccessService $mapAccess,
        private readonly LearningNodeStateResolver $nodeState,
    ) {}

    public function index(Request $request, LearningActivity $activity): JsonResponse
    {
        $this->authorizeActivity($request, $activity);

        return response()->json(
            $this->messages->handle($this->topicForActivity->resolve($activity), $request->user()),
        );
    }

    public function store(Request $request, LearningActivity $activity): JsonResponse
    {
        $this->authorizeActivity($request, $activity);
        abort_unless($activity->type === 'message_prompt', 404);

        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:280'],
        ]);
        $topic = $this->topicForActivity->resolve($activity);
        $message = $this->createMessage->handle($request->user(), $topic, $data['body']);

        return response()->json([
            ...$this->messages->handle($topic, $request->user()),
            'message' => [
                'id' => $message->id,
                'body' => $message->body,
            ],
        ], $message->wasRecentlyCreated ? 201 : 200);
    }

    private function authorizeActivity(Request $request, LearningActivity $activity): void
    {
        $activity->loadMissing('node.map');
        abort_unless($this->mapAccess->canViewMap($activity->node->map, $request->user()), 404);
        abort_unless($this->nodeState->canPlay($activity->node, $request->user()->id), 404);
    }
}
