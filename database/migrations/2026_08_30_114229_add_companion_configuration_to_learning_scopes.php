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
        foreach ([
            'platform_companion_settings',
            'learning_worlds',
            'learning_maps',
            'learning_nodes',
            'learning_activities',
        ] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->json('companion_config')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ([
            'platform_companion_settings',
            'learning_worlds',
            'learning_maps',
            'learning_nodes',
            'learning_activities',
        ] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropColumn('companion_config');
            });
        }
    }
};
