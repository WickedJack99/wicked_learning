<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Give the demo world light-mode visual overrides without requiring a reseed.
     */
    public function up(): void
    {
        $map = DB::table('learning_maps')->where('slug', 'first-sector')->first();

        if ($map) {
            $backgroundConfig = json_decode($map->background_config ?? '[]', true) ?: [];
            $backgroundConfig = array_replace_recursive($backgroundConfig, [
                'pageBackground' => '#0b1117',
                'panelTextColor' => '#f8fafc',
                'panelMutedTextColor' => 'rgba(226, 232, 240, 0.82)',
                'sidePanelBackground' => '#111820',
                'sidePanelBorderColor' => 'rgba(255, 255, 255, 0.1)',
                'sidePanelTextColor' => '#f8fafc',
                'accentColor' => '#99f6e4',
                'light' => [
                    'overlay' => 'rgba(238, 251, 252, 0.72)',
                    'pageBackground' => '#e8f6f8',
                    'panelBackground' => 'rgba(255, 255, 255, 0.78)',
                    'panelTextColor' => '#0f172a',
                    'panelMutedTextColor' => 'rgba(51, 65, 85, 0.78)',
                    'sidePanelBackground' => '#ffffff',
                    'sidePanelBorderColor' => 'rgba(15, 23, 42, 0.12)',
                    'sidePanelTextColor' => '#0f172a',
                    'accentColor' => '#0e7490',
                    'cardBorderColor' => 'rgba(14, 116, 144, 0.18)',
                ],
            ]);

            DB::table('learning_maps')
                ->where('id', $map->id)
                ->update(['background_config' => json_encode($backgroundConfig)]);
        }

        $nodeThemes = [
            'signal-gate' => [
                'labelColor' => '#ffffff',
                'light' => [
                    'tileColor' => '#d5f5f0',
                    'foregroundColor' => '#0f766e',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#0d9488',
                ],
            ],
            'field-notes' => [
                'labelColor' => '#ffffff',
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
            ],
            'quiet-archive' => [
                'labelColor' => '#ffffff',
                'light' => [
                    'tileColor' => '#ede9fe',
                    'foregroundColor' => '#6d28d9',
                    'labelColor' => '#334155',
                    'highlightColor' => '#8b5cf6',
                ],
            ],
            'portal-foundation' => [
                'labelColor' => '#ffffff',
                'light' => [
                    'tileColor' => '#dcfce7',
                    'foregroundColor' => '#15803d',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#16a34a',
                ],
            ],
        ];

        foreach ($nodeThemes as $slug => $theme) {
            $node = DB::table('learning_nodes')->where('slug', $slug)->first();

            if (! $node) {
                continue;
            }

            $visualConfig = json_decode($node->visual_config ?? '[]', true) ?: [];

            DB::table('learning_nodes')
                ->where('id', $node->id)
                ->update([
                    'visual_config' => json_encode(array_replace_recursive($visualConfig, $theme)),
                ]);
        }
    }

    public function down(): void
    {
        // Demo visual data can safely remain if this migration is rolled back.
    }
};
