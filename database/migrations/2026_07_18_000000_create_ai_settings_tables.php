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
        Schema::create('ai_provider_credentials', function (Blueprint $table): void {
            $table->id();
            $table->string('label', 120);
            $table->string('provider', 40);
            $table->string('base_url')->nullable();
            $table->text('api_key')->nullable();
            $table->string('api_key_last_four', 8)->nullable();
            $table->string('organization')->nullable();
            $table->boolean('enabled')->default(false);
            $table->unsignedBigInteger('monthly_token_limit')->nullable();
            $table->unsignedInteger('monthly_cost_limit_cents')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_agent_templates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ai_provider_credential_id')->nullable()->constrained('ai_provider_credentials')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('purpose', 40)->index();
            $table->string('model', 120)->nullable();
            $table->longText('system_prompt')->nullable();
            $table->longText('task_prompt')->nullable();
            $table->decimal('temperature', 3, 2)->default(0.70);
            $table->unsignedInteger('max_output_tokens')->nullable();
            $table->unsignedSmallInteger('concurrency_limit')->default(1);
            $table->unsignedBigInteger('monthly_token_limit')->nullable();
            $table->boolean('enabled')->default(false);
            $table->boolean('guarded_context')->default(true);
            $table->timestamps();
        });

        if (! Schema::hasTable('access_roles')) {
            return;
        }

        DB::table('access_roles')->orderBy('id')->get()->each(function (object $role): void {
            DB::table('access_role_permissions')->updateOrInsert(
                ['access_role_id' => $role->id, 'resource' => PermissionCatalog::AI],
                ['level' => $role->slug === User::ROLE_ADMIN ? AccessLevel::DELETE : AccessLevel::NONE],
            );
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('access_role_permissions')) {
            DB::table('access_role_permissions')
                ->where('resource', PermissionCatalog::AI)
                ->delete();
        }

        Schema::dropIfExists('ai_agent_templates');
        Schema::dropIfExists('ai_provider_credentials');
    }
};
