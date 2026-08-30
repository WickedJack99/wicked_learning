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
        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->foreignId('learner_reflection_id')
                ->nullable()
                ->after('play_run_id')
                ->constrained('learner_reflections')
                ->nullOnDelete();
            $table->index('learner_reflection_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->dropForeign(['learner_reflection_id']);
            $table->dropIndex(['learner_reflection_id']);
            $table->dropColumn('learner_reflection_id');
        });
    }
};
