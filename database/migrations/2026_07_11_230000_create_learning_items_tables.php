<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_items', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('image_dark')->nullable();
            $table->string('image_light')->nullable();
            $table->json('config')->nullable();
            $table->timestamps();
        });

        Schema::create('user_learning_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(0);
            $table->timestamp('acquired_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'learning_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_learning_items');
        Schema::dropIfExists('learning_items');
    }
};
