<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\UserPreference;
use App\Support\Appearance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class AppearanceController extends Controller
{
    public function edit(): RedirectResponse
    {
        return to_route('settings.personal.edit', ['section' => 'appearance']);
    }

    public function update(Request $request): Response
    {
        $data = $request->validate([
            'appearance' => ['required', 'string', Rule::in([Appearance::LIGHT, Appearance::DARK])],
        ]);

        UserPreference::query()->updateOrCreate(
            ['user_id' => $request->user()->id],
            ['appearance' => $data['appearance']],
        );

        return response()->noContent()->cookie(
            'appearance',
            $data['appearance'],
            60 * 24 * 365,
            '/',
            null,
            false,
            false,
            false,
            'Lax',
        );
    }
}
