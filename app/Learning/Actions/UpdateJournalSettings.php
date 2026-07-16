<?php

namespace App\Learning\Actions;

use App\Learning\Services\JournalThemeConfiguration;
use App\Models\PlatformJournalSetting;
use App\Models\User;

/** Updates platform-wide journal policy and presentation settings. */
class UpdateJournalSettings
{
    public function __construct(private readonly JournalThemeConfiguration $theme) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(User $user, array $data): PlatformJournalSetting
    {
        $setting = PlatformJournalSetting::current();

        $setting->forceFill([
            'allow_expert_access_requests' => (bool) $data['allow_expert_access_requests'],
            'theme' => $this->theme->normalize($data['theme'] ?? []),
            'updated_by_user_id' => $user->id,
        ])->save();

        return $setting->refresh();
    }
}
