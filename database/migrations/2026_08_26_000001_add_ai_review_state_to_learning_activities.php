<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_activities', function (Blueprint $table): void {
            $table->string('ai_review_status', 32)
                ->default('needs_review')
                ->after('config')
                ->index();
            $table->timestamp('ai_reviewed_at')->nullable()->after('ai_review_status');
        });
    }

    public function down(): void
    {
        Schema::table('learning_activities', function (Blueprint $table): void {
            $table->dropColumn(['ai_review_status', 'ai_reviewed_at']);
        });
    }
};
