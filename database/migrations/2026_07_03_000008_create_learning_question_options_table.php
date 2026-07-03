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
        Schema::create('learning_question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_question_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->text('body');
            $table->boolean('is_correct')->default(false);
            $table->string('outcome_key')->nullable();
            $table->text('feedback')->nullable();
            $table->json('weights')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_question_options');
    }
};
