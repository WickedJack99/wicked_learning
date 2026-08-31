<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_shared_task_submissions', function (Blueprint $table): void {
            $table->longText('revised_body')->nullable()->after('body');
            $table->timestamp('revised_at')->nullable()->after('accepted_at');
            $table->index(['learning_activity_id', 'user_id', 'revised_at']);
        });
    }

    public function down(): void
    {
        Schema::table('learning_shared_task_submissions', function (Blueprint $table): void {
            $table->dropIndex(['learning_activity_id', 'user_id', 'revised_at']);
            $table->dropColumn(['revised_body', 'revised_at']);
        });
    }
};
