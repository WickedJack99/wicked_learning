import {
    BookOpenText,
    Flag,
    HeartHandshake,
    MessageSquareText,
    NotebookPen,
    Sparkles,
} from 'lucide-react';
import {
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import AdminPanel from '@/pages/settings/admin-panel';
import type {
    AdminPanelProps,
    AdminPanelSection,
} from '@/pages/settings/admin-panel';
import JournalSettings from '@/pages/settings/journal';
import type { JournalSettingsProps } from '@/pages/settings/journal';
import { LearnerMessageModerationPanel } from './learner-message-moderation-panel';
import type { LearnerMessageModerationTopic } from './learner-message-moderation-panel';
import { PlatformFeedbackSection } from './platform-feedback-section';
import type { PlatformFeedbackSectionProps } from './platform-feedback-section';
import { SupportSignalsPanel } from './support-signals-panel';
import type { SupportSignalsSettings } from './support-signals-panel';

export type LearningSupportSection =
    | AdminPanelSection
    | 'journal'
    | 'learner-messages'
    | 'platform-feedback'
    | 'support-signals';

export type LearningSupportSettings = {
    adminPanel: Omit<AdminPanelProps, 'embedded'> | null;
    journal: Omit<JournalSettingsProps, 'embedded'> | null;
    learnerMessages: { topics: LearnerMessageModerationTopic[] } | null;
    platformFeedback: PlatformFeedbackSectionProps | null;
    supportSignals: SupportSignalsSettings | null;
};

type Props = {
    activeSection: LearningSupportSection;
    canViewAdminPanel: boolean;
    canViewJournal: boolean;
    canViewLearnerMessages: boolean;
    canViewLearningConcepts: boolean;
    canViewPlatformFeedback: boolean;
    canViewSupportSignals: boolean;
    onSelectSection: (section: LearningSupportSection) => void;
    settings: LearningSupportSettings;
};

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

export function LearningSupportPanel({
    activeSection,
    canViewAdminPanel,
    canViewJournal,
    canViewLearnerMessages,
    canViewLearningConcepts,
    canViewPlatformFeedback,
    canViewSupportSignals,
    onSelectSection,
    settings,
}: Props) {
    const t = usePlatformTranslation();
    const localizedSections = sections.map((section) =>
        section.key === 'learner-messages'
            ? {
                  ...section,
                  description: t(
                      'settings.learner_messages.description',
                      section.description,
                  ),
                  label: t('settings.learner_messages.eyebrow', section.label),
              }
            : section,
    );
    const visibleSections = localizedSections.filter((section) =>
        section.key === 'journal'
            ? canViewJournal
            : section.key === 'learner-messages'
              ? canViewLearnerMessages
              : section.key === 'support-signals'
                ? canViewSupportSignals
                : section.key === 'learning-concepts'
                  ? canViewLearningConcepts
                  : section.key === 'platform-feedback'
                    ? canViewPlatformFeedback
                    : canViewAdminPanel,
    );
    const resolvedSection = visibleSections.some(
        (section) => section.key === activeSection,
    )
        ? activeSection
        : visibleSections[0]?.key;
    const resolvedSectionItem =
        visibleSections.find((section) => section.key === resolvedSection) ??
        visibleSections[0];

    if (!resolvedSection) {
        return (
            <section className="grid h-full place-items-center p-6 text-center">
                <p className="max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
                    No learning support settings are available with the current
                    permissions.
                </p>
            </section>
        );
    }

    const learningSupportItem: SettingsNavigationItem<'learning-support'> = {
        description:
            'Journal settings, reflection support and competence moderation.',
        icon: MessageSquareText,
        key: 'learning-support',
        label: 'Learning Support',
    };

    return (
        <SettingsNestedWorkspace
            contentClassName="p-0 sm:p-0"
            item={resolvedSectionItem ?? learningSupportItem}
            sidebar={
                <SettingsSectionNavigation
                    activeSection={resolvedSection}
                    ariaLabel="Learning support sections"
                    items={visibleSections}
                    onChange={onSelectSection}
                />
            }
        >
            {resolvedSection === 'support-signals' &&
            settings.supportSignals ? (
                <SupportSignalsPanel
                    sectionItem={resolvedSectionItem}
                    settings={settings.supportSignals}
                />
            ) : null}

            {resolvedSection === 'learner-messages' &&
            settings.learnerMessages ? (
                <LearnerMessageModerationPanel
                    topics={settings.learnerMessages.topics}
                />
            ) : null}

            {resolvedSection === 'platform-feedback' &&
            settings.platformFeedback ? (
                <PlatformFeedbackSection {...settings.platformFeedback} />
            ) : null}

            {resolvedSection !== 'journal' &&
            resolvedSection !== 'learner-messages' &&
            resolvedSection !== 'support-signals' &&
            resolvedSection !== 'platform-feedback' &&
            settings.adminPanel ? (
                <AdminPanel
                    {...settings.adminPanel}
                    activeSection={resolvedSection}
                    embedded
                    hideNavigation
                    onSelectSection={onSelectSection}
                />
            ) : null}

            {resolvedSection === 'journal' && settings.journal ? (
                <JournalSettings {...settings.journal} embedded />
            ) : null}

            {resolvedSection !== 'journal' &&
            resolvedSection !== 'learner-messages' &&
            resolvedSection !== 'support-signals' &&
            resolvedSection !== 'platform-feedback' &&
            !settings.adminPanel ? (
                <UnavailableSection label={resolvedSection} />
            ) : null}

            {resolvedSection === 'journal' && !settings.journal ? (
                <UnavailableSection label="Journal" />
            ) : null}

            {resolvedSection === 'support-signals' &&
            !settings.supportSignals ? (
                <UnavailableSection label="Support Signals" />
            ) : null}

            {resolvedSection === 'learner-messages' &&
            !settings.learnerMessages ? (
                <UnavailableSection label="Learner Messages" />
            ) : null}

            {resolvedSection === 'platform-feedback' &&
            !settings.platformFeedback ? (
                <UnavailableSection label="Platform Feedback" />
            ) : null}
        </SettingsNestedWorkspace>
    );
}

function UnavailableSection({ label }: { label: string }) {
    return (
        <section className="grid h-full place-items-center p-6 text-center">
            <p className="max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
                {label} settings are not available with the current permissions.
            </p>
        </section>
    );
}
