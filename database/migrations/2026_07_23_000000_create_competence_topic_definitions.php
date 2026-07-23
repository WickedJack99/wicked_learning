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
        Schema::create('competence_topic_definitions', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('growth_threshold', 12, 2)->default(20);
            $table->decimal('emittance_threshold', 12, 2)->default(20);
            $table->decimal('aura_threshold', 12, 2)->default(10);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        if (! Schema::hasTable('access_role_permissions')) {
            return;
        }

        DB::table('access_roles')->orderBy('id')->get(['id', 'slug'])->each(
            function (object $role): void {
                DB::table('access_role_permissions')->updateOrInsert([
                    'access_role_id' => $role->id,
                    'resource' => PermissionCatalog::COMPETENCE_TOPICS,
                ], [
                    'level' => $role->slug === User::ROLE_ADMIN ? AccessLevel::DELETE : AccessLevel::NONE,
                    'scope' => AccessScope::ALL,
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
                ->where('resource', PermissionCatalog::COMPETENCE_TOPICS)
                ->delete();
        }

        Schema::dropIfExists('competence_topic_definitions');
    }
};
