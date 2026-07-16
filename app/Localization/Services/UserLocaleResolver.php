<?php

namespace App\Localization\Services;

use App\Models\User;

class UserLocaleResolver
{
    public function __construct(private readonly PlatformLocaleCatalog $catalog) {}

    public function forUser(?User $user): string
    {
        $locale = $user?->preference?->settings['locale'] ?? PlatformLocaleCatalog::DEFAULT_LOCALE;

        return is_string($locale) && $this->catalog->isAvailable($locale)
            ? $locale
            : PlatformLocaleCatalog::DEFAULT_LOCALE;
    }
}
