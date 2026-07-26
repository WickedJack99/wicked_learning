<?php

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $resource = PermissionCatalog::MEDIA_PATHS;

        DB::table('access_roles')
            ->select(['id', 'slug'])
            ->orderBy('id')
            ->each(function (object $role) use ($resource): void {
                DB::table('access_role_permissions')->updateOrInsert([
                    'access_role_id' => $role->id,
                    'resource' => $resource,
                ], [
                    'level' => $role->slug === User::ROLE_ADMIN ? AccessLevel::READ : AccessLevel::NONE,
                    'scope' => AccessScope::ALL,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        DB::table('access_role_permissions')
            ->where('resource', PermissionCatalog::MEDIA_PATHS)
            ->delete();
    }
};
