<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_map_assets', function (Blueprint $table): void {
            $table->boolean('focusable')->default(true)->after('locked');
        });
    }

    public function down(): void
    {
        Schema::table('learning_map_assets', function (Blueprint $table): void {
            $table->dropColumn('focusable');
        });
    }
};
