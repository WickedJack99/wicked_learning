<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->boolean('map_assets_locked')->default(false)->after('time_background_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->dropColumn('map_assets_locked');
        });
    }
};
