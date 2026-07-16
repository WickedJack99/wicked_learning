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
        Schema::create('platform_journal_settings', function (Blueprint $table): void {
            $table->id();
            $table->boolean('allow_expert_access_requests')->default(false);
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('learner_journal_pages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('topic', 160);
            // Empty string allows a portable unique key for an optional subtopic.
            $table->string('subtopic', 160)->default('');
            $table->longText('markdown')->default('');
            $table->string('preferred_mode', 8)->default('view');
            $table->boolean('expert_access_requested')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'topic', 'subtopic']);
        });

        Schema::create('learner_reflections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learner_journal_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_node_id')->nullable()->constrained('learning_nodes')->nullOnDelete();
            $table->foreignId('learning_activity_id')->nullable()->constrained('learning_activities')->nullOnDelete();
            $table->foreignId('npc_dialogue_node_id')->nullable()->constrained('npc_dialogue_nodes')->nullOnDelete();
            $table->string('title', 240);
            $table->text('question');
            $table->longText('reflection');
            $table->boolean('expert_access_requested')->default(false);
            $table->string('feedback_status', 24)->default('not_requested');
            $table->longText('expert_feedback')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        if (! Schema::hasTable('access_roles')) {
            return;
        }

        DB::table('access_roles')->orderBy('id')->get()->each(function (object $role): void {
            DB::table('access_role_permissions')->updateOrInsert(
                ['access_role_id' => $role->id, 'resource' => PermissionCatalog::JOURNALS],
                ['level' => $role->slug === User::ROLE_ADMIN ? AccessLevel::DELETE : AccessLevel::NONE],
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_reflections');
        Schema::dropIfExists('learner_journal_pages');
        Schema::dropIfExists('platform_journal_settings');
    }
};
