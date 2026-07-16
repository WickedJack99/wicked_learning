<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateLocalePreferenceRequest;
use App\Localization\Actions\UpdateUserLocalePreference;
use Illuminate\Http\RedirectResponse;

class LanguageController extends Controller
{
    public function __construct(
        private readonly UpdateUserLocalePreference $updatePreference,
    ) {}

    public function edit(): RedirectResponse
    {
        return to_route('settings.personal.edit', ['section' => 'language']);
    }

    public function update(UpdateLocalePreferenceRequest $request): RedirectResponse
    {
        $this->updatePreference->handle($request->user(), $request->string('locale')->toString());

        return to_route('settings.personal.edit', ['section' => 'language']);
    }
}
