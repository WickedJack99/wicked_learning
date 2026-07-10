<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learner_node_discoveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_node_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_tool_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('discovered_at')->useCurrent();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'learning_node_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_node_discoveries');
    }
};
