<?php

namespace App\Learning\Serializers;

use App\Learning\Services\JournalThemeConfiguration;
use App\Models\PlatformJournalSetting;

/** Shapes platform-wide journal settings for admin pages and learner UI. */
class PlatformJournalSettingsSerializer
{
    public function __construct(private readonly JournalThemeConfiguration $theme) {}

    /** @return array{allowExpertAccessRequests: bool, theme: array<string, mixed>} */
    public function serialize(PlatformJournalSetting $setting): array
    {
        return [
            'allowExpertAccessRequests' => $setting->allow_expert_access_requests,
            'theme' => $this->theme->normalize($setting->theme),
        ];
    }
}
