<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_shared_task_reviews', function (Blueprint $table): void {
            $table->unsignedTinyInteger('project_step_index')->nullable()->after('response_type');
        });
    }

    public function down(): void
    {
        Schema::table('learning_shared_task_reviews', function (Blueprint $table): void {
            $table->dropColumn('project_step_index');
        });
    }
};
