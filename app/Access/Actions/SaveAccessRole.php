<?php

namespace App\Access\Actions;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Models\AccessRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SaveAccessRole
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?AccessRole $role = null): AccessRole
    {
        return DB::transaction(function () use ($data, $role): AccessRole {
            $role ??= new AccessRole;
            $role->forceFill([
                'slug' => $role->exists ? $role->slug : Str::slug((string) $data['slug']),
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'level' => (int) ($data['level'] ?? 10),
            ])->save();

            $permissions = is_array($data['permissions'] ?? null)
                ? $data['permissions']
                : [];

            foreach (PermissionCatalog::resourceKeys() as $resource) {
                $level = $permissions[$resource] ?? AccessLevel::NONE;

                $role->permissions()->updateOrCreate(
                    ['resource' => $resource],
                    ['level' => in_array($level, AccessLevel::values(), true) ? $level : AccessLevel::NONE],
                );
            }

            return $role->refresh()->load('permissions');
        });
    }
}
