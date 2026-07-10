<?php

namespace App\Models;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['slug', 'name', 'description', 'level', 'is_system'])]
class AccessRole extends Model
{
    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'level' => 'integer',
        ];
    }

    /**
     * @return HasMany<AccessRolePermission, $this>
     */
    public function permissions(): HasMany
    {
        return $this->hasMany(AccessRolePermission::class);
    }

    /**
     * @return array<string, string>
     */
    public function permissionMap(): array
    {
        $stored = $this->permissions
            ->mapWithKeys(fn (AccessRolePermission $permission): array => [
                $permission->resource => $permission->level,
            ])
            ->all();

        return collect(PermissionCatalog::resourceKeys())
            ->mapWithKeys(fn (string $resource): array => [
                $resource => $stored[$resource] ?? AccessLevel::NONE,
            ])
            ->all();
    }
}
