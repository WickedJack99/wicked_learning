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
        Schema::table('learning_activities', function (Blueprint $table) {
            $table->integer('graph_position_x')->nullable()->after('sort_order');
            $table->integer('graph_position_y')->nullable()->after('graph_position_x');
        });

        Schema::table('activity_transitions', function (Blueprint $table) {
            $table->string('from_connector')->nullable()->after('to_activity_id');
            $table->string('to_connector')->nullable()->after('from_connector');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('activity_transitions', function (Blueprint $table) {
            $table->dropColumn(['from_connector', 'to_connector']);
        });

        Schema::table('learning_activities', function (Blueprint $table) {
            $table->dropColumn(['graph_position_x', 'graph_position_y']);
        });
    }
};
