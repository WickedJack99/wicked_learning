<?php

namespace App\Localization\Actions;

use App\Localization\Services\PlatformLocaleCatalog;
use App\Models\User;
use App\Models\UserPreference;

class UpdateUserLocalePreference
{
    public function __construct(private readonly PlatformLocaleCatalog $catalog) {}

    public function handle(User $user, string $locale): void
    {
        abort_unless($this->catalog->isAvailable($locale), 422, 'The selected language is not available.');

        $preference = UserPreference::query()->firstOrNew(['user_id' => $user->id]);
        $settings = is_array($preference->settings) ? $preference->settings : [];
        $settings['locale'] = $locale;
        $preference->settings = $settings;
        $preference->appearance ??= 'light';
        $preference->save();
    }
}
