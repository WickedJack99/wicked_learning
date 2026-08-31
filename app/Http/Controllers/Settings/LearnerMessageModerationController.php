<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\RespondToLearnerSupportRequest;
use App\Learning\Queries\LoadLearnerMessageModeration;
use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\LearningMessageTopic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LearnerMessageModerationController extends Controller
{
    public function __construct(
        private readonly LoadLearnerMessageModeration $moderation,
        private readonly RespondToLearnerSupportRequest $respondToSupportRequest,
    ) {}

    public function messages(Request $request, LearningMessageTopic $topic): JsonResponse
    {
        abort_unless($topic->messages()->exists(), 404);

        $data = $request->validate([
            'filter' => ['nullable', 'string', 'in:all,helpful,unconfirmed'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        return response()->json($this->moderation->messages(
            $topic,
            (int) ($data['page'] ?? 1),
            (int) ($data['per_page'] ?? 6),
            (string) ($data['filter'] ?? 'all'),
        ));
    }

    public function responses(Request $request, LearnerMessage $message): JsonResponse
    {
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        return response()->json($this->moderation->responses(
            $message,
            (int) ($data['page'] ?? 1),
            (int) ($data['per_page'] ?? 3),
        ));
    }

    public function respondToSupport(Request $request, LearnerMessage $message): JsonResponse
    {
        abort_unless($message->audience === 'support', 404);

        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:280'],
        ]);
        $response = $this->respondToSupportRequest->handle(
            $request->user(),
            $message,
            $data['body'],
        );

        return response()->json([
            'response' => [
                'body' => $response->body,
                'id' => $response->id,
            ],
        ], $response->wasRecentlyCreated ? 201 : 200);
    }

    public function updateVisibility(Request $request, LearnerMessage $message): RedirectResponse
    {
        $data = $request->validate(['hidden' => ['required', 'boolean']]);

        $message->forceFill([
            'hidden_at' => $data['hidden'] ? now() : null,
            'hidden_by_user_id' => $data['hidden'] ? $request->user()->id : null,
        ])->save();

        return back();
    }

    public function destroy(LearnerMessage $message): RedirectResponse
    {
        $message->delete();

        return back();
    }

    public function updateResponseVisibility(Request $request, LearnerMessageResponse $response): RedirectResponse
    {
        $data = $request->validate(['hidden' => ['required', 'boolean']]);

        $response->forceFill([
            'hidden_at' => $data['hidden'] ? now() : null,
            'hidden_by_user_id' => $data['hidden'] ? $request->user()->id : null,
        ])->save();

        return back();
    }

    public function destroyResponse(LearnerMessageResponse $response): RedirectResponse
    {
        $response->delete();

        return back();
    }
}
