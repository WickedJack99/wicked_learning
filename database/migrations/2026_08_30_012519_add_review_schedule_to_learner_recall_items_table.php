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
            $table->timestamp('last_reviewed_at')->nullable();
            $table->timestamp('next_review_at')->nullable();
            $table->unsignedTinyInteger('review_count')->default(0);
            $table->string('last_outcome', 32)->nullable();
            $table->string('last_confidence', 32)->nullable();
            $table->index(['user_id', 'next_review_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_recall_items', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'next_review_at']);
            $table->dropColumn([
                'last_reviewed_at',
                'next_review_at',
                'review_count',
                'last_outcome',
                'last_confidence',
            ]);
        });
    }
};
