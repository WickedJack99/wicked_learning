<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Settings\Actions\UpdateColorPaletteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ColorPaletteController extends Controller
{
    public function __construct(
        private readonly UpdateColorPaletteSettings $updateColorPalette,
    ) {}

    public function edit(Request $request): RedirectResponse
    {
        return to_route('settings.index', [
            'panel' => 'admin-presentation-localization',
            'presentation' => 'palette',
        ]);
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

        return to_route('settings.index', [
            'panel' => 'admin-presentation-localization',
            'presentation' => 'palette',
        ]);
    }
}
