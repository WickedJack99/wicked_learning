<?php

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $roles = DB::table('access_roles')->get(['id', 'slug']);

        foreach ($roles as $role) {
            DB::table('access_role_permissions')->updateOrInsert(
                [
                    'access_role_id' => $role->id,
                    'resource' => PermissionCatalog::PLATFORM_FEEDBACK,
                ],
                [
                    'level' => $role->slug === 'admin'
                        ? AccessLevel::DELETE
                        : AccessLevel::NONE,
                    'scope' => AccessScope::ALL,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    public function down(): void
    {
        DB::table('access_role_permissions')
            ->where('resource', PermissionCatalog::PLATFORM_FEEDBACK)
            ->delete();
    }
};
