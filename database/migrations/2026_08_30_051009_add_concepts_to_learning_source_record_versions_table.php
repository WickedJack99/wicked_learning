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
        Schema::table('learning_source_record_versions', function (Blueprint $table): void {
            $table->json('concepts')->nullable()->after('excerpt');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learning_source_record_versions', function (Blueprint $table): void {
            $table->dropColumn('concepts');
        });
    }
};
