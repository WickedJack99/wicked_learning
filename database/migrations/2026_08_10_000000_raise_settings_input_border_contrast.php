<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceDefaultOpacity(10, 42);
    }

    public function down(): void
    {
        $this->replaceDefaultOpacity(42, 10);
    }

    private function replaceDefaultOpacity(int $from, int $to): void
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

        $opacity = $value['settingsPalette']['dark']['inputBorderColorOpacity'] ?? null;

        if ($opacity !== $from) {
            return;
        }

        $value['settingsPalette']['dark']['inputBorderColorOpacity'] = $to;

        DB::table('platform_presentation_settings')
            ->where('id', $setting->id)
            ->update(['value' => json_encode($value)]);
    }
};
