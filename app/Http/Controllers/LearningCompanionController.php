<?php

namespace App\Http\Controllers;

use App\Http\Requests\LearningCompanionTurnRequest;
use App\Learning\Services\LearningCompanionTurnService;
use Illuminate\Http\JsonResponse;

class LearningCompanionController extends Controller
{
    public function turn(
        LearningCompanionTurnRequest $request,
        LearningCompanionTurnService $turnService,
    ): JsonResponse {
        return response()->json(
            $turnService->handle($request->user(), $request->validatedForTurn()),
        );
    }
}
