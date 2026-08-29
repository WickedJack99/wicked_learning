<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('learner_review_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_activity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learner_activity_progress_id')
                ->constrained('learner_activity_progress')
                ->cascadeOnDelete();
            $table->unsignedInteger('attempt_number')->default(1);
            $table->string('source', 32)->default('revisit');
            $table->string('outcome', 32)->nullable();
            $table->string('confidence', 32)->nullable();
            $table->string('assistance_level', 32)->default('untracked');
            $table->timestamp('attempted_at');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'learning_activity_id', 'attempted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learner_review_attempts');
    }
};
