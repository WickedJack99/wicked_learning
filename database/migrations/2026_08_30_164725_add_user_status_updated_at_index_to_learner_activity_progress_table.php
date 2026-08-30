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
        Schema::table('learner_activity_progress', function (Blueprint $table): void {
            $table->index(
                ['user_id', 'status', 'updated_at'],
                'learner_activity_progress_user_status_updated_at_index',
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_activity_progress', function (Blueprint $table): void {
            $table->dropIndex('learner_activity_progress_user_status_updated_at_index');
        });
    }
};
