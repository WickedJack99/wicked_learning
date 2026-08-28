<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->dropUnique('learner_evidence_events_unique');
            $table->string('confidence')->nullable()->after('outcome');
            $table->unsignedInteger('attempt_number')->default(1)->after('confidence');
            $table->unique([
                'user_id',
                'learning_activity_id',
                'play_run_id',
                'topic_slug',
                'evidence_type',
                'attempt_number',
            ], 'learner_evidence_events_unique');
        });
    }

    public function down(): void
    {
        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->dropUnique('learner_evidence_events_unique');
            $table->dropColumn(['confidence', 'attempt_number']);
            $table->unique([
                'user_id',
                'learning_activity_id',
                'play_run_id',
                'topic_slug',
                'evidence_type',
            ], 'learner_evidence_events_unique');
        });
    }
};
