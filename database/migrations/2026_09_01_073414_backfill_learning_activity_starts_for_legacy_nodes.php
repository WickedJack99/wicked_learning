<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('learning_nodes as nodes')
            ->join('learning_activities as activities', 'activities.id', '=', 'nodes.start_activity_id')
            ->leftJoin('learning_activity_starts as starts', function (JoinClause $join): void {
                $join
                    ->on('starts.learning_node_id', '=', 'nodes.id')
                    ->on('starts.learning_activity_id', '=', 'nodes.start_activity_id');
            })
            ->whereNotNull('nodes.start_activity_id')
            ->whereNull('starts.id')
            ->select([
                'nodes.id as learning_node_id',
                'nodes.start_activity_id as learning_activity_id',
            ])
            ->orderBy('nodes.id')
            ->each(function (object $node): void {
                DB::table('learning_activity_starts')->insert([
                    'learning_node_id' => $node->learning_node_id,
                    'learning_activity_id' => $node->learning_activity_id,
                    'label' => null,
                    'sort_order' => 10,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        /**
         * This repairs missing derived records and intentionally does not
         * remove route starts that may have been edited after the repair.
         */
    }
};
