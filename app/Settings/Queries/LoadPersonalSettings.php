<?php

namespace App\Settings\Queries;

use App\Localization\Services\PlatformLocaleCatalog;
use App\Localization\Services\UserLocaleResolver;
use App\Models\User;
use App\Settings\Serializers\SoundPreferenceSerializer;
use App\Settings\Services\PlatformFeedbackPrompt;
use Illuminate\Contracts\Auth\MustVerifyEmail;

class LoadPersonalSettings
{
    public function __construct(
        private readonly LoadSecuritySettings $securitySettings,
        private readonly PlatformLocaleCatalog $localeCatalog,
        private readonly UserLocaleResolver $localeResolver,
        private readonly SoundPreferenceSerializer $soundPreferences,
        private readonly PlatformFeedbackPrompt $feedbackPrompt,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(User $user, ?string $status): array
    {
        return [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => $status,
            'availableLanguages' => $this->localeCatalog->available(),
            'locale' => $this->localeResolver->forUser($user),
            'soundPreferences' => $this->soundPreferences->serialize($user->preference),
            'feedbackPromptStatus' => $this->feedbackPrompt->status($user->preference),
            ...$this->securitySettings->handle($user),
        ];
    }
}
