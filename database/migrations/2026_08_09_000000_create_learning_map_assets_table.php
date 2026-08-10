<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_map_assets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_map_id')->constrained('learning_maps')->cascadeOnDelete();
            $table->foreignId('learning_node_id')->nullable()->constrained('learning_nodes')->cascadeOnDelete();
            $table->string('image_url')->nullable();
            $table->string('text')->nullable();
            $table->decimal('position_x', 8, 3)->default(50);
            $table->decimal('position_y', 8, 3)->default(50);
            $table->integer('position_z')->default(0);
            $table->decimal('width', 8, 3)->default(14);
            $table->decimal('opacity', 4, 3)->default(1);
            $table->boolean('locked')->default(false);
            $table->json('visual_config')->nullable();
            $table->json('sound_config')->nullable();
            $table->timestamps();

            // A learning node can have one visual map representation at most.
            // PostgreSQL allows multiple NULL values, so decorative assets remain unlimited.
            $table->unique('learning_node_id');
            $table->index(['learning_map_id', 'position_z']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_map_assets');
    }
};
