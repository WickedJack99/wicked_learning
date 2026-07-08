<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('npc_dialogue_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_activity_id')->constrained('learning_activities')->cascadeOnDelete();
            $table->string('type');
            $table->string('title');
            $table->text('body')->nullable();
            $table->json('config')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->integer('graph_position_x')->nullable();
            $table->integer('graph_position_y')->nullable();
            $table->timestamps();
        });

        Schema::create('npc_dialogue_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_activity_id')->constrained('learning_activities')->cascadeOnDelete();
            $table->foreignId('from_dialogue_node_id')->nullable()->constrained('npc_dialogue_nodes')->cascadeOnDelete();
            $table->foreignId('to_dialogue_node_id')->constrained('npc_dialogue_nodes')->cascadeOnDelete();
            $table->string('from_connector')->default('out');
            $table->string('to_connector')->default('in');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('npc_dialogue_transitions');
        Schema::dropIfExists('npc_dialogue_nodes');
    }
};
