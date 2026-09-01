<?php

namespace App\Http\Controllers;

use App\Models\PlatformFeedback;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PlatformFeedbackController extends Controller
{
    public function show(Request $request): Response
    {
        return Inertia::render('feedback', [
            'submitted' => $request->session()->pull('platform_feedback_submitted', false),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'category' => ['required', 'in:general,idea,problem,praise'],
            'message' => ['required', 'string', 'min:10', 'max:4000'],
        ]);

        PlatformFeedback::query()->create([
            'category' => $data['category'],
            'message' => $data['message'],
            'submitted_at' => now(),
            'user_id' => $request->user()->id,
        ]);

        return to_route('feedback.index')->with('platform_feedback_submitted', true);
    }
}
