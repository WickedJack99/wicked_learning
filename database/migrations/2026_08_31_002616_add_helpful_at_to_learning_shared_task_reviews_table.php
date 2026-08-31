<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_shared_task_reviews', function (Blueprint $table): void {
            $table->timestamp('helpful_at')->nullable()->after('response_type');
            $table->index(['learning_activity_id', 'helpful_at']);
        });
    }

    public function down(): void
    {
        Schema::table('learning_shared_task_reviews', function (Blueprint $table): void {
            $table->dropIndex(['learning_activity_id', 'helpful_at']);
            $table->dropColumn('helpful_at');
        });
    }
};
