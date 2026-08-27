<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learner_message_responses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learner_message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 280);
            $table->timestamp('hidden_at')->nullable();
            $table->foreignId('hidden_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['learner_message_id', 'user_id']);
            $table->index(['learner_message_id', 'hidden_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_message_responses');
    }
};
