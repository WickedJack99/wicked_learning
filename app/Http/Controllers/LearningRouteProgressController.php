<?php

namespace App\Http\Controllers;

use App\Learning\Services\LearnerRouteProgressService;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivityStart;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningRouteProgressController extends Controller
{
    public function __construct(private readonly LearnerRouteProgressService $routeProgress) {}

    public function restart(Request $request, LearningActivityStart $start): JsonResponse
    {
        $progress = $this->routeProgress->restartSameRun($request->user(), $start);

        return response()->json([
            'url' => $this->playUrl($progress),
        ]);
    }

    public function reset(Request $request, LearningActivityStart $start): JsonResponse
    {
        $progress = $this->routeProgress->resetWithNewRun($request->user(), $start);

        return response()->json([
            'url' => $this->playUrl($progress),
        ]);
    }

    private function playUrl(LearnerRouteProgress $progress): string
    {
        return route('learning.nodes.play', [
            'node' => $progress->learning_node_id,
        ], false);
    }
}
