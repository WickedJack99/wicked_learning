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
        Schema::table('learner_recall_items', function (Blueprint $table) {
            $table->string('last_confidence_after_feedback', 32)->nullable()->after('last_confidence');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_recall_items', function (Blueprint $table) {
            $table->dropColumn('last_confidence_after_feedback');
        });
    }
};
