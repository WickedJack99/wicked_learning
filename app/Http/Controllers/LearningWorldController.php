<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearningWorld;
use App\Learning\Queries\LoadPlayableNode;
use App\Learning\Queries\SearchLearningWorld;
use App\Learning\Serializers\LearnerProgressSerializer;
use App\Learning\Serializers\LearningNodeSerializer;
use App\Learning\Serializers\LearningToolSerializer;
use App\Learning\Serializers\LearningWorldSerializer;
use App\Learning\Services\LearnerActivityPlayStateService;
use App\Learning\Services\LearnerMapLocationService;
use App\Learning\Services\LearnerProgressService;
use App\Learning\Services\LearnerRouteProgressService;
use App\Learning\Services\LearningBookmarkService;
use App\Learning\Services\LearningPlayRunService;
use App\Learning\Services\LearningToolGrantService;
use App\Learning\Services\NodeRevealService;
use App\Learning\Services\NodeUnlockService;
use App\Learning\Services\NpcDialogueAnswerService;
use App\Learning\Services\ObstacleToolService;
use App\Learning\Services\QuestionAnswerService;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningQuestion;
use App\Models\NpcDialogueNode;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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
        private readonly LearnerActivityPlayStateService $activityPlayStateService,
        private readonly LearnerMapLocationService $mapLocationService,
        private readonly LearnerProgressSerializer $progressSerializer,
        private readonly LearnerProgressService $progressService,
        private readonly LearnerRouteProgressService $routeProgressService,
        private readonly LearningPlayRunService $playRunService,
        private readonly QuestionAnswerService $questionAnswerService,
        private readonly NpcDialogueAnswerService $npcDialogueAnswerService,
        private readonly ObstacleToolService $obstacleToolService,
        private readonly LearningToolGrantService $toolGrantService,
        private readonly LearningBookmarkService $bookmarkService,
        private readonly NodeRevealService $nodeRevealService,
        private readonly NodeUnlockService $nodeUnlockService,
    ) {}

    public function show(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $world = $this->loadLearningWorld->forMapView($user);

        if ($user && $world) {
            $redirect = $this->syncMapLocation($request, $user, $world->maps);

            if ($redirect) {
                return $redirect;
            }
        }

        return Inertia::render('world', [
            'bookmarkedNodeIds' => $user ? $this->bookmarkService->bookmarkedNodeIds($user->id) : [],
            'world' => $world ? $this->worldSerializer->serialize($world, $user) : null,
            'progress' => $user
                ? $this->progressSerializer->forUser($user->id)
                : $this->progressSerializer->empty(),
        ]);
    }

    public function play(Request $request, LearningNode $node): Response|RedirectResponse
    {
        $user = $request->user();
        $route = $user ? $this->routeFromRequest($request, $node) : null;
        $playRunId = $user ? $this->playRunService->currentRunId($request, $node) : null;
        $runProgress = $user
            ? $this->progressForPlayRequest($request, $node, $playRunId)
            : null;

        if ($user && $route && ! $playRunId) {
            $progress = $this->routeProgressService->startOrResume($user, $route);

            return redirect()->route('learning.nodes.play', ['node' => $progress->learning_node_id]);
        }

        if ($user && $runProgress) {
            $route ??= $runProgress->activityStart;
            $playRunId = $runProgress->current_play_run_id;

            if ($this->hasPlayStateQuery($request)) {
                return redirect()->route('learning.nodes.play', ['node' => $node]);
            }
        }

        $playableNode = $this->loadPlayableNode->handle($node, $user);

        if ($user) {
            $this->mapLocationService->record($user, $playableNode->map);
        }

        return Inertia::render('learning/node-play', [
            'node' => $this->nodeSerializer->serialize($playableNode, $user),
            'playActivityId' => $runProgress?->current_learning_activity_id,
            'playRouteId' => $route?->id,
            'playRunId' => $playRunId,
            'playState' => $this->activityPlayStateService->activityStatesForRun($runProgress),
            'progress' => $user
                ? $this->progressSerializer->forUser($user->id)
                : $this->progressSerializer->empty(),
        ]);
    }

    /**
     * @param  Collection<int, LearningMap>  $visibleMaps
     */
    private function syncMapLocation(Request $request, User $user, Collection $visibleMaps): ?RedirectResponse
    {
        $requestedMap = $this->mapLocationService->mapFromRequest(
            is_string($request->query('map')) ? $request->query('map') : null,
            $visibleMaps,
        );

        if ($requestedMap) {
            $this->mapLocationService->record($user, $requestedMap);

            return null;
        }

        if ($request->query->has('map')) {
            return null;
        }

        $preferredMap = $this->mapLocationService->preferredMap($user, $visibleMaps);

        if ($preferredMap) {
            $firstVisibleMap = $visibleMaps->first();

            if ($firstVisibleMap && $preferredMap->isNot($firstVisibleMap)) {
                return redirect()->route('world', [
                    ...$request->query(),
                    'map' => $preferredMap->slug,
                ]);
            }

            return null;
        }

        $firstVisibleMap = $visibleMaps->first();

        if ($firstVisibleMap) {
            $this->mapLocationService->record($user, $firstVisibleMap);
        }

        return null;
    }

    public function markActivity(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'play_run_id' => ['nullable', 'string', 'uuid'],
            'status' => ['required', 'string', 'in:reached,completed'],
        ]);

        $progress = $this->progressService->mark(
            $request->user()->id,
            $activity,
            (string) $data['status'],
            is_string($data['play_run_id'] ?? null) ? (string) $data['play_run_id'] : null,
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

    public function updateNpcDialogueState(Request $request, LearningActivity $activity): JsonResponse
    {
        abort_unless($activity->type === 'npc_dialogue', 404);

        $data = $request->validate([
            'current_node_id' => ['nullable', 'integer'],
            'history' => ['nullable', 'array', 'max:40'],
            'history.*' => ['integer'],
            'play_run_id' => ['required', 'string', 'uuid'],
        ]);

        return response()->json([
            'state' => $this->activityPlayStateService->updateNpcDialogueState(
                $request->user(),
                $activity,
                (string) $data['play_run_id'],
                isset($data['current_node_id']) ? (int) $data['current_node_id'] : null,
                array_map('intval', $data['history'] ?? []),
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

    public function revealNodeWithTool(Request $request, LearningNode $node): JsonResponse
    {
        $data = $request->validate([
            'tool_id' => ['required', 'integer'],
        ]);

        return response()->json([
            'result' => $this->nodeRevealService->useTool(
                $request->user(),
                $node,
                (int) $data['tool_id'],
            ),
        ]);
    }

    public function unlockNodeWithTool(Request $request, LearningNode $node): JsonResponse
    {
        $data = $request->validate([
            'tool_id' => ['required', 'integer'],
        ]);

        return response()->json([
            'result' => $this->nodeUnlockService->useTool(
                $request->user(),
                $node,
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
            'results' => $this->searchLearningWorld->handle((string) $data['query'], $request->user()),
        ]);
    }

    private function routeFromRequest(Request $request, LearningNode $node): ?LearningActivityStart
    {
        $routeId = $request->query('route');

        if (is_numeric($routeId)) {
            return $node->activityStarts()
                ->whereKey((int) $routeId)
                ->first();
        }

        $activityId = $request->query('activity');

        if (! is_numeric($activityId)) {
            return null;
        }

        return $node->activityStarts()
            ->where('learning_activity_id', (int) $activityId)
            ->first();
    }

    private function progressForPlayRequest(
        Request $request,
        LearningNode $node,
        ?string $playRunId,
    ): ?LearnerRouteProgress {
        if (! $request->user()) {
            return null;
        }

        if ($playRunId) {
            return $this->routeProgressService->progressForNodeRun($request->user(), $node->id, $playRunId);
        }

        return $this->routeProgressService->progressForNode($request->user(), $node->id);
    }

    private function hasPlayStateQuery(Request $request): bool
    {
        return $request->query->has('activity')
            || $request->query->has('route')
            || $request->query->has('run');
    }
}
