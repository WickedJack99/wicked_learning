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
            $table->json('source_references')
                ->nullable()
                ->after('evidence_rubric');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->dropColumn('source_references');
        });
    }
};
