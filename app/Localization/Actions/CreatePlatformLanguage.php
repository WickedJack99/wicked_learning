<?php

namespace App\Localization\Actions;

use App\Models\PlatformLanguage;
use App\Models\User;

class CreatePlatformLanguage
{
    /**
     * @param  array{code: string, name: string, native_name: string, is_enabled?: bool}  $data
     */
    public function handle(array $data, User $user): PlatformLanguage
    {
        return PlatformLanguage::query()->create([
            'code' => $data['code'],
            'name' => $data['name'],
            'native_name' => $data['native_name'],
            'is_enabled' => $data['is_enabled'] ?? true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
    }
}
