<?php

namespace App\Http\Controllers;

use App\Learning\Actions\SendLearningGroupMessage;
use App\Learning\Actions\VoteForLearningGroupAdminChatAccess;
use App\Learning\Queries\LoadLearnerGroups;
use App\Learning\Serializers\LearningGroupSerializer;
use App\Models\LearningGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningGroupController extends Controller
{
    public function __construct(
        private readonly LoadLearnerGroups $groups,
        private readonly LearningGroupSerializer $serializer,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'groups' => $this->groups
                ->handle($request->user())
                ->map(fn (LearningGroup $group): array => $this->serializer->forLearner($group, $request->user()))
                ->values()
                ->all(),
        ]);
    }

    public function storeMessage(
        Request $request,
        LearningGroup $group,
        SendLearningGroupMessage $sendMessage,
    ): JsonResponse {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $sendMessage->handle($group, $request->user(), (string) $data['body']);

        return $this->showForLearner($group, $request);
    }

    public function voteForAdminChatAccess(
        Request $request,
        LearningGroup $group,
        VoteForLearningGroupAdminChatAccess $vote,
    ): JsonResponse {
        $vote->handle($group, $request->user());

        return $this->showForLearner($group, $request);
    }

    private function showForLearner(LearningGroup $group, Request $request): JsonResponse
    {
        return response()->json([
            'group' => $this->serializer->forLearner($group->refresh(), $request->user()),
        ]);
    }
}
