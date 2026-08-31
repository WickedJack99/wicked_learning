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

test('every configurable learner color is exposed as a learner CSS variable', function () {
    $presentationTheme = file_get_contents(resource_path('js/theme/presentation.ts'));

    $paletteFields = [
        'accent' => '--learner-accent',
        'actionAccent' => '--learner-action-accent',
        'borderColor' => '--learner-border-color',
        'bodyText' => '--learner-body-text',
        'headerBackground' => '--learner-header-background',
        'headingText' => '--learner-heading-text',
        'mutedText' => '--learner-muted-text',
        'pageBackground' => '--learner-page-background',
        'panelBackground' => '--learner-panel-background',
        'panelMutedBackground' => '--learner-panel-muted-background',
    ];

    foreach ($paletteFields as $field => $cssVariable) {
        $escapedVariable = preg_quote($cssVariable, '/');
        $escapedField = preg_quote($field, '/');

        expect($presentationTheme)->toMatch(
            "/'{$escapedVariable}': learnerPaletteColor\(\s*palette,\s*'{$escapedField}'/",
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
        ->toContain('--settings-control-border: color-mix(')
        ->toContain('border-color: var(--settings-control-border);')
        ->toContain('background-color: var(--settings-input-background);');
});

test('learning support settings surfaces do not bypass palette tokens', function () {
    $sources = [
        resource_path('js/components/settings-configuration-shell.tsx'),
        resource_path('js/components/two-factor-recovery-codes.tsx'),
        resource_path('js/features/settings/learning-support-panel.tsx'),
        resource_path('js/features/settings/sound-settings-panel.tsx'),
        resource_path('js/features/settings/access-group-management-panel.tsx'),
        resource_path('js/features/settings/world-builder-settings-panel.tsx'),
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

test('the palette workbench uses the semantic foreground token for preview text', function () {
    $workbench = file_get_contents(resource_path('js/components/palette-workbench.tsx'));

    expect($workbench)
        ->toContain('bg-[var(--palette-workbench-content)] text-foreground')
        ->toContain('hover:text-foreground')
        ->not->toContain('text-white');
});

test('shared settings headings use the semantic foreground token', function () {
    $shell = file_get_contents(resource_path('js/components/settings-configuration-shell.tsx'));

    expect($shell)
        ->toContain('text-foreground')
        ->not->toContain('text-slate-950 dark:text-white');
});

test('platform typography keeps compact text readable', function () {
    $settingsCss = file_get_contents(resource_path('css/app.css'));
    $frontendFilesIterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(resource_path('js')),
    );
    $undersizedText = [];

    foreach ($frontendFilesIterator as $frontendFileInfo) {
        if (! $frontendFileInfo->isFile() || ! in_array($frontendFileInfo->getExtension(), ['ts', 'tsx'], true)) {
            continue;
        }

        $frontendFile = $frontendFileInfo->getPathname();
        $contents = file_get_contents($frontendFile);

        if (preg_match('/text-\\[(?:[0-9]|1[01])px|text-\\[0\\.[0-7]\\d*rem\\]/', $contents)) {
            $undersizedText[] = $frontendFile;
        }
    }

    expect($settingsCss)
        ->toContain('--text-xs: 0.8125rem;')
        ->toContain('--text-xs--line-height: 1.25rem;')
        ->and($undersizedText)->toBeEmpty(
            'Use the shared text-xs token instead of frontend text below 12px.',
        );
});

test('map editor configuration surfaces use settings palette tokens', function () {
    $editor = file_get_contents(resource_path('js/pages/settings/worlds/edit-map.tsx'));

    expect($editor)
        ->toContain('bg-[var(--settings-input-background)]')
        ->toContain('border-[var(--settings-border-color)]')
        ->toContain('text-[var(--settings-muted-text)]')
        ->not->toContain('bg-white px-3 py-2 text-sm text-slate-950')
        ->not->toContain('text-slate-500 dark:text-slate-400');
});

test('palette preview tabs expose selection and keyboard navigation semantics', function () {
    $workbench = file_get_contents(resource_path('js/components/palette-workbench.tsx'));

    expect($workbench)
        ->toContain('role="tablist"')
        ->toContain('role="tab"')
        ->toContain('aria-selected={activePreview?.id === tab.id}')
        ->toContain("event.key === 'ArrowRight'")
        ->toContain("event.key === 'ArrowLeft'")
        ->toContain('focus-visible:ring-2')
        ->toContain('role="tabpanel"')
        ->toContain('tabIndex={0}');
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
