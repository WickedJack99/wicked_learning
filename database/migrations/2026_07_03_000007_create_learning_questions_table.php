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
        Schema::create('learning_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_activity_id')->constrained()->cascadeOnDelete();
            $table->text('prompt');
            $table->text('feedback_correct')->nullable();
            $table->text('feedback_incorrect')->nullable();
            $table->text('explanation')->nullable();
            $table->boolean('allow_multiple')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_questions');
    }
};
