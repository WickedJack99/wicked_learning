import { MessageCircle, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router';

import {
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
    type SettingsNavigationItem,
} from './extracted-settings-configuration-shell';
import { settingsSections } from './extracted-settings-navigation';
import {
    SettingsSidebarNavigation,
    SettingsTopBar,
} from './extracted-settings-sidebar-navigation';
import { SettingsCornerNavigation } from './extracted-settings-corner-navigation';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

/** Extracted from `features/settings/learning-companion-settings-panel.tsx`. */
export type LearningCompanionSection = 'dialogues' | 'identity';

const sections = [
    {
        description: 'Name, avatar and the companion orientation message.',
        icon: UserRound,
        key: 'identity',
        label: 'Identity',
    },
    {
        description: 'Reusable, assigned and safely bounded dialogue graphs.',
        icon: MessageCircle,
        key: 'dialogues',
        label: 'Dialogues',
    },
] satisfies SettingsNavigationItem<LearningCompanionSection>[];

/**
 * Keeps the source Settings and Learning Companion navigators around the
 * existing CSRF-protected Rust authoring workflow.
 */
export function LearningCompanionSettingsShell({
    activeSection,
    appearance,
    children,
    onSignedOut,
    settingsAccess,
}: {
    activeSection: LearningCompanionSection;
    appearance: OriginalAppearance;
    children: ReactNode;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
    const navigate = useNavigate();
    const t = usePlatformTranslation();
    const [settingsMenuQuery, setSettingsMenuQuery] = useState('');
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
    const navigationSections = useMemo(
        () => settingsSections(t, accessCapabilities, true, settingsMenuQuery),
        [accessCapabilities, settingsMenuQuery, t],
    );
    const selectSection = (section: LearningCompanionSection): void => {
        navigate(`/settings?panel=admin-learning-companion&companion=${section}`);
    };

    return (
        <main
            className="settings-surface h-svh min-h-0 overflow-hidden bg-[var(--settings-content-background)] text-slate-950 dark:text-slate-100"
            style={learningCompanionSettingsStyle(appearance)}
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <SettingsTopBar menuQuery={settingsMenuQuery} onSearchChange={setSettingsMenuQuery} />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <aside className="flex shrink-0 flex-col border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] lg:w-72 lg:border-r lg:border-b-0">
                        <SettingsSidebarNavigation activePanel="admin-learning-companion" sections={navigationSections} />
                        <SettingsCornerNavigation onSignedOut={onSignedOut} />
                    </aside>
                    <div className="min-h-0 flex-1 overflow-hidden bg-[var(--settings-content-background)]">
                        <SettingsNestedWorkspace
                            contentClassName="p-0 sm:p-0"
                            sidebar={<>
                                <label className="grid gap-2 px-1 text-xs font-medium tracking-[0.16em] text-[var(--settings-muted-text)] uppercase lg:hidden">
                                    <span>Learning Companion section</span>
                                    <select aria-label="Learning Companion section" className="h-10 w-full border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 text-sm normal-case tracking-normal text-[var(--settings-primary-text)]" onChange={(event) => selectSection(event.currentTarget.value as LearningCompanionSection)} value={activeSection}>
                                        {sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}
                                    </select>
                                </label>
                                <div className="hidden lg:block">
                                    <SettingsSectionNavigation activeSection={activeSection} ariaLabel="Learning Companion sections" items={sections} onChange={selectSection} />
                                </div>
                            </>}
                        >
                            {children}
                        </SettingsNestedWorkspace>
                    </div>
                </div>
            </div>
        </main>
    );
}

function learningCompanionSettingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';

    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-accent-color': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark ? 'rgb(45 212 191 / 10%)' : 'rgb(15 118 110 / 10%)',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-input-background': dark ? 'rgb(2 6 23 / 38%)' : '#ffffff',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-nested-sidebar-background': dark ? 'rgb(5 8 22 / 96%)' : 'rgb(248 250 252 / 96%)',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
        '--settings-primary-text': dark ? '#f8fafc' : '#0f172a',
        '--settings-sidebar-background': dark ? 'rgb(5 8 22 / 96%)' : 'rgb(248 250 252 / 96%)',
    } as CSSProperties;
}
