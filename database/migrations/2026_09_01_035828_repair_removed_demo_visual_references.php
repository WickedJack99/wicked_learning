<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The prototype visuals were removed from the repository, but older demo
     * records can still point at them. Repair only those exact built-in paths;
     * user-authored media and unrelated configuration remain untouched.
     */
    private const REPLACEMENTS = [
        '/images/themes/abstract-map-background.svg' => '/images/themes/fantasy-world-map-background.png',
        '/images/nodes/signal-gate-dark.svg' => '/images/nodes/fantasy-hex-crystal-grove.png',
        '/images/nodes/signal-gate-light.svg' => '/images/nodes/fantasy-hex-crystal-grove.png',
        '/images/nodes/field-notes-dark.svg' => '/images/nodes/fantasy-hex-library.png',
        '/images/nodes/field-notes-light.svg' => '/images/nodes/fantasy-hex-library.png',
        '/images/nodes/quiet-archive-dark.svg' => '/images/nodes/fantasy-hex-castle.png',
        '/images/nodes/quiet-archive-light.svg' => '/images/nodes/fantasy-hex-castle.png',
        '/images/nodes/portal-gate-dark.svg' => '/images/nodes/fantasy-hex-castle.png',
        '/images/nodes/portal-gate-light.svg' => '/images/nodes/fantasy-hex-castle.png',
        '/images/routes/signal-route-dark.svg' => '/images/tools/pattern-lens-dark.svg',
        '/images/routes/signal-route-light.svg' => '/images/tools/pattern-lens-light.svg',
        '/images/routes/portal-route-dark.svg' => '/images/portals/portal-swirl.png',
        '/images/routes/portal-route-light.svg' => '/images/portals/portal-swirl.png',
    ];

    public function up(): void
    {
        $this->replaceJsonColumn('learning_maps', 'background_config');
        $this->replaceJsonColumn('learning_nodes', 'visual_config');
        $this->replaceJsonColumn('learning_activities', 'config');

        foreach (['image_dark', 'image_light'] as $column) {
            foreach (self::REPLACEMENTS as $oldUrl => $newUrl) {
                DB::table('learning_activity_starts')
                    ->where($column, $oldUrl)
                    ->update([$column => $newUrl]);
            }
        }
    }

    public function down(): void
    {
        // The original files no longer exist, so reversing this repair would
        // recreate broken references rather than restore a usable state.
    }

    private function replaceJsonColumn(string $table, string $column): void
    {
        $rows = DB::table($table)
            ->where(function ($query) use ($column): void {
                foreach (array_keys(self::REPLACEMENTS) as $oldUrl) {
                    $query->orWhereRaw(
                        'CAST("'.$column.'" AS TEXT) LIKE ?',
                        ['%'.$oldUrl.'%'],
                    );
                }
            })
            ->get(['id', $column]);

        foreach ($rows as $row) {
            $value = json_decode((string) $row->{$column}, true);
            $replaced = $this->replaceValue($value);

            if ($replaced !== $value) {
                DB::table($table)
                    ->where('id', $row->id)
                    ->update([$column => json_encode($replaced, JSON_THROW_ON_ERROR)]);
            }
        }
    }

    private function replaceValue(mixed $value): mixed
    {
        if (is_string($value)) {
            return self::REPLACEMENTS[$value] ?? $value;
        }

        if (! is_array($value)) {
            return $value;
        }

        foreach ($value as $key => $item) {
            $value[$key] = $this->replaceValue($item);
        }

        return $value;
    }
};
