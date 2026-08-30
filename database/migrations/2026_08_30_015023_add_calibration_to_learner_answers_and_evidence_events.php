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
        Schema::table('learner_question_answers', function (Blueprint $table): void {
            $table->string('calibration', 40)->nullable()->after('confidence');
        });

        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->string('calibration', 40)->nullable()->after('confidence');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_question_answers', function (Blueprint $table): void {
            $table->dropColumn('calibration');
        });

        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->dropColumn('calibration');
        });
    }
};
