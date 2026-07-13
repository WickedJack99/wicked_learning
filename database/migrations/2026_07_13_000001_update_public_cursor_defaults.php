<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceCursorDefaults([
            '/images/cursors/default-cursor.svg' => '/images/cursors/fantasy-cursor.png',
            '/images/cursors/action-pointer.svg' => '/images/cursors/fantasy-pointer.png',
        ]);
    }

    public function down(): void
    {
        $this->replaceCursorDefaults([
            '/images/cursors/fantasy-cursor.png' => '/images/cursors/default-cursor.svg',
            '/images/cursors/fantasy-pointer.png' => '/images/cursors/action-pointer.svg',
        ]);
    }

    /**
     * @param  array<string, string>  $replacements
     */
    private function replaceCursorDefaults(array $replacements): void
    {
        $setting = DB::table('platform_presentation_settings')
            ->where('key', 'public_presentation')
            ->first();

        if (! $setting || ! is_string($setting->value)) {
            return;
        }

        $value = json_decode($setting->value, true);

        if (! is_array($value)) {
            return;
        }

        foreach (['default', 'action'] as $cursorKey) {
            $current = $value['cursors'][$cursorKey]['image'] ?? null;

            if (is_string($current) && isset($replacements[$current])) {
                $value['cursors'][$cursorKey]['image'] = $replacements[$current];
            }
        }

        DB::table('platform_presentation_settings')
            ->where('id', $setting->id)
            ->update(['value' => json_encode($value)]);
    }
};
