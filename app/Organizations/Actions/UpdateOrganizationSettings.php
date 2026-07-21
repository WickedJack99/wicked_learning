<?php

namespace App\Organizations\Actions;

use App\Models\PlatformOrganizationSetting;

class UpdateOrganizationSettings
{
    /**
     * @param  array{max_memberships_per_user: int}  $data
     */
    public function handle(array $data): PlatformOrganizationSetting
    {
        $setting = PlatformOrganizationSetting::current();

        $setting->forceFill([
            'max_memberships_per_user' => $data['max_memberships_per_user'],
        ])->save();

        return $setting->refresh();
    }
}
