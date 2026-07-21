<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['max_memberships_per_user'])]
class PlatformOrganizationSetting extends Model
{
    protected function casts(): array
    {
        return [
            'max_memberships_per_user' => 'integer',
        ];
    }

    public static function current(): self
    {
        return self::query()->firstOrCreate([], [
            'max_memberships_per_user' => 10,
        ]);
    }
}
