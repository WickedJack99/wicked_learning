<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Services\ReusableMediaAssetManager;
use App\Learning\Validation\LearningCompanionDialogueGraphValidator;
use App\Models\PlatformCompanionSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminCompanionController extends Controller
{
    public function __construct(
        private readonly ReusableMediaAssetManager $mediaAssetManager,
        private readonly LearningCompanionDialogueGraphValidator $graphValidator,
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
            'avatar_position_x' => ['sometimes', 'integer', 'between:0,100'],
            'avatar_position_y' => ['sometimes', 'integer', 'between:0,100'],
            'avatar_scale' => ['sometimes', 'integer', 'between:80,200'],
            'welcome_message' => ['required', 'string', 'max:1200'],
            'mode' => ['sometimes', 'string', Rule::in(['scripted', 'guided_ai', 'open_ai'])],
            'ai_enabled' => ['sometimes', 'boolean'],
            'ai_template_id' => [
                'nullable',
                'integer',
                Rule::exists('ai_agent_templates', 'id')->where(
                    fn ($query) => $query->where('purpose', 'learner_companion'),
                ),
            ],
            'ai_capabilities' => ['array', 'max:3'],
            'ai_capabilities.*' => ['string', Rule::in($this->graphValidator->aiCapabilities())],
        ]);

        $setting = PlatformCompanionSetting::current();
        $companionConfig = is_array($setting->companion_config)
            ? $setting->companion_config
            : [];

        if (array_key_exists('avatar_color', $data) && $data['avatar_color'] !== null) {
            $companionConfig['avatar_color'] = $data['avatar_color'];
        }

        foreach (['avatar_position_x', 'avatar_position_y', 'avatar_scale'] as $key) {
            if (array_key_exists($key, $data)) {
                $companionConfig[$key] = (int) $data[$key];
            }
        }

        $existingAi = is_array($companionConfig['ai'] ?? null) ? $companionConfig['ai'] : [];
        $existingCapabilities = is_array($existingAi['capabilities'] ?? null)
            ? $existingAi['capabilities']
            : [];
        $companionConfig['mode'] = $data['mode'] ?? ($companionConfig['mode'] ?? 'scripted');
        $companionConfig['ai'] = [
            'enabled' => array_key_exists('ai_enabled', $data)
                ? (bool) $data['ai_enabled']
                : (bool) ($existingAi['enabled'] ?? false),
            'template_id' => array_key_exists('ai_template_id', $data)
                ? ($data['ai_template_id'] !== null ? (int) $data['ai_template_id'] : null)
                : ($existingAi['template_id'] ?? null),
            'capabilities' => array_key_exists('ai_capabilities', $data)
                ? array_values($data['ai_capabilities'] ?? [])
                : array_values($existingCapabilities),
        ];

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
