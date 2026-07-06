<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Attach demo SVG node images to existing seeded maps without requiring a reseed.
     */
    public function up(): void
    {
        $nodeImages = [
            'signal-gate' => [
                'imageUrl' => '/images/nodes/signal-gate-dark.svg',
                'light' => [
                    'imageUrl' => '/images/nodes/signal-gate-light.svg',
                ],
            ],
            'field-notes' => [
                'imageUrl' => '/images/nodes/field-notes-dark.svg',
                'light' => [
                    'imageUrl' => '/images/nodes/field-notes-light.svg',
                ],
            ],
            'quiet-archive' => [
                'imageUrl' => '/images/nodes/quiet-archive-dark.svg',
                'light' => [
                    'imageUrl' => '/images/nodes/quiet-archive-light.svg',
                ],
            ],
            'portal-foundation' => [
                'imageUrl' => '/images/nodes/portal-gate-dark.svg',
                'light' => [
                    'imageUrl' => '/images/nodes/portal-gate-light.svg',
                ],
            ],
            'return-gate' => [
                'imageUrl' => '/images/nodes/portal-gate-dark.svg',
                'light' => [
                    'imageUrl' => '/images/nodes/portal-gate-light.svg',
                ],
            ],
        ];

        foreach ($nodeImages as $slug => $images) {
            $node = DB::table('learning_nodes')->where('slug', $slug)->first();

            if (! $node) {
                continue;
            }

            $visualConfig = json_decode((string) $node->visual_config, true) ?: [];

            DB::table('learning_nodes')
                ->where('id', $node->id)
                ->update([
                    'visual_config' => json_encode(
                        array_replace_recursive($visualConfig, $images),
                        JSON_THROW_ON_ERROR,
                    ),
                ]);
        }
    }

    public function down(): void
    {
        // Demo visual data can safely remain if this migration is rolled back.
    }
};
