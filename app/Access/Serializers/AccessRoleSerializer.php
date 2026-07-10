<?php

namespace App\Access\Serializers;

use App\Models\AccessRole;

class AccessRoleSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(AccessRole $role): array
    {
        return [
            'id' => $role->id,
            'slug' => $role->slug,
            'name' => $role->name,
            'description' => $role->description,
            'level' => $role->level,
            'is_system' => $role->is_system,
            'permissions' => $role->permissionMap(),
        ];
    }
}
