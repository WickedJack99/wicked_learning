<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Move legacy node fallback visuals into the dark-mode visual block.
     */
    public function up(): void
    {
        DB::table('learning_nodes')
            ->orderBy('id')
            ->each(function (object $node): void {
                $visualConfig = json_decode((string) $node->visual_config, true) ?: [];
                $darkConfig = is_array($visualConfig['dark'] ?? null) ? $visualConfig['dark'] : [];
                $lightConfig = is_array($visualConfig['light'] ?? null) ? $visualConfig['light'] : [];

                foreach (['tileColor', 'foregroundColor', 'labelColor', 'highlightColor', 'imageUrl'] as $key) {
                    if (($darkConfig[$key] ?? null) === null && isset($visualConfig[$key])) {
                        $darkConfig[$key] = $visualConfig[$key];
                    }

                    unset($visualConfig[$key]);
                }

                $visualConfig['dark'] = array_replace([
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                    'imageUrl' => '',
                ], $darkConfig);

                $visualConfig['light'] = array_replace([
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                    'imageUrl' => '',
                ], $lightConfig);

                DB::table('learning_nodes')
                    ->where('id', $node->id)
                    ->update([
                        'visual_config' => json_encode($visualConfig, JSON_THROW_ON_ERROR),
                    ]);
            });
    }

    public function down(): void
    {
        // The new theme-specific structure is safe to keep if rolled back.
    }
};
