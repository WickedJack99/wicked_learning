<?php

use App\Models\PlatformPresentationSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Remove earlier built-in background defaults while preserving custom admin choices.
     */
    public function up(): void
    {
        $setting = PlatformPresentationSetting::query()
            ->where('key', 'public_presentation')
            ->first();

        if (! $setting || ! is_array($setting->value)) {
            return;
        }

        $value = $setting->value;
        $defaults = [
            'login' => '/images/themes/mentor-calm.svg',
            'register' => '/images/themes/mentor-hint.svg',
            'welcome' => '/images/themes/abstract-map-background.svg',
        ];

        foreach ($defaults as $page => $defaultImage) {
            if (($value['auth']['backgroundImages'][$page]['dark'] ?? null) === $defaultImage) {
                $value['auth']['backgroundImages'][$page]['dark'] = '';
            }
        }

        $setting->forceFill(['value' => $value])->save();
    }

    public function down(): void
    {
        // Intentionally not restoring image defaults; custom admin media should stay explicit.
    }
};
