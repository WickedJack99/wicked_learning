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
            $table->json('observed_cues')->nullable()->after('assistance_level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_review_attempts', function (Blueprint $table): void {
            $table->dropColumn('observed_cues');
        });
    }
};
