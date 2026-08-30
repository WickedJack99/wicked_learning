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
        Schema::table('learner_reflections', function (Blueprint $table): void {
            $table->uuid('play_run_id')->nullable()->after('learning_activity_id');
            $table->index(
                ['user_id', 'learning_activity_id', 'play_run_id', 'response_type'],
                'learner_reflections_response_lookup',
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_reflections', function (Blueprint $table): void {
            $table->dropIndex('learner_reflections_response_lookup');
            $table->dropColumn('play_run_id');
        });
    }
};
