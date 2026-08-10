<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\LearnerMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LearnerMessageModerationController extends Controller
{
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
}
