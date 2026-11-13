import {
    BookOpenText,
    Flag,
    HeartHandshake,
    MessageSquareText,
    NotebookPen,
    Sparkles,
} from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import {
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
    type SettingsNavigationItem,
} from './extracted-settings-configuration-shell';
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
                        <span>Learning support section</span>
                        <select
                            aria-label="Learning support section"
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
                            ariaLabel="Learning support sections"
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

function visibleLearningSupportSections(
    settingsAccess: Record<string, boolean>,
    t: ReturnType<typeof usePlatformTranslation>,
): SettingsNavigationItem<LearningSupportSection>[] {
    const canRead = (resource: string): boolean => settingsAccess[resource] === true;

    return sections
        .map((section) =>
            section.key === 'learner-messages'
                ? {
                      ...section,
                      description: t(
                          'settings.learner_messages.description',
                          section.description,
                      ),
                      label: t(
                          'settings.learner_messages.eyebrow',
                          section.label,
                      ),
                  }
                : section,
        )
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
