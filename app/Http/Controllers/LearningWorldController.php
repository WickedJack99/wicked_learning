<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearningWorld;
use App\Learning\Queries\LoadPlayableNode;
use App\Learning\Queries\SearchLearningWorld;
use App\Learning\Serializers\LearnerProgressSerializer;
use App\Learning\Serializers\LearningNodeSerializer;
use App\Learning\Serializers\LearningToolSerializer;
use App\Learning\Serializers\LearningWorldSerializer;
use App\Learning\Services\LearnerProgressService;
use App\Learning\Services\LearningBookmarkService;
use App\Learning\Services\LearningToolGrantService;
use App\Learning\Services\NpcDialogueAnswerService;
use App\Learning\Services\ObstacleToolService;
use App\Learning\Services\QuestionAnswerService;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\LearningQuestion;
use App\Models\NpcDialogueNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningWorldController extends Controller
{
    public function __construct(
        private readonly LoadLearningWorld $loadLearningWorld,
        private readonly LoadPlayableNode $loadPlayableNode,
        private readonly SearchLearningWorld $searchLearningWorld,
        private readonly LearningWorldSerializer $worldSerializer,
        private readonly LearningNodeSerializer $nodeSerializer,
        private readonly LearningToolSerializer $toolSerializer,
        private readonly LearnerProgressSerializer $progressSerializer,
        private readonly LearnerProgressService $progressService,
        private readonly QuestionAnswerService $questionAnswerService,
        private readonly NpcDialogueAnswerService $npcDialogueAnswerService,
        private readonly ObstacleToolService $obstacleToolService,
        private readonly LearningToolGrantService $toolGrantService,
        private readonly LearningBookmarkService $bookmarkService,
    ) {}

    public function show(Request $request): Response
    {
        $userId = $request->user()->id;
        $world = $this->loadLearningWorld->forMapView();

        return Inertia::render('world', [
            'bookmarkedNodeIds' => $this->bookmarkService->bookmarkedNodeIds($userId),
            'world' => $world ? $this->worldSerializer->serialize($world) : null,
            'progress' => $this->progressSerializer->forUser($userId),
        ]);
    }

    public function play(Request $request, LearningNode $node): Response
    {
        $userId = $request->user()->id;

        return Inertia::render('learning/node-play', [
            'node' => $this->nodeSerializer->serialize($this->loadPlayableNode->handle($node)),
            'progress' => $this->progressSerializer->forUser($userId),
        ]);
    }

    public function markActivity(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:reached,completed'],
        ]);

        $progress = $this->progressService->mark(
            $request->user()->id,
            $activity,
            (string) $data['status'],
        );

        return response()->json([
            'progress' => $this->progressSerializer->activityProgress($progress),
        ]);
    }

    public function answerQuestion(Request $request, LearningQuestion $question): JsonResponse
    {
        $data = $request->validate([
            'option_id' => ['required', 'integer'],
        ]);

        return response()->json([
            'answer' => $this->questionAnswerService->answer(
                $request->user()->id,
                $question,
                (int) $data['option_id'],
            ),
        ]);
    }

    public function answerNpcDialogue(Request $request, NpcDialogueNode $node): JsonResponse
    {
        $data = $request->validate([
            'answer_key' => ['required', 'string', 'max:80'],
        ]);

        return response()->json([
            'answer' => $this->npcDialogueAnswerService->answer(
                $request->user()->id,
                $node,
                (string) $data['answer_key'],
            ),
        ]);
    }

    public function useObstacleTool(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'tool_id' => ['required', 'integer'],
        ]);

        return response()->json([
            'result' => $this->obstacleToolService->useTool(
                $request->user(),
                $activity,
                (int) $data['tool_id'],
            ),
        ]);
    }

    public function grantActivityTool(Request $request, LearningActivity $activity): JsonResponse
    {
        return response()->json([
            'tool' => $this->toolSerializer->serialize(
                $this->toolGrantService->grantFromActivity($request->user(), $activity),
            ),
        ]);
    }

    public function grantNpcDialogueTool(Request $request, NpcDialogueNode $node): JsonResponse
    {
        return response()->json([
            'tool' => $this->toolSerializer->serialize(
                $this->toolGrantService->grantFromNpcDialogueNode($request->user(), $node),
            ),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'query' => ['required', 'string', 'min:1', 'max:80'],
        ]);

        return response()->json([
            'results' => $this->searchLearningWorld->handle((string) $data['query']),
        ]);
    }
}
