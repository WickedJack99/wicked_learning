<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\UpdateJournalSettings;
use App\Settings\Services\PresentationImageUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Orchestrates the small, platform-wide journal feedback policy. */
class JournalSettingsController extends Controller
{
    public function __construct(
        private readonly UpdateJournalSettings $updateSetting,
        private readonly PresentationImageUploadService $imageUpload,
    ) {}

    public function edit(): RedirectResponse
    {
        return $this->redirectToJournal();
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'allow_expert_access_requests' => ['required', 'boolean'],
            ...$this->themeRules(),
        ]);

        $this->updateSetting->handle($request->user(), $data);

        return $this->redirectToJournal();
    }

    public function uploadBackgroundImage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'file', 'max:5120'],
        ]);

        return response()->json([
            'url' => $this->imageUpload->upload($data['image'] ?? null),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function themeRules(): array
    {
        $rules = [];

        foreach (['dark', 'light'] as $mode) {
            $rules["theme.{$mode}.backgroundImage"] = ['nullable', 'string', 'max:2048'];
            $rules["theme.{$mode}.backgroundPositionX"] = ['nullable', 'numeric', 'between:0,100'];
            $rules["theme.{$mode}.backgroundPositionY"] = ['nullable', 'numeric', 'between:0,100'];
            $rules["theme.{$mode}.backgroundZoom"] = ['nullable', 'numeric', 'between:25,300'];
            $rules["theme.{$mode}.backgroundAssets"] = ['nullable', 'array', 'max:12'];
            $rules["theme.{$mode}.backgroundAssets.*.id"] = ['required', 'string', 'max:64'];
            $rules["theme.{$mode}.backgroundAssets.*.image"] = ['nullable', 'string', 'max:2048'];
            $rules["theme.{$mode}.backgroundAssets.*.positionX"] = ['nullable', 'numeric', 'between:0,100'];
            $rules["theme.{$mode}.backgroundAssets.*.positionY"] = ['nullable', 'numeric', 'between:0,100'];
            $rules["theme.{$mode}.backgroundAssets.*.zoom"] = ['nullable', 'numeric', 'between:25,300'];

            foreach ($this->themeColorFields() as $field) {
                $rules["theme.{$mode}.{$field}"] = ['nullable', 'string', 'max:64'];
                $rules["theme.{$mode}.{$field}Opacity"] = ['nullable', 'integer', 'min:0', 'max:100'];
            }
        }

        return $rules;
    }

    /**
     * @return list<string>
     */
    private function themeColorFields(): array
    {
        return [
            'backgroundOverlay',
            'panelBackground',
            'panelBorder',
            'headerBackground',
            'sidebarBackground',
            'contentBackground',
            'inputBackground',
            'headingText',
            'bodyText',
            'mutedText',
            'accent',
            'accentText',
            'buttonBackground',
            'buttonText',
            'buttonBorder',
            'selectedBackground',
            'selectedBorder',
            'selectedText',
        ];
    }

    private function redirectToJournal(): RedirectResponse
    {
        return to_route('settings.index', [
            'panel' => 'admin-learning-support',
            'support' => 'journal',
        ]);
    }
}
