<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Services\ReusableMediaAssetManager;
use App\Models\PlatformCompanionSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AdminCompanionController extends Controller
{
    public function __construct(
        private readonly ReusableMediaAssetManager $mediaAssetManager,
    ) {}

    public function uploadAvatar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);

        return response()->json(
            $this->mediaAssetManager->upload($data['file'] ?? null),
        );
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'display_name' => ['required', 'string', 'max:80'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
            'avatar_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'welcome_message' => ['required', 'string', 'max:1200'],
        ]);

        $setting = PlatformCompanionSetting::current();
        $companionConfig = is_array($setting->companion_config)
            ? $setting->companion_config
            : [];

        if (array_key_exists('avatar_color', $data) && $data['avatar_color'] !== null) {
            $companionConfig['avatar_color'] = $data['avatar_color'];
        }

        $setting->forceFill([
            'enabled' => (bool) $data['enabled'],
            'display_name' => trim((string) $data['display_name']),
            'avatar_url' => trim((string) ($data['avatar_url'] ?? '')) ?: null,
            'welcome_message' => trim((string) $data['welcome_message']),
            'companion_config' => $companionConfig,
            'updated_by_user_id' => $request->user()->id,
        ])->save();

        return to_route('settings.index', ['panel' => 'admin-learning-companion']);
    }
}
