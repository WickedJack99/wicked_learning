<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_shared_task_submissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_activity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('play_run_id')->nullable();
            $table->longText('body');
            $table->string('status', 24)->default('accepted');
            $table->string('validation_mode', 40)->default('minimum_length');
            $table->json('metadata')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->index(['learning_activity_id', 'status']);
            $table->index(['user_id', 'learning_activity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_shared_task_submissions');
    }
};
