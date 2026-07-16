<?php

namespace App\Learning\Services;

use App\Models\PlatformJournalSetting;

/** Normalizes platform journal visuals for admin editing and learner display. */
class JournalThemeConfiguration
{
    /** @return array{dark: array<string, mixed>, light: array<string, mixed>} */
    public function defaults(): array
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

    /** @param  array<string, mixed>|null  $theme */
    public function normalize(?array $theme): array
    {
        $defaults = $this->defaults();

        return [
            'dark' => $this->normalizeMode($theme['dark'] ?? [], $defaults['dark']),
            'light' => $this->normalizeMode($theme['light'] ?? [], $defaults['light']),
        ];
    }

    public function ensureCurrentSettingHasTheme(): void
    {
        $setting = PlatformJournalSetting::current();

        if ($setting->theme !== null) {
            return;
        }

        $setting->forceFill(['theme' => $this->defaults()])->save();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeMode(mixed $data, array $defaults): array
    {
        $data = is_array($data) ? $data : [];

        return collect($defaults)
            ->mapWithKeys(fn (mixed $default, string $key): array => [
                $key => array_key_exists($key, $data) ? $data[$key] : $default,
            ])
            ->all();
    }
}
