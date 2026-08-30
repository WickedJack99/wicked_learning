<?php

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_companion_settings', function (Blueprint $table): void {
            $table->id();
            $table->boolean('enabled')->default(true);
            $table->string('display_name', 80)->default('Learning companion');
            $table->string('avatar_url', 2048)->nullable();
            $table->text('welcome_message');
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        if (! Schema::hasTable('access_roles')) {
            return;
        }

        DB::table('access_roles')->orderBy('id')->get(['id', 'slug'])->each(
            function (object $role): void {
                $isAdmin = $role->slug === User::ROLE_ADMIN;

                DB::table('access_role_permissions')->updateOrInsert([
                    'access_role_id' => $role->id,
                    'resource' => PermissionCatalog::COMPANION,
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
        if (Schema::hasTable('access_role_permissions')) {
            DB::table('access_role_permissions')
                ->where('resource', PermissionCatalog::COMPANION)
                ->delete();
        }

        Schema::dropIfExists('platform_companion_settings');
    }
};
