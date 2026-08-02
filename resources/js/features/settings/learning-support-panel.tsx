import {
    Flag,
    HeartHandshake,
    MessageSquareText,
    NotebookPen,
    Sparkles,
} from 'lucide-react';
import {
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import AdminPanel, {
    type AdminPanelProps,
    type AdminPanelSection,
} from '@/pages/settings/admin-panel';
import JournalSettings, {
    type JournalSettingsProps,
} from '@/pages/settings/journal';
import {
    SupportSignalsPanel,
    type SupportSignalsSettings,
} from './support-signals-panel';

export type LearningSupportSection =
    | AdminPanelSection
    | 'journal'
    | 'support-signals';

export type LearningSupportSettings = {
    adminPanel: Omit<AdminPanelProps, 'embedded'> | null;
    journal: Omit<JournalSettingsProps, 'embedded'> | null;
    supportSignals: SupportSignalsSettings | null;
};

type Props = {
    activeSection: LearningSupportSection;
    canViewAdminPanel: boolean;
    canViewJournal: boolean;
    canViewSupportSignals: boolean;
    onSelectSection: (section: LearningSupportSection) => void;
    settings: LearningSupportSettings;
};

const sections = [
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
    canViewSupportSignals,
    onSelectSection,
    settings,
}: Props) {
    const visibleSections = sections.filter((section) =>
        section.key === 'journal'
            ? canViewJournal
            : section.key === 'support-signals'
              ? canViewSupportSignals
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
            item={learningSupportItem}
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

            {resolvedSection !== 'journal' &&
            resolvedSection !== 'support-signals' &&
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
            resolvedSection !== 'support-signals' &&
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
