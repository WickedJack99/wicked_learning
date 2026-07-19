<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateSoundPreferenceRequest;
use App\Settings\Actions\UpdateSoundPreferences;
use Illuminate\Http\RedirectResponse;

class SoundPreferenceController extends Controller
{
    public function update(
        UpdateSoundPreferenceRequest $request,
        UpdateSoundPreferences $updateSoundPreferences,
    ): RedirectResponse {
        $updateSoundPreferences->handle($request->user(), $request->validated());

        return back();
    }
}
