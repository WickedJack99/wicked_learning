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
        Schema::table('access_links', function (Blueprint $table): void {
            $table->string('usage_policy', 20)->default('one_time')->after('purpose');
            $table->boolean('is_enabled')->default(true)->after('usage_policy');
            $table->index(['usage_policy', 'is_enabled', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('access_links', function (Blueprint $table): void {
            $table->dropIndex(['usage_policy', 'is_enabled', 'expires_at']);
            $table->dropColumn(['usage_policy', 'is_enabled']);
        });
    }
};
