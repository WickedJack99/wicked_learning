<?php

namespace App\Http\Controllers;

use App\Http\Requests\Learning\ShowActiveActivityTranslationRequest;
use App\Learning\Services\LearnerActivityAccessService;
use App\Localization\Queries\LoadActiveActivityTranslation;
use App\Models\LearningActivity;
use Illuminate\Http\JsonResponse;

class LearningActivityTranslationController extends Controller
{
    public function __construct(
        private readonly LoadActiveActivityTranslation $translations,
        private readonly LearnerActivityAccessService $activityAccess,
    ) {}

    public function show(ShowActiveActivityTranslationRequest $request, LearningActivity $activity): JsonResponse
    {
        $playRunId = $request->string('play_run_id')->toString();

        $this->activityAccess->assertActive($request->user(), $activity, $playRunId);

        $translation = $this->translations->handle(
            $request->user(),
            $activity,
            $playRunId,
        );

        return response()->json(['translation' => $translation]);
    }
}
