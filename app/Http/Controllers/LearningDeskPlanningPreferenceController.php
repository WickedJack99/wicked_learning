<?php

namespace App\Http\Controllers;

use App\Http\Requests\Learning\UpdateLearningDeskPlanningPreferenceRequest;
use App\Learning\Actions\UpdateLearningDeskPlanningPreference;
use Illuminate\Http\RedirectResponse;

class LearningDeskPlanningPreferenceController extends Controller
{
    public function update(
        UpdateLearningDeskPlanningPreferenceRequest $request,
        UpdateLearningDeskPlanningPreference $updatePlanningPreference,
    ): RedirectResponse {
        $updatePlanningPreference->handle($request->user(), $request->validated());

        return back();
    }
}
