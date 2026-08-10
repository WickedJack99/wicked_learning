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
        Schema::create('learning_message_topics', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_map_asset_id')->constrained('learning_map_assets')->cascadeOnDelete();
            $table->string('slug');
            $table->string('title');
            $table->timestamps();

            $table->unique(['learning_map_asset_id', 'slug']);
        });

        Schema::create('learner_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_message_topic_id')->constrained('learning_message_topics')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 280);
            $table->timestamp('hidden_at')->nullable();
            $table->foreignId('hidden_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // A learner contributes once to a topic. Hidden contributions still
            // count so moderation cannot cause the prompt to reappear.
            $table->unique(['learning_message_topic_id', 'user_id']);
            $table->index(['learning_message_topic_id', 'hidden_at']);
        });

        if (! Schema::hasTable('access_role_permissions')) {
            return;
        }

        DB::table('access_roles')->orderBy('id')->get(['id', 'slug'])->each(
            function (object $role): void {
                DB::table('access_role_permissions')->updateOrInsert([
                    'access_role_id' => $role->id,
                    'resource' => PermissionCatalog::LEARNER_MESSAGES,
                ], [
                    'level' => $role->slug === User::ROLE_ADMIN ? AccessLevel::DELETE : AccessLevel::NONE,
                    'scope' => $role->slug === User::ROLE_ADMIN ? AccessScope::ALL : AccessScope::NONE,
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
                ->where('resource', PermissionCatalog::LEARNER_MESSAGES)
                ->delete();
        }

        Schema::dropIfExists('learner_messages');
        Schema::dropIfExists('learning_message_topics');
    }
};
