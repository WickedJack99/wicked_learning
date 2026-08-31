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
        Schema::create('learning_activity_template_revisions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_activity_template_id')
                ->constrained('learning_activity_templates')
                ->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('type', 80);
            $table->json('snapshot');
            $table->timestamps();

            $table->index(['learning_activity_template_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_activity_template_revisions');
    }
};
