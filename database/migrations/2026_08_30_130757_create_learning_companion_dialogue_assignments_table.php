<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_companion_dialogue_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_companion_dialogue_id')
                ->constrained('learning_companion_dialogues')
                ->name('companion_dialogue_assignment_dialogue_fk')
                ->cascadeOnDelete();
            $table->string('scope_type', 32);
            $table->unsignedBigInteger('scope_id');
            $table->timestamps();

            $table->unique([
                'learning_companion_dialogue_id',
                'scope_type',
                'scope_id',
            ], 'companion_dialogue_assignment_unique');
            $table->index(['scope_type', 'scope_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_companion_dialogue_assignments');
    }
};
