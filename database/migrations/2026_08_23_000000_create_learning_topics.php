<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_topic_areas', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['sort_order', 'title']);
        });

        Schema::create('learning_topics', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_topic_area_id')
                ->constrained('learning_topic_areas')
                ->cascadeOnDelete();
            $table->foreignId('parent_id')
                ->nullable()
                ->constrained('learning_topics')
                ->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->longText('content')->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            $table->index(['learning_topic_area_id', 'parent_id', 'title']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_topics');
        Schema::dropIfExists('learning_topic_areas');
    }
};
