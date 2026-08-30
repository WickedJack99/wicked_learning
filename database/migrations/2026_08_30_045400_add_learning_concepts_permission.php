<?php

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('access_role_permissions')) {
            return;
        }

        DB::table('access_roles')->orderBy('id')->get(['id', 'slug'])->each(
            function (object $role): void {
                $isAdmin = $role->slug === User::ROLE_ADMIN;

                DB::table('access_role_permissions')->updateOrInsert([
                    'access_role_id' => $role->id,
                    'resource' => PermissionCatalog::LEARNING_CONCEPTS,
                ], [
                    'level' => $isAdmin ? AccessLevel::DELETE : AccessLevel::NONE,
                    'scope' => $isAdmin ? AccessScope::ALL : AccessScope::NONE,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            },
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('access_role_permissions')) {
            return;
        }

        DB::table('access_role_permissions')
            ->where('resource', PermissionCatalog::LEARNING_CONCEPTS)
            ->delete();
    }
};
