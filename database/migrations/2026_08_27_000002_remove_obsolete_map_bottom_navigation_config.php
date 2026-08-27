<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * These fields belonged to the retired floating bottom navigation.
     *
     * The project is still in demo development, so preserving this obsolete
     * configuration would make old concepts easier to reintroduce by mistake.
     */
    private const OBSOLETE_FIELDS = [
        'bottomNavActiveBackground',
        'bottomNavActiveIconColor',
        'bottomNavActiveTextColor',
        'bottomNavBackground',
        'bottomNavBorderColor',
        'bottomNavExitIconColor',
        'bottomNavIconColor',
        'bottomNavTextColor',
    ];

    public function up(): void
    {
        DB::table('learning_maps')
            ->select(['id', 'background_config'])
            ->orderBy('id')
            ->chunkById(100, function ($maps): void {
                foreach ($maps as $map) {
                    $config = json_decode($map->background_config ?? 'null', true);

                    if (! is_array($config)) {
                        continue;
                    }

                    $changed = $this->removeObsoleteFields($config);

                    foreach (['dark', 'light'] as $mode) {
                        if (! is_array($config[$mode] ?? null)) {
                            continue;
                        }

                        $changed = $this->removeObsoleteFields($config[$mode]) || $changed;
                    }

                    if ($changed) {
                        DB::table('learning_maps')
                            ->where('id', $map->id)
                            ->update([
                                'background_config' => json_encode($config, JSON_THROW_ON_ERROR),
                            ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // The removed presentation settings cannot be restored meaningfully.
    }

    /** @param array<string, mixed> $config */
    private function removeObsoleteFields(array &$config): bool
    {
        $changed = false;

        foreach (self::OBSOLETE_FIELDS as $field) {
            if (array_key_exists($field, $config)) {
                unset($config[$field]);
                $changed = true;
            }
        }

        return $changed;
    }
};
