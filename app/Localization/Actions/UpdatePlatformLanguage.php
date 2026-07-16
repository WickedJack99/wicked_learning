<?php

namespace App\Localization\Actions;

use App\Models\PlatformLanguage;
use App\Models\User;

class UpdatePlatformLanguage
{
    /**
     * @param  array{name: string, native_name: string, is_enabled: bool}  $data
     */
    public function handle(PlatformLanguage $language, array $data, User $user): void
    {
        $language->forceFill([
            'name' => $data['name'],
            'native_name' => $data['native_name'],
            'is_enabled' => $data['is_enabled'],
            'updated_by' => $user->id,
        ])->save();
    }
}
