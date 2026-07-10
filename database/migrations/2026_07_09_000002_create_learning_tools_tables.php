<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_tools', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('image_dark')->nullable();
            $table->string('image_light')->nullable();
            $table->string('animation_dark')->nullable();
            $table->string('animation_light')->nullable();
            $table->json('config')->nullable();
            $table->timestamps();
        });

        Schema::create('user_learning_tools', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_tool_id')->constrained()->cascadeOnDelete();
            $table->timestamp('acquired_at')->useCurrent();
            $table->timestamps();

            $table->unique(['user_id', 'learning_tool_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_learning_tools');
        Schema::dropIfExists('learning_tools');
    }
};
