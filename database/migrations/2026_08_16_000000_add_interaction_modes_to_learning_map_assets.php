<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_map_assets', function (Blueprint $table): void {
            $table->string('interaction_mode', 32)->default('focusable')->after('focusable');
            $table->json('interaction_config')->nullable()->after('interaction_mode');
        });

        DB::table('learning_map_assets')
            ->where('focusable', false)
            ->update(['interaction_mode' => 'decorative']);
    }

    public function down(): void
    {
        Schema::table('learning_map_assets', function (Blueprint $table): void {
            $table->dropColumn(['interaction_mode', 'interaction_config']);
        });
    }
};
