<?php

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('access_role_permissions', function (Blueprint $table): void {
            $table->string('scope', 24)->default(AccessScope::ALL)->after('level');
        });

        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->foreignId('created_by_user_id')->nullable()->after('learning_world_id')->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->after('created_by_user_id')->constrained('users')->nullOnDelete();
        });

        Schema::table('learning_groups', function (Blueprint $table): void {
            $table->foreignId('created_by_user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
            $table->string('study_topic')->nullable()->after('description');
        });

        Schema::table('learning_group_user', function (Blueprint $table): void {
            $table->string('role', 24)->default('member')->after('user_id');
        });

        $this->expandLegacyPermissions();
    }

    public function down(): void
    {
        Schema::table('learning_group_user', function (Blueprint $table): void {
            $table->dropColumn('role');
        });

        Schema::table('learning_groups', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('created_by_user_id');
            $table->dropColumn('study_topic');
        });

        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('updated_by_user_id');
            $table->dropConstrainedForeignId('created_by_user_id');
        });

        Schema::table('access_role_permissions', function (Blueprint $table): void {
            $table->dropColumn('scope');
        });
    }

    private function expandLegacyPermissions(): void
    {
        $roles = DB::table('access_roles')->get(['id', 'slug']);

        foreach ($roles as $role) {
            $existing = DB::table('access_role_permissions')
                ->where('access_role_id', $role->id)
                ->pluck('level', 'resource')
                ->all();

            foreach (PermissionCatalog::resourceKeys() as $resource) {
                DB::table('access_role_permissions')->updateOrInsert([
                    'access_role_id' => $role->id,
                    'resource' => $resource,
                ], [
                    'level' => $existing[$resource] ?? $this->legacyLevel($existing, $resource),
                    'scope' => $role->slug === 'admin' ? AccessScope::ALL : $this->defaultScope($resource),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * @param  array<string, string>  $existing
     */
    private function legacyLevel(array $existing, string $resource): string
    {
        foreach (PermissionCatalog::legacyResourceMap() as $legacy => $resources) {
            if (in_array($resource, $resources, true)) {
                return $existing[$legacy] ?? AccessLevel::NONE;
            }
        }

        return AccessLevel::NONE;
    }

    private function defaultScope(string $resource): string
    {
        return match ($resource) {
            PermissionCatalog::WORLD_MAPS,
            PermissionCatalog::WORLD_NODES,
            PermissionCatalog::WORLD_ACTIVITIES,
            PermissionCatalog::GROUPS,
            PermissionCatalog::GROUP_MEMBERS,
            PermissionCatalog::GROUP_TOPICS => AccessScope::OWN,
            default => AccessScope::ALL,
        };
    }
};
