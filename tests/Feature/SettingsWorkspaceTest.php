<?php

test('settings keeps legacy panel links on current destinations', function () {
    $settingsIndex = file_get_contents(resource_path('js/pages/settings/index.tsx'));

    expect($settingsIndex)
        ->toContain("'admin-users': 'admin-access'")
        ->toContain("'admin-world': 'admin-world-builder'")
        ->toContain("'admin-presentation': 'admin-public-pages'")
        ->toContain("appearance: 'personal'")
        ->not->toContain('SettingsPlaceholderPanel');
});

test('settings shared navigation exposes semantic and keyboard-friendly controls', function () {
    $workspaceShell = file_get_contents(resource_path('js/features/settings/settings-workspace-shell.tsx'));
    $configurationShell = file_get_contents(resource_path('js/components/settings-configuration-shell.tsx'));
    $panelDirectory = file_get_contents(resource_path('js/features/settings/settings-panel-directory.tsx'));

    expect($workspaceShell)
        ->toContain('<h1 className="shrink-0')
        ->toContain("aria-label={t('navigation.source', 'Source code')}")
        ->toContain("active ? 'page' : undefined")
        ->and($configurationShell)
        ->toContain("event.key === 'ArrowRight'")
        ->toContain('tabIndex={activeSection === item.key ? 0 : -1}')
        ->and($panelDirectory)
        ->toContain('focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]');
});

test('settings navigation keeps the detail workspace reachable on small screens', function () {
    $workspaceShell = file_get_contents(resource_path('js/features/settings/settings-workspace-shell.tsx'));
    $cornerNavigation = file_get_contents(resource_path('js/features/settings/settings-corner-navigation.tsx'));

    expect($workspaceShell)
        ->toContain('id="settings-mobile-section"')
        ->toContain('<optgroup key={section.key} label={section.label}>')
        ->toContain('className="hidden min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-4 lg:block"')
        ->and($cornerNavigation)
        ->toContain('<details className="border-t border-[var(--settings-border-color)] lg:hidden">')
        ->toContain('Quick navigation');
});
