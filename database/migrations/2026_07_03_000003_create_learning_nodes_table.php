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
        Schema::create('learning_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_map_id')->constrained()->cascadeOnDelete();
            $table->string('slug');
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('position_q');
            $table->integer('position_r');
            $table->string('state')->default('available');
            $table->json('visual_config')->nullable();
            $table->unsignedBigInteger('start_activity_id')->nullable();
            $table->timestamps();

            $table->unique(['learning_map_id', 'slug']);
            $table->unique(['learning_map_id', 'position_q', 'position_r']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_nodes');
    }
};
