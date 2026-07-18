<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @var array<string, string>
     */
    private array $replacements = [
        '/images/themes/mentor-calm.png' => '/images/characters/mentor-calm.png',
        '/images/themes/mentor-hint.png' => '/images/characters/mentor-hint.png',
        '/images/themes/mentor-alert.png' => '/images/characters/mentor-alert.png',
        '/images/themes/mentor-dragon.png' => '/images/characters/mentor-dragon.png',
        '/images/themes/npc-mira-dark.png' => '/images/characters/npc-mira-dark.png',
        '/images/themes/npc-mira-light.png' => '/images/characters/npc-mira-light.png',
    ];

    public function up(): void
    {
        $this->replace($this->replacements);
    }

    public function down(): void
    {
        $this->replace(array_flip($this->replacements));
    }

    /**
     * @param  array<string, string>  $replacements
     */
    private function replace(array $replacements): void
    {
        $this->replaceStringColumn('dialogue_stages', 'portrait_url', $replacements);

        foreach ([
            ['learning_activities', 'config'],
            ['learning_maps', 'background_config'],
            ['learning_nodes', 'visual_config'],
            ['npc_dialogue_nodes', 'config'],
            ['dialogue_stages', 'visual_config'],
            ['platform_presentation_settings', 'value'],
        ] as [$table, $column]) {
            $this->replaceJsonColumn($table, $column, $replacements);
        }
    }

    /**
     * @param  array<string, string>  $replacements
     */
    private function replaceStringColumn(string $table, string $column, array $replacements): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        foreach ($replacements as $oldUrl => $newUrl) {
            DB::table($table)
                ->where($column, $oldUrl)
                ->update([$column => $newUrl]);
        }
    }

    /**
     * @param  array<string, string>  $replacements
     */
    private function replaceJsonColumn(string $table, string $column, array $replacements): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        DB::table($table)
            ->select(['id', $column])
            ->orderBy('id')
            ->each(function (object $row) use ($table, $column, $replacements): void {
                $value = $this->decodeJsonValue($row->{$column});

                if (! is_array($value)) {
                    return;
                }

                [$nextValue, $changed] = $this->replaceInValue($value, $replacements);

                if (! $changed) {
                    return;
                }

                DB::table($table)
                    ->where('id', $row->id)
                    ->update([$column => json_encode($nextValue)]);
            });
    }

    private function decodeJsonValue(mixed $value): mixed
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || $value === '') {
            return null;
        }

        return json_decode($value, true);
    }

    /**
     * @param  array<string, string>  $replacements
     * @return array{0: mixed, 1: bool}
     */
    private function replaceInValue(mixed $value, array $replacements): array
    {
        if (is_string($value) && array_key_exists($value, $replacements)) {
            return [$replacements[$value], true];
        }

        if (! is_array($value)) {
            return [$value, false];
        }

        $changed = false;

        foreach ($value as $key => $item) {
            [$nextItem, $itemChanged] = $this->replaceInValue($item, $replacements);
            $value[$key] = $nextItem;
            $changed = $changed || $itemChanged;
        }

        return [$value, $changed];
    }
};
