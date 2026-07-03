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
        Schema::create('learning_maps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_world_id')->constrained()->cascadeOnDelete();
            $table->string('slug');
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('background_config')->nullable();
            $table->json('grid_config')->nullable();
            $table->boolean('time_background_enabled')->default(false);
            $table->timestamps();

            $table->unique(['learning_world_id', 'slug']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_maps');
    }
};
