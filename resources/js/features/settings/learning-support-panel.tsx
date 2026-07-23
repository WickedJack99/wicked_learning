import { MessageSquareText, NotebookPen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    SettingsConfigurationLayout,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import AdminPanel, { type AdminPanelProps } from '@/pages/settings/admin-panel';
import JournalSettings, {
    type JournalSettingsProps,
} from '@/pages/settings/journal';

export type LearningSupportSection = 'admin-panel' | 'journal';

export type LearningSupportSettings = {
    adminPanel: Omit<AdminPanelProps, 'embedded'> | null;
    journal: Omit<JournalSettingsProps, 'embedded'> | null;
};

type Props = {
    activeSection: LearningSupportSection;
    canViewAdminPanel: boolean;
    canViewJournal: boolean;
    onSelectSection: (section: LearningSupportSection) => void;
    settings: LearningSupportSettings;
};

const sections = [
    {
        description: 'Feedback requests, topic thresholds and moderation.',
        icon: MessageSquareText,
        key: 'admin-panel',
        label: 'Admin Panel',
    },
    {
        description: 'Journal policy, background and interaction colors.',
        icon: NotebookPen,
        key: 'journal',
        label: 'Journal',
    },
] satisfies {
    description: string;
    icon: LucideIcon;
    key: LearningSupportSection;
    label: string;
}[];

export function LearningSupportPanel({
    activeSection,
    canViewAdminPanel,
    canViewJournal,
    onSelectSection,
    settings,
}: Props) {
    const visibleSections = sections.filter((section) =>
        section.key === 'journal' ? canViewJournal : canViewAdminPanel,
    );
    const resolvedSection = visibleSections.some(
        (section) => section.key === activeSection,
    )
        ? activeSection
        : visibleSections[0]?.key;

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

    return (
        <div className="h-full min-h-0 p-4">
            <SettingsConfigurationLayout
                className="h-full"
                sidebar={
                    <SettingsSidebar>
                        {visibleSections.map((section) => (
                            <SettingsSectionButton
                                active={resolvedSection === section.key}
                                description={section.description}
                                icon={section.icon}
                                id={section.key}
                                key={section.key}
                                label={section.label}
                                onSelect={onSelectSection}
                            />
                        ))}
                    </SettingsSidebar>
                }
            >
                {resolvedSection === 'admin-panel' && settings.adminPanel ? (
                    <AdminPanel {...settings.adminPanel} embedded />
                ) : null}

                {resolvedSection === 'journal' && settings.journal ? (
                    <JournalSettings {...settings.journal} embedded />
                ) : null}

                {resolvedSection === 'admin-panel' && !settings.adminPanel ? (
                    <UnavailableSection label="Admin Panel" />
                ) : null}

                {resolvedSection === 'journal' && !settings.journal ? (
                    <UnavailableSection label="Journal" />
                ) : null}
            </SettingsConfigurationLayout>
        </div>
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
