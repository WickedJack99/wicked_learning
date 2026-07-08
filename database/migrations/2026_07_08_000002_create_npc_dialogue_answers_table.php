<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('npc_dialogue_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_activity_id')->constrained('learning_activities')->cascadeOnDelete();
            $table->foreignId('npc_dialogue_node_id')->constrained()->cascadeOnDelete();
            $table->string('answer_key');
            $table->text('answer_label')->nullable();
            $table->boolean('is_correct');
            $table->text('feedback')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('npc_dialogue_answers');
    }
};
