<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_reflections', function (Blueprint $table): void {
            $table->boolean('is_independent_check')->default(false)->after('response_context');
        });

        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->boolean('is_independent_check')->default(false)->after('learner_reflection_id');
        });
    }

    public function down(): void
    {
        Schema::table('learner_evidence_events', function (Blueprint $table): void {
            $table->dropColumn('is_independent_check');
        });

        Schema::table('learner_reflections', function (Blueprint $table): void {
            $table->dropColumn('is_independent_check');
        });
    }
};
