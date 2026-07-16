<?php

namespace App\Settings\Queries;

use App\Localization\Services\PlatformLocaleCatalog;
use App\Localization\Services\UserLocaleResolver;
use App\Models\User;
use Illuminate\Contracts\Auth\MustVerifyEmail;

class LoadPersonalSettings
{
    public function __construct(
        private readonly LoadSecuritySettings $securitySettings,
        private readonly PlatformLocaleCatalog $localeCatalog,
        private readonly UserLocaleResolver $localeResolver,
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
            ...$this->securitySettings->handle($user),
        ];
    }
}
