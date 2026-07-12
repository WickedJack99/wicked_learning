<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learner_route_progress', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_node_id')->constrained('learning_nodes')->cascadeOnDelete();
            $table->foreignId('learning_activity_start_id')->nullable()->constrained('learning_activity_starts')->nullOnDelete();
            $table->foreignId('start_learning_activity_id')->constrained('learning_activities')->cascadeOnDelete();
            $table->foreignId('current_learning_activity_id')->nullable()->constrained('learning_activities')->nullOnDelete();
            $table->uuid('current_play_run_id')->nullable();
            $table->string('status')->default('not_started');
            $table->unsignedInteger('completion_count')->default(0);
            $table->unsignedInteger('reset_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('last_entered_at')->nullable();
            $table->timestamp('last_exited_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('last_completed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'learning_node_id', 'start_learning_activity_id'], 'learner_route_unique_start');
            $table->index(['user_id', 'current_play_run_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_route_progress');
    }
};
