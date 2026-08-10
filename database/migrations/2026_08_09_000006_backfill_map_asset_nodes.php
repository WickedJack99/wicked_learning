<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('learning_map_assets')
            ->whereNull('learning_node_id')
            ->orderBy('id')
            ->eachById(function (object $asset): void {
                $title = trim((string) ($asset->text ?: "MapAsset {$asset->id}"));
                $baseSlug = Str::slug($title) ?: 'map-asset';
                $slug = $baseSlug;
                $suffix = 2;

                while (DB::table('learning_nodes')
                    ->where('learning_map_id', $asset->learning_map_id)
                    ->where('slug', $slug)
                    ->exists()) {
                    $slug = "{$baseSlug}-{$suffix}";
                    $suffix++;
                }

                $positionQ = (int) (DB::table('learning_nodes')
                    ->where('learning_map_id', $asset->learning_map_id)
                    ->max('position_q')) + 1;

                while (DB::table('learning_nodes')
                    ->where('learning_map_id', $asset->learning_map_id)
                    ->where('position_q', $positionQ)
                    ->where('position_r', 0)
                    ->exists()) {
                    $positionQ++;
                }

                $nodeId = DB::table('learning_nodes')->insertGetId([
                    'learning_map_id' => $asset->learning_map_id,
                    'slug' => $slug,
                    'title' => $title,
                    'description' => null,
                    'position_q' => $positionQ,
                    'position_r' => 0,
                    'state' => 'available',
                    'visual_config' => null,
                    'start_activity_id' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('learning_map_assets')
                    ->where('id', $asset->id)
                    ->update(['learning_node_id' => $nodeId]);
            });
    }

    public function down(): void
    {
        // The generated nodes may already have activities or learner progress.
        // Keeping them is safer than deleting user data during a rollback.
    }
};
