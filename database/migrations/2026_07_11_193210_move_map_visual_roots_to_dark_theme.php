<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * @var list<string>
     */
    private array $themeFields = [
        'accentColor',
        'completedDimOpacity',
        'imageUrl',
        'overlay',
        'pageBackground',
        'panelBackground',
        'panelMutedTextColor',
        'panelTextColor',
        'sidePanelBackground',
        'sidePanelBorderColor',
        'sidePanelMutedTextColor',
        'sidePanelTextColor',
    ];

    public function up(): void
    {
        DB::table('learning_maps')
            ->orderBy('id')
            ->get()
            ->each(function (object $map): void {
                $row = (array) $map;
                $config = $this->decodeConfig($row['background_config'] ?? null);
                $dark = is_array($config['dark'] ?? null) ? $config['dark'] : [];

                foreach ($this->themeFields as $field) {
                    if (array_key_exists($field, $config)) {
                        $dark[$field] ??= $config[$field];
                        unset($config[$field]);
                    }
                }

                $config['dark'] = $dark;

                DB::table('learning_maps')
                    ->where('id', (int) $row['id'])
                    ->update([
                        'background_config' => json_encode($config, JSON_THROW_ON_ERROR),
                        'updated_at' => now(),
                    ]);
            });
    }

    public function down(): void
    {
        // The dark/light structure is the current canonical shape.
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeConfig(mixed $config): array
    {
        if (is_array($config)) {
            return $config;
        }

        if (! is_string($config)) {
            return [];
        }

        $decoded = json_decode($config, true);

        return is_array($decoded) ? $decoded : [];
    }
};
