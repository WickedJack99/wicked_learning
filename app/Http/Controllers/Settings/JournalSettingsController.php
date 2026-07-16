<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\UpdateJournalSettings;
use App\Learning\Serializers\PlatformJournalSettingsSerializer;
use App\Models\PlatformJournalSetting;
use App\Settings\Services\PresentationImageUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Orchestrates the small, platform-wide journal feedback policy. */
class JournalSettingsController extends Controller
{
    public function __construct(
        private readonly UpdateJournalSettings $updateSetting,
        private readonly PlatformJournalSettingsSerializer $serializer,
        private readonly PresentationImageUploadService $imageUpload,
    ) {}

    public function edit(): Response
    {
        return Inertia::render('settings/journal', $this->serializer->serialize(PlatformJournalSetting::current()));
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'allow_expert_access_requests' => ['required', 'boolean'],
            ...$this->themeRules(),
        ]);

        $this->updateSetting->handle($request->user(), $data);

        return redirect()->route('settings.journal.edit');
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
}
