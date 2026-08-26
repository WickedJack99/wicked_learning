<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_activities', function (Blueprint $table): void {
            $table->json('ai_review')->nullable()->after('ai_reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('learning_activities', function (Blueprint $table): void {
            $table->dropColumn('ai_review');
        });
    }
};
