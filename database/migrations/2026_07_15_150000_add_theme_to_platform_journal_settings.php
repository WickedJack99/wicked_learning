<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_journal_settings', function (Blueprint $table): void {
            $table->json('theme')->nullable()->after('allow_expert_access_requests');
        });

        DB::table('platform_journal_settings')
            ->whereNull('theme')
            ->update(['theme' => json_encode($this->defaultTheme(), JSON_THROW_ON_ERROR)]);
    }

    public function down(): void
    {
        Schema::table('platform_journal_settings', function (Blueprint $table): void {
            $table->dropColumn('theme');
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultTheme(): array
    {
        return [
            'dark' => [
                'backgroundImage' => '',
                'backgroundOverlay' => '#020617',
                'backgroundOverlayOpacity' => 72,
                'panelBackground' => '#0b1117',
                'panelBackgroundOpacity' => 96,
                'panelBorder' => '#ffffff',
                'panelBorderOpacity' => 12,
                'headerBackground' => '#0f172a',
                'headerBackgroundOpacity' => 24,
                'sidebarBackground' => '#111827',
                'sidebarBackgroundOpacity' => 64,
                'contentBackground' => '#0f172a',
                'contentBackgroundOpacity' => 40,
                'inputBackground' => '#020617',
                'inputBackgroundOpacity' => 72,
                'headingText' => '#f8fafc',
                'headingTextOpacity' => 100,
                'bodyText' => '#e2e8f0',
                'bodyTextOpacity' => 92,
                'mutedText' => '#94a3b8',
                'mutedTextOpacity' => 100,
                'accent' => '#2dd4bf',
                'accentOpacity' => 100,
                'accentText' => '#020617',
                'accentTextOpacity' => 100,
                'buttonBackground' => '#0f172a',
                'buttonBackgroundOpacity' => 86,
                'buttonText' => '#f8fafc',
                'buttonTextOpacity' => 100,
                'buttonBorder' => '#ffffff',
                'buttonBorderOpacity' => 14,
                'selectedBackground' => '#134e4a',
                'selectedBackgroundOpacity' => 36,
                'selectedBorder' => '#5eead4',
                'selectedBorderOpacity' => 100,
                'selectedText' => '#f8fafc',
                'selectedTextOpacity' => 100,
            ],
            'light' => [
                'backgroundImage' => '',
                'backgroundOverlay' => '#f8fafc',
                'backgroundOverlayOpacity' => 68,
                'panelBackground' => '#ffffff',
                'panelBackgroundOpacity' => 96,
                'panelBorder' => '#0f172a',
                'panelBorderOpacity' => 14,
                'headerBackground' => '#f8fafc',
                'headerBackgroundOpacity' => 72,
                'sidebarBackground' => '#f1f5f9',
                'sidebarBackgroundOpacity' => 88,
                'contentBackground' => '#ffffff',
                'contentBackgroundOpacity' => 86,
                'inputBackground' => '#ffffff',
                'inputBackgroundOpacity' => 94,
                'headingText' => '#0f172a',
                'headingTextOpacity' => 100,
                'bodyText' => '#334155',
                'bodyTextOpacity' => 100,
                'mutedText' => '#64748b',
                'mutedTextOpacity' => 100,
                'accent' => '#0891b2',
                'accentOpacity' => 100,
                'accentText' => '#ffffff',
                'accentTextOpacity' => 100,
                'buttonBackground' => '#ffffff',
                'buttonBackgroundOpacity' => 92,
                'buttonText' => '#0f172a',
                'buttonTextOpacity' => 100,
                'buttonBorder' => '#0f172a',
                'buttonBorderOpacity' => 14,
                'selectedBackground' => '#cffafe',
                'selectedBackgroundOpacity' => 90,
                'selectedBorder' => '#0891b2',
                'selectedBorderOpacity' => 100,
                'selectedText' => '#0f172a',
                'selectedTextOpacity' => 100,
            ],
        ];
    }
};
