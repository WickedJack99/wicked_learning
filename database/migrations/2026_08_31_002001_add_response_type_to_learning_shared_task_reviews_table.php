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
        Schema::table('learning_shared_task_reviews', function (Blueprint $table): void {
            $table->string('response_type')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('learning_shared_task_reviews', function (Blueprint $table): void {
            $table->dropColumn('response_type');
        });
    }
};
