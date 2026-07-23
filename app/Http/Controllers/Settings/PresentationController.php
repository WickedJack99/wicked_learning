<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\PlatformPresentationSetting;
use App\Settings\Services\PresentationImageUploadService;
use App\Settings\Validation\PresentationRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PresentationController extends Controller
{
    public function __construct(
        private readonly PresentationRules $rules,
        private readonly PresentationImageUploadService $imageUploadService,
    ) {}

    public function edit(): RedirectResponse
    {
        return to_route('settings.index', [
            'panel' => 'admin-presentation-localization',
            'presentation' => 'public',
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate($this->rules->update());

        PlatformPresentationSetting::updateCurrent($data, $request->user());

        return to_route('settings.index', [
            'panel' => 'admin-presentation-localization',
            'presentation' => 'public',
        ]);
    }

    public function uploadBackgroundImage(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->backgroundImageUpload());

        return response()->json([
            'url' => $this->imageUploadService->upload($data['image'] ?? null),
        ]);
    }
}
