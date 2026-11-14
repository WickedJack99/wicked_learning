import {
    type CSSProperties,
    type ReactNode,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { apiClient } from './api/client';
import type { components } from './api/schema';
import { useCurrentUser } from './current-user';
import { SettingsNestedWorkspace } from './extracted-settings-configuration-shell';
import { SettingsCornerNavigation } from './extracted-settings-corner-navigation';
import { settingsSections } from './extracted-settings-navigation';
import {
    SettingsSidebarNavigation,
    SettingsTopBar,
} from './extracted-settings-sidebar-navigation';
import type { OriginalAppearance } from './original-appearance';
import {
    OriginalPersonalSettingsNavigation,
    type PersonalSettingsSection,
} from './original-personal-settings-navigation';
import { usePlatformTranslation } from './original-platform-translation';
import { settingsPresentationStyle } from './public-presentation';

/**
 * The source Settings page keeps its global Settings chrome around the nested
 * Personal workspace. Individual Personal panels supply only their source
 * panel content; this shell preserves the shared top bar, Settings menu,
 * quick navigation and responsive nested-section layout.
 */
export function OriginalPersonalSettingsShell({
    activeSection,
    appearance,
    children,
    footerAction,
}: {
    activeSection: PersonalSettingsSection;
    appearance: OriginalAppearance;
    children: ReactNode;
    footerAction?: ReactNode;
}) {
    const { currentUser, setCurrentUser } = useCurrentUser();
    const t = usePlatformTranslation();
    const [settingsMenuQuery, setSettingsMenuQuery] = useState('');
    const [presentation, setPresentation] =
        useState<components['schemas']['PublicPresentation'] | null>(null);
    const settingsAccess =
        currentUser.kind === 'loaded' ? currentUser.settingsAccess : {};
    const accessCapabilities = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(settingsAccess).map(([key, read]) => [
                    key,
                    { delete: false, read, update: false },
                ]),
            ),
        [settingsAccess],
    );
    const canAccessAdministration = Object.values(settingsAccess).some(
        (read) => read,
    );
    const navigationSections = useMemo(
        () =>
            settingsSections(
                t,
                accessCapabilities,
                canAccessAdministration,
                settingsMenuQuery,
            ),
        [
            accessCapabilities,
            canAccessAdministration,
            settingsMenuQuery,
            t,
        ],
    );

    useEffect(() => {
        let active = true;

        void apiClient
            .GET('/public/presentation')
            .then(({ data, response }) => {
                if (active && response.ok && data) {
                    setPresentation(data);
                }
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, []);

    return (
        <main
            className="settings-surface h-svh min-h-0 overflow-hidden bg-[var(--settings-content-background)] text-slate-950 dark:text-slate-100"
            style={
                presentation?.settings_palette
                    ? settingsPresentationStyle(presentation, appearance)
                    : personalSettingsStyle(appearance)
            }
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <SettingsTopBar
                    menuQuery={settingsMenuQuery}
                    onSearchChange={setSettingsMenuQuery}
                />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <aside className="flex shrink-0 flex-col border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] lg:w-72 lg:border-r lg:border-b-0">
                        <SettingsSidebarNavigation
                            activePanel="personal"
                            sections={navigationSections}
                        />
                        <SettingsCornerNavigation
                            onSignedOut={() =>
                                setCurrentUser({ kind: 'anonymous' })
                            }
                        />
                    </aside>
                    <div className="min-h-0 flex-1 overflow-hidden bg-[var(--settings-content-background)]">
                        <SettingsNestedWorkspace
                            footerAction={footerAction}
                            sidebar={
                                <OriginalPersonalSettingsNavigation
                                    activeSection={activeSection}
                                    bare
                                />
                            }
                        >
                            {children}
                        </SettingsNestedWorkspace>
                    </div>
                </div>
            </div>
        </main>
    );
}

export function personalSettingsStyle(
    appearance: OriginalAppearance,
): CSSProperties {
    const dark = appearance === 'dark';

    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-accent-color': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark
            ? 'rgb(45 212 191 / 10%)'
            : 'rgb(15 118 110 / 10%)',
        '--settings-appearance-switch-active-background': dark
            ? '#111820'
            : '#ffffff',
        '--settings-appearance-switch-active-text': dark ? '#5eead4' : '#0f766e',
        '--settings-appearance-switch-background': dark
            ? 'rgba(255,255,255,0.06)'
            : '#f1f5f9',
        '--settings-appearance-switch-inactive-text': dark
            ? '#94a3b8'
            : '#64748b',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-input-background': dark ? 'rgb(2 6 23 / 38%)' : '#ffffff',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-nested-sidebar-background': dark
            ? 'rgb(5 8 22 / 96%)'
            : 'rgb(248 250 252 / 96%)',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
        '--settings-primary-text': dark ? '#f8fafc' : '#0f172a',
        '--settings-sidebar-background': dark
            ? 'rgb(5 8 22 / 96%)'
            : 'rgb(248 250 252 / 96%)',
    } as CSSProperties;
}
