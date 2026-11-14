import {
    BookOpenText,
    Flag,
    HeartHandshake,
    MessageSquareText,
    NotebookPen,
    Sparkles,
} from 'lucide-react';
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

/**
 * Extracted from `resources/js/features/settings/learning-support-panel.tsx`.
 * The parent Learning Support navigator stays shared by every lifted child
 * workspace; a compact selector preserves that source hierarchy on narrow
 * Settings layouts.
 */
export type LearningSupportSection =
    | 'competence-topics'
    | 'feedback-requests'
    | 'journal'
    | 'learner-messages'
    | 'learning-concepts'
    | 'organization-icons'
    | 'platform-feedback'
    | 'support-signals';

const sections = [
    {
        description:
            'Review short messages shared through MapAsset activities.',
        icon: MessageSquareText,
        key: 'learner-messages',
        label: 'Learner Messages',
    },
    {
        description: 'Read scoped learner signals as prompts for support.',
        icon: HeartHandshake,
        key: 'support-signals',
        label: 'Support Signals',
    },
    {
        description: 'Review learner journal feedback requests.',
        icon: MessageSquareText,
        key: 'feedback-requests',
        label: 'Feedback',
    },
    {
        description: 'Review feedback deliberately shared about the platform.',
        icon: MessageSquareText,
        key: 'platform-feedback',
        label: 'Platform Feedback',
    },
    {
        description: 'Review reported icons and organization limits.',
        icon: Flag,
        key: 'organization-icons',
        label: 'Organization Icons',
    },
    {
        description: 'Define topics and star-map thresholds.',
        icon: Sparkles,
        key: 'competence-topics',
        label: 'Competence Topics',
    },
    {
        description: 'Maintain reusable vocabulary for evidence authoring.',
        icon: BookOpenText,
        key: 'learning-concepts',
        label: 'Concept Library',
    },
    {
        description: 'Journal policy, background and interaction colors.',
        icon: NotebookPen,
        key: 'journal',
        label: 'Journal',
    },
] satisfies SettingsNavigationItem<LearningSupportSection>[];

export function LearningSupportWorkspace({
    activeSection,
    children,
    settingsAccess,
}: {
    activeSection: LearningSupportSection;
    children: ReactNode;
    settingsAccess: Record<string, boolean>;
}) {
    const navigate = useNavigate();
    const t = usePlatformTranslation();
    const visibleSections = useMemo(
        () => visibleLearningSupportSections(settingsAccess, t),
        [settingsAccess, t],
    );
    const resolvedSection = visibleSections.some(
        (section) => section.key === activeSection,
    )
        ? activeSection
        : visibleSections[0]?.key;

    return (
        <SettingsNestedWorkspace
            contentClassName="p-0 sm:p-0"
            sidebar={
                <>
                    <label className="grid gap-2 px-1 text-xs font-medium tracking-[0.16em] text-[var(--settings-muted-text)] uppercase lg:hidden">
                        <span>
                            {t(
                                'settings.learning_support.navigation.selector_label',
                                'Learning support section',
                            )}
                        </span>
                        <select
                            aria-label={t(
                                'settings.learning_support.navigation.selector_label',
                                'Learning support section',
                            )}
                            className="h-10 w-full border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 text-sm normal-case tracking-normal text-[var(--settings-primary-text)]"
                            onChange={(event) =>
                                navigate(
                                    `/settings?panel=admin-learning-support&support=${event.currentTarget.value}`,
                                )
                            }
                            value={resolvedSection}
                        >
                            {visibleSections.map((section) => (
                                <option key={section.key} value={section.key}>
                                    {section.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="hidden lg:block">
                        <SettingsSectionNavigation
                            activeSection={resolvedSection ?? activeSection}
                            ariaLabel={t(
                                'settings.learning_support.navigation.sections_label',
                                'Learning support sections',
                            )}
                            items={visibleSections}
                            onChange={(section) =>
                                navigate(
                                    `/settings?panel=admin-learning-support&support=${section}`,
                                )
                            }
                        />
                    </div>
                </>
            }
        >
            {children}
        </SettingsNestedWorkspace>
    );
}

/**
 * Source composition from the Settings workspace and LearningSupportPanel.
 * Distinct routed child workspaces use this instead of recreating a second
 * Learning Support page frame around their typed Rust transport.
 */
export function LearningSupportSettingsShell({
    activeSection,
    appearance,
    children,
    onSignedOut,
    settingsAccess,
}: {
    activeSection: LearningSupportSection;
    appearance: OriginalAppearance;
    children: ReactNode;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
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

    return (
        <main
            className="settings-surface h-svh min-h-0 overflow-hidden bg-[var(--settings-content-background)] text-slate-950 dark:text-slate-100"
            style={learningSupportSettingsStyle(appearance)}
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <SettingsTopBar
                    menuQuery={settingsMenuQuery}
                    onSearchChange={setSettingsMenuQuery}
                />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <aside className="flex shrink-0 flex-col border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] lg:w-72 lg:border-r lg:border-b-0">
                        <SettingsSidebarNavigation
                            activePanel="admin-learning-support"
                            sections={navigationSections}
                        />
                        <SettingsCornerNavigation onSignedOut={onSignedOut} />
                    </aside>
                    <div className="min-h-0 flex-1 overflow-hidden bg-[var(--settings-content-background)]">
                        <LearningSupportWorkspace
                            activeSection={activeSection}
                            settingsAccess={settingsAccess}
                        >
                            {children}
                        </LearningSupportWorkspace>
                    </div>
                </div>
            </div>
        </main>
    );
}

function visibleLearningSupportSections(
    settingsAccess: Record<string, boolean>,
    t: ReturnType<typeof usePlatformTranslation>,
): SettingsNavigationItem<LearningSupportSection>[] {
    const canRead = (resource: string): boolean => settingsAccess[resource] === true;

    return sections
        .map((section) => ({
            ...section,
            description: t(
                `settings.learning_support.navigation.${section.key}.description`,
                section.description,
            ),
            label: t(
                `settings.learning_support.navigation.${section.key}.label`,
                section.label,
            ),
        }))
        .filter((section) =>
            section.key === 'journal'
                ? canRead('journal_settings')
                : section.key === 'learner-messages'
                  ? true
                  : section.key === 'support-signals'
                    ? canRead('learner_support_signals')
                    : section.key === 'learning-concepts'
                      ? canRead('learning_concepts')
                      : section.key === 'platform-feedback'
                        ? canRead('platform_feedback')
                        : section.key === 'feedback-requests'
                          ? canRead('journal_feedback')
                          : section.key === 'organization-icons'
                            ? canRead('organization_moderation')
                            : canRead('competence_topics'),
        );
}

function learningSupportSettingsStyle(
    appearance: OriginalAppearance,
): CSSProperties {
    const dark = appearance === 'dark';

    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-accent-color': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark
            ? 'rgb(45 212 191 / 10%)'
            : 'rgb(15 118 110 / 10%)',
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
