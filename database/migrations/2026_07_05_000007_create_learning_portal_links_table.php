<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('learning_portal_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('source_learning_node_id')->constrained('learning_nodes')->cascadeOnDelete();
            $table->foreignId('target_learning_node_id')->constrained('learning_nodes')->cascadeOnDelete();
            $table->string('label')->nullable();
            $table->text('description')->nullable();
            $table->json('config')->nullable();
            $table->timestamps();

            $table->unique(['source_learning_node_id', 'target_learning_node_id']);
        });

        $this->seedDemoPortalLink();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_portal_links');
    }

    private function seedDemoPortalLink(): void
    {
        $world = DB::table('learning_worlds')->where('slug', 'demo-cybersecurity')->first();

        if (! $world) {
            return;
        }

        $sourceMap = DB::table('learning_maps')
            ->where('learning_world_id', $world->id)
            ->where('slug', 'first-sector')
            ->first();

        if (! $sourceMap) {
            return;
        }

        $now = now();
        $targetMapId = DB::table('learning_maps')
            ->where('learning_world_id', $world->id)
            ->where('slug', 'signal-archive')
            ->value('id');

        if (! $targetMapId) {
            $targetMapId = DB::table('learning_maps')->insertGetId([
                'learning_world_id' => $world->id,
                'slug' => 'signal-archive',
                'title' => 'Signal Archive',
                'description' => 'A second map used to prototype portal travel between learning spaces.',
                'background_config' => json_encode($sourceMap->background_config ? json_decode($sourceMap->background_config, true) : []),
                'grid_config' => json_encode($sourceMap->grid_config ? json_decode($sourceMap->grid_config, true) : []),
                'time_background_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $sourceNodeId = DB::table('learning_nodes')
            ->where('learning_map_id', $sourceMap->id)
            ->where('slug', 'portal-foundation')
            ->value('id');

        if (! $sourceNodeId) {
            return;
        }

        $targetNodeId = DB::table('learning_nodes')
            ->where('learning_map_id', $targetMapId)
            ->where('slug', 'return-gate')
            ->value('id');

        if (! $targetNodeId) {
            $targetNodeId = DB::table('learning_nodes')->insertGetId([
                'learning_map_id' => $targetMapId,
                'slug' => 'return-gate',
                'title' => 'Return Gate',
                'description' => 'The sibling portal back toward the first sector.',
                'position_q' => 0,
                'position_r' => 0,
                'state' => 'hinted',
                'visual_config' => json_encode([
                    'icon' => 'orbit',
                    'label' => 'Return Gate',
                    'tileColor' => '#19312b',
                    'foregroundColor' => '#bbf7d0',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#4ade80',
                    'tooltip' => 'Prototype sibling portal.',
                    'light' => [
                        'tileColor' => '#dcfce7',
                        'foregroundColor' => '#15803d',
                        'labelColor' => '#0f172a',
                        'highlightColor' => '#16a34a',
                    ],
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('learning_portal_links')->updateOrInsert(
            [
                'source_learning_node_id' => $sourceNodeId,
                'target_learning_node_id' => $targetNodeId,
            ],
            [
                'label' => 'First Sector to Signal Archive',
                'description' => 'Prototype portal pair connecting the first map to a second map.',
                'config' => json_encode(['travelMode' => 'portal']),
                'updated_at' => $now,
                'created_at' => $now,
            ],
        );
    }
};
