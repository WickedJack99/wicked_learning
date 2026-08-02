<?php

test('every configurable settings color is exposed as a settings CSS variable', function () {
    $presentationTheme = file_get_contents(resource_path('js/theme/presentation.ts'));

    $paletteFields = [
        'accent' => '--settings-accent',
        'accentForeground' => '--settings-accent-foreground',
        'activeBackground' => '--settings-active-background',
        'appearanceSwitchActiveBackground' => '--settings-appearance-switch-active-background',
        'appearanceSwitchActiveText' => '--settings-appearance-switch-active-text',
        'appearanceSwitchBackground' => '--settings-appearance-switch-background',
        'appearanceSwitchInactiveText' => '--settings-appearance-switch-inactive-text',
        'borderColor' => '--settings-border-color',
        'contentBackground' => '--settings-content-background',
        'inputBackground' => '--settings-input-background',
        'inputBorderColor' => '--settings-input-border-color',
        'mutedText' => '--settings-muted-text',
        'nestedSidebarBackground' => '--settings-nested-sidebar-background',
        'panelBackground' => '--settings-panel-background',
        'scrollbarThumb' => '--settings-scrollbar-thumb',
        'sidebarBackground' => '--settings-sidebar-background',
    ];

    foreach ($paletteFields as $field => $cssVariable) {
        $escapedVariable = preg_quote($cssVariable, '/');
        $escapedField = preg_quote($field, '/');

        expect($presentationTheme)->toMatch(
            "/'{$escapedVariable}': settingsPaletteColor\(\s*palette,\s*'{$escapedField}'/",
        );
    }
});

test('shared settings controls inherit the configurable color palette', function () {
    $settingsCss = file_get_contents(resource_path('css/app.css'));

    expect($settingsCss)
        ->toContain('--primary: var(--settings-accent);')
        ->toContain('--primary-foreground: var(--settings-accent-foreground);')
        ->toContain('--card: var(--settings-panel-background);')
        ->toContain('--input: var(--settings-input-border-color);')
        ->toContain('border-color: var(--settings-input-border-color);')
        ->toContain('background-color: var(--settings-input-background);');
});

test('learning support settings surfaces do not bypass palette tokens', function () {
    $sources = [
        resource_path('js/components/settings-configuration-shell.tsx'),
        resource_path('js/components/two-factor-recovery-codes.tsx'),
        resource_path('js/features/settings/learning-support-panel.tsx'),
        resource_path('js/features/settings/sound-settings-panel.tsx'),
        resource_path('js/pages/settings/admin-panel.tsx'),
        resource_path('js/pages/settings/journal.tsx'),
    ];
    $forbiddenSurfaceColor = '/\b(?:bg|border)-(?:slate|zinc|neutral|gray|white|black)(?:-\d{1,3})?(?:\/[\w.]+)?\b|(?:background(?:Color)?|borderColor)\s*:\s*[\'\"](?:#|rgb|hsl)/';
    $violations = [];

    foreach ($sources as $source) {
        $contents = file_get_contents($source);

        preg_match_all($forbiddenSurfaceColor, $contents, $matches, PREG_OFFSET_CAPTURE);

        foreach ($matches[0] as [$match, $offset]) {
            $line = substr_count(substr($contents, 0, $offset), "\n") + 1;

            $violations[] = sprintf('%s:%d (%s)', basename($source), $line, $match);
        }
    }

    expect($violations)->toBeEmpty(
        'Settings surfaces must use the configurable --settings-* palette tokens. '.implode(', ', $violations),
    );
});

test('journal background images resolve against the app origin', function () {
    $journalTheme = file_get_contents(resource_path('js/features/journal/theme.ts'));
    $journalOverlay = file_get_contents(resource_path('js/features/journal/journal-overlay.tsx'));

    expect($journalTheme)
        ->toContain('new URL(normalized, window.location.origin).toString()')
        ->toContain('return `url("${imageUrl}")`;')
        ->toContain("'--journal-background-position'")
        ->toContain("'--journal-background-zoom'")
        ->and($journalOverlay)
        ->toContain('<JournalBackgroundImage source={backgroundImageUrl} />')
        ->toContain('<JournalBackgroundAssets assets={backgroundAssets} />')
        ->toContain("objectPosition: 'var(--journal-background-position)'")
        ->toContain("transform: 'scale(var(--journal-background-zoom))'");
});
