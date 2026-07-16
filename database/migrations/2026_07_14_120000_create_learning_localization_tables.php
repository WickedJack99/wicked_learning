<?php

use App\Access\AccessLevel;
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
        Schema::create('platform_languages', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 16)->unique();
            $table->string('name');
            $table->string('native_name');
            $table->json('translations')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('learning_activity_translations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_activity_id')->constrained('learning_activities')->cascadeOnDelete();
            $table->string('locale', 16);
            $table->json('content');
            $table->timestamps();

            $table->unique(['learning_activity_id', 'locale']);
        });

        $roles = DB::table('access_roles')->whereIn('slug', [User::ROLE_ADMIN, User::ROLE_USER])->get(['id', 'slug']);

        foreach ($roles as $role) {
            DB::table('access_role_permissions')->updateOrInsert(
                ['access_role_id' => $role->id, 'resource' => PermissionCatalog::LANGUAGES],
                ['level' => $role->slug === User::ROLE_ADMIN ? AccessLevel::DELETE : AccessLevel::NONE],
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_activity_translations');
        Schema::dropIfExists('platform_languages');
    }
};
