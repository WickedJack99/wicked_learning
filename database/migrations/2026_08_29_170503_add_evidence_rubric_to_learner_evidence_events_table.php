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
            $table->json('evidence_rubric')
                ->nullable()
                ->after('evidence_criterion');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->dropColumn('evidence_rubric');
        });
    }
};
