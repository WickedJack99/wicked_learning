<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('learning_activities')
            ->where('slug', 'prepare-for-travel')
            ->update([
                'type' => 'portal',
                'config' => json_encode(['portalMode' => 'output'], JSON_THROW_ON_ERROR),
            ]);

        $returnGateId = DB::table('learning_nodes')
            ->where('slug', 'return-gate')
            ->value('id');

        if (! $returnGateId) {
            return;
        }

        $activityId = DB::table('learning_activities')
            ->where('learning_node_id', $returnGateId)
            ->where('slug', 'arrive-through-the-gate')
            ->value('id');

        if (! $activityId) {
            $activityId = DB::table('learning_activities')->insertGetId([
                'learning_node_id' => $returnGateId,
                'slug' => 'arrive-through-the-gate',
                'type' => 'portal',
                'title' => 'Arrive through the gate',
                'introduction' => 'This node receives learners who travel through a linked portal.',
                'config' => json_encode(['portalMode' => 'input'], JSON_THROW_ON_ERROR),
                'sort_order' => 10,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('learning_nodes')
            ->where('id', $returnGateId)
            ->whereNull('start_activity_id')
            ->update(['start_activity_id' => $activityId]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
