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
        Schema::create('learning_map_asset_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_map_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('image_url', 2048)->nullable();
            $table->string('text', 255)->nullable();
            $table->double('position_x');
            $table->double('position_y');
            $table->integer('position_z');
            $table->double('width');
            $table->double('opacity');
            $table->boolean('locked')->default(false);
            $table->boolean('focusable')->default(false);
            $table->string('interaction_mode', 40)->nullable();
            $table->json('interaction_config')->nullable();
            $table->json('visual_config')->nullable();
            $table->json('sound_config')->nullable();
            $table->timestamps();

            $table->index(['learning_map_asset_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_map_asset_versions');
    }
};
