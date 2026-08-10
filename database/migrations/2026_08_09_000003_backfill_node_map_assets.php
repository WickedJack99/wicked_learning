<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('learning_nodes')
            ->select(['id', 'learning_map_id'])
            ->orderBy('id')
            ->each(function (object $node) use ($now): void {
                if (DB::table('learning_map_assets')->where('learning_node_id', $node->id)->exists()) {
                    return;
                }

                DB::table('learning_map_assets')->insert([
                    'learning_map_id' => $node->learning_map_id,
                    'learning_node_id' => $node->id,
                    'position_x' => 50,
                    'position_y' => 50,
                    'position_z' => 0,
                    'width' => 14,
                    'opacity' => 1,
                    'locked' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        // Placeholder assets are indistinguishable from intentional assets after
        // later edits, so they are retained on rollback.
    }
};
