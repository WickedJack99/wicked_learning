import { useNavigate } from 'react-router';

import type {
    SettingsListItem,
    SettingsNavigationSection,
    SettingsPanelKey,
} from './extracted-settings-navigation';
import { usePlatformTranslation } from './original-platform-translation';

/** Extracted from resources/js/features/settings/settings-workspace-shell.tsx. */
export function SettingsSidebarNavigation({
    activePanel,
    sections,
}: {
    activePanel: SettingsPanelKey;
    sections: SettingsNavigationSection[];
}) {
    const navigate = useNavigate();
    const t = usePlatformTranslation();
    const openItem = (item: SettingsListItem) =>
        navigate(`/settings?panel=${item.key}`);

    return (
        <>
            <div className="border-b border-[var(--settings-border-color)] px-3 pt-3 pb-3 lg:hidden">
                <label
                    className="px-1 text-xs font-medium tracking-[0.16em] text-[var(--settings-muted-text)] uppercase"
                    htmlFor="settings-mobile-section"
                >
                    {t('settings.navigation.area', 'Settings area')}
                </label>
                <select
                    aria-label={t('settings.navigation.area', 'Settings area')}
                    className="mt-2 h-10 w-full rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] px-3 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:text-white"
                    id="settings-mobile-section"
                    onChange={(event) => {
                        const item = sections
                            .flatMap((section) => section.items)
                            .find(
                                (candidate) =>
                                    candidate.key === event.currentTarget.value,
                            );
                        if (item) openItem(item);
                    }}
                    value={activePanel}
                >
                    {sections.map((section) => (
                        <optgroup key={section.key} label={section.label}>
                            {section.items.map((item) => (
                                <option key={item.key} value={item.key}>
                                    {t(item.labelKey, item.label)}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>
            <nav
                aria-label={t(
                    'settings.navigation.label',
                    'Settings navigation',
                )}
                className="hidden min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-4 lg:block"
            >
                {sections.map((section) => (
                    <section
                        aria-labelledby={`settings-section-${section.key}`}
                        className="mb-5"
                        key={section.key}
                    >
                        <h2
                            className="mb-2 px-2 text-xs font-medium tracking-[0.16em] text-[var(--settings-muted-text)] uppercase"
                            id={`settings-section-${section.key}`}
                        >
                            {section.label}
                        </h2>
                        <div className="grid gap-2">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const active = item.key === activePanel;
                                return (
                                    <button
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={[
                                            'relative grid h-12 grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-lg px-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                                            active
                                                ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                                : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                                        ].join(' ')}
                                        key={item.key}
                                        onClick={() => openItem(item)}
                                        type="button"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={[
                                                'absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--settings-accent)] transition-opacity',
                                                active
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                            ].join(' ')}
                                        />
                                        <Icon className="size-4" />
                                        <span className="truncate">
                                            {t(item.labelKey, item.label)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </nav>
        </>
    );
}
