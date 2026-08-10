<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_map_assets', function (Blueprint $table): void {
            $table->dropForeign(['learning_node_id']);
            $table->foreign('learning_node_id')
                ->references('id')
                ->on('learning_nodes')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('learning_map_assets', function (Blueprint $table): void {
            $table->dropForeign(['learning_node_id']);
            $table->foreign('learning_node_id')
                ->references('id')
                ->on('learning_nodes')
                ->nullOnDelete();
        });
    }
};
