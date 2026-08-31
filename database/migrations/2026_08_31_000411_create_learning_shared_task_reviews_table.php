<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_shared_task_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_activity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_shared_task_submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->unique(['learning_activity_id', 'user_id']);
            $table->index(['learning_activity_id', 'learning_shared_task_submission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_shared_task_reviews');
    }
};
