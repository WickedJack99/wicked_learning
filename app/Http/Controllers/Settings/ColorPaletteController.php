<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Settings\Actions\UpdateColorPaletteSettings;
use App\Settings\Queries\LoadColorPaletteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ColorPaletteController extends Controller
{
    public function __construct(
        private readonly LoadColorPaletteSettings $loadColorPalette,
        private readonly UpdateColorPaletteSettings $updateColorPalette,
    ) {}

    public function edit(Request $request): Response
    {
        return Inertia::render(
            'settings/color-palette',
            $this->loadColorPalette->handle($request->user()),
        );
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'journalTheme' => ['nullable', 'array'],
            'mapBackgroundConfigs' => ['nullable', 'array'],
            'mapBackgroundConfigs.*.backgroundConfig' => ['nullable', 'array'],
            'mapBackgroundConfigs.*.id' => ['required_with:mapBackgroundConfigs', 'integer'],
            'publicPresentation' => ['nullable', 'array'],
        ]);

        $this->updateColorPalette->handle($request->user(), $data);

        return redirect()->route('settings.color-palette.edit');
    }
}
