<?php

namespace App\Http\Controllers;

use App\Http\Requests\Learning\ShowActiveActivityTranslationRequest;
use App\Localization\Queries\LoadActiveActivityTranslation;
use App\Models\LearningActivity;
use Illuminate\Http\JsonResponse;

class LearningActivityTranslationController extends Controller
{
    public function __construct(private readonly LoadActiveActivityTranslation $translations) {}

    public function show(ShowActiveActivityTranslationRequest $request, LearningActivity $activity): JsonResponse
    {
        $translation = $this->translations->handle(
            $request->user(),
            $activity,
            $request->string('play_run_id')->toString(),
        );

        abort_if($translation === null, 404);

        return response()->json(['translation' => $translation]);
    }
}
