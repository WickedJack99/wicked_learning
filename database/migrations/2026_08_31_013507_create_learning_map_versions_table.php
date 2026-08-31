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
        Schema::create('learning_map_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_map_id')->constrained()->cascadeOnDelete();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->unsignedBigInteger('learning_topic_id')->nullable();
            $table->boolean('map_assets_locked')->default(false);
            $table->timestamps();

            $table->index(['learning_map_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_map_versions');
    }
};
