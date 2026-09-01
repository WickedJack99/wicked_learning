<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Settings\Services\PlatformFeedbackPrompt;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PlatformFeedbackPromptController extends Controller
{
    public function update(Request $request, PlatformFeedbackPrompt $prompt): RedirectResponse
    {
        $data = $request->validate([
            'action' => ['required', 'in:enable,decline,dismiss'],
        ]);

        $prompt->update($request->user(), $data['action']);

        return back();
    }
}
