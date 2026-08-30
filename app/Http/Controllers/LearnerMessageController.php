<?php

namespace App\Http\Controllers;

use App\Learning\Actions\CreateLearnerMessage;
use App\Learning\Actions\CreateLearnerMessageResponse;
use App\Learning\Queries\LoadLearnerMessages;
use App\Learning\Services\LearnerActivityAccessService;
use App\Learning\Services\MessageActivityConfiguration;
use App\Learning\Services\MessageTopicForActivity;
use App\Models\LearnerMessage;
use App\Models\LearningActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearnerMessageController extends Controller
{
    public function __construct(
        private readonly MessageTopicForActivity $topicForActivity,
        private readonly LoadLearnerMessages $messages,
        private readonly CreateLearnerMessage $createMessage,
        private readonly CreateLearnerMessageResponse $createResponse,
        private readonly MessageActivityConfiguration $messageConfiguration,
        private readonly LearnerActivityAccessService $activityAccess,
    ) {}

    public function index(Request $request, LearningActivity $activity): JsonResponse
    {
        $this->authorizeActivity($request, $activity);

        $audience = $this->messageConfiguration->audienceFor($activity);
        $allowResponses = $this->messageConfiguration->allowsResponsesFor($activity);

        return response()->json(
            $this->messages->handle($this->topicForActivity->resolve($activity), $request->user(), $audience, $allowResponses),
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
        $audience = $this->messageConfiguration->audienceFor($activity);
        $message = $this->createMessage->handle($request->user(), $topic, $data['body'], $audience);

        return response()->json([
            ...$this->messages->handle($topic, $request->user(), $audience),
            'message' => [
                'id' => $message->id,
                'body' => $message->body,
            ],
        ], $message->wasRecentlyCreated ? 201 : 200);
    }

    public function respond(Request $request, LearningActivity $activity, LearnerMessage $message): JsonResponse
    {
        $this->authorizeActivity($request, $activity);
        abort_unless($this->messageConfiguration->allowsResponsesFor($activity), 404);

        $topic = $this->topicForActivity->resolve($activity);
        abort_unless($message->learning_message_topic_id === $topic->id, 404);
        abort_unless($message->audience === 'peers' && $message->hidden_at === null, 404);
        abort_unless($message->user_id !== $request->user()->id, 422);

        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:280'],
            'response_type' => ['nullable', 'string', 'in:explanation,example,question,counterexample'],
        ]);
        $response = $this->createResponse->handle(
            $request->user(),
            $message,
            $data['body'],
            $data['response_type'] ?? null,
        );

        return response()->json([
            ...$this->messages->handle($topic, $request->user(), 'peers', true),
            'response' => [
                'body' => $response->body,
                'id' => $response->id,
                'responseType' => $response->response_type,
            ],
        ], $response->wasRecentlyCreated ? 201 : 200);
    }

    private function authorizeActivity(Request $request, LearningActivity $activity): void
    {
        $this->activityAccess->assertCanPlay($request->user(), $activity);
    }
}
