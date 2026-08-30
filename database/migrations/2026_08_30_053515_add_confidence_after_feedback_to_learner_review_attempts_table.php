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
        Schema::table('learner_review_attempts', function (Blueprint $table): void {
            $table->string('confidence_after_feedback', 32)->nullable()->after('confidence');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_review_attempts', function (Blueprint $table): void {
            $table->dropColumn('confidence_after_feedback');
        });
    }
};
