<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_groups', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->boolean('admin_chat_visible_enabled')->default(false);
            $table->timestamp('admin_chat_visible_until')->nullable();
            $table->timestamps();
        });

        Schema::create('learning_group_user', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_group_id')->constrained('learning_groups')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['learning_group_id', 'user_id']);
        });

        Schema::create('learning_group_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_group_id')->constrained('learning_groups')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('learning_group_admin_chat_votes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_group_id')->constrained('learning_groups')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['learning_group_id', 'user_id']);
        });

        Schema::create('learning_group_map_editors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_group_id')->constrained('learning_groups')->cascadeOnDelete();
            $table->foreignId('learning_map_id')->constrained('learning_maps')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['learning_group_id', 'learning_map_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_group_map_editors');
        Schema::dropIfExists('learning_group_admin_chat_votes');
        Schema::dropIfExists('learning_group_messages');
        Schema::dropIfExists('learning_group_user');
        Schema::dropIfExists('learning_groups');
    }
};
