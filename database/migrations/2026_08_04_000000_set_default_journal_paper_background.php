<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const BACKGROUND = '/images/themes/journal-paper-leather-background.png';

    /** @var list<string> */
    private const REPLACED_DEFAULTS = [
        '',
        '/images/themes/journal-half-open-book-dark.png',
    ];

    public function up(): void
    {
        DB::table('platform_journal_settings')
            ->orderBy('id')
            ->each(function (object $setting): void {
                $theme = json_decode((string) $setting->theme, true);

                if (! is_array($theme)) {
                    return;
                }

                $updated = false;

                foreach (['dark', 'light'] as $mode) {
                    if (! is_array($theme[$mode] ?? null)) {
                        continue;
                    }

                    $background = (string) ($theme[$mode]['backgroundImage'] ?? '');

                    if (! in_array($background, self::REPLACED_DEFAULTS, true)) {
                        continue;
                    }

                    $theme[$mode]['backgroundImage'] = self::BACKGROUND;
                    $updated = true;
                }

                if ($updated) {
                    DB::table('platform_journal_settings')
                        ->where('id', $setting->id)
                        ->update(['theme' => json_encode($theme, JSON_THROW_ON_ERROR)]);
                }
            });
    }

    public function down(): void
    {
        // Preserve an administrator's newly selected paper background on rollback.
    }
};
