<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_activity_review_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_activity_id')
                ->constrained('learning_activities')
                ->cascadeOnDelete();
            $table->foreignId('ai_agent_template_id')
                ->nullable()
                ->constrained('ai_agent_templates')
                ->nullOnDelete();
            $table->foreignId('reviewed_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('contract_version', 32);
            $table->string('provider', 64);
            $table->string('model', 120)->nullable();
            $table->json('review');
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();
            $table->unsignedInteger('total_tokens')->nullable();
            $table->timestamps();

            $table->index(['learning_activity_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_activity_review_runs');
    }
};
