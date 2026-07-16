import { Head } from '@inertiajs/react';
import {
    Bell,
    Brush,
    KeyRound,
    Languages,
    Trash2,
    UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import DeleteUser from '@/components/delete-user';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionNavigation,
    SettingsSidebar,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import { AppearanceSettingsPanel } from '@/features/settings/appearance-settings-panel';
import { LanguageSettingsPanel } from '@/features/settings/language-settings-panel';
import { ProfileSettingsPanel } from '@/features/settings/profile-settings-panel';
import {
    SecuritySettingsPanel,
    type SecuritySettingsProps,
} from '@/features/settings/security-settings-panel';

type PersonalSection =
    | 'appearance'
    | 'delete-account'
    | 'language'
    | 'notifications'
    | 'profile'
    | 'security';

const personalSections: SettingsNavigationItem<PersonalSection>[] = [
    {
        description: 'Identity and account details.',
        icon: UserRound,
        key: 'profile',
        label: 'Profile',
    },
    {
        description: 'Light and dark appearance.',
        icon: Brush,
        key: 'appearance',
        label: 'Appearance',
    },
    {
        description: 'Platform and learner copy.',
        icon: Languages,
        key: 'language',
        label: 'Language',
    },
    {
        description: 'Future reminders and quiet hours.',
        icon: Bell,
        key: 'notifications',
        label: 'Notifications',
    },
    {
        description: 'Password, two-factor and passkeys.',
        icon: KeyRound,
        key: 'security',
        label: 'Security',
    },
    {
        danger: true,
        description: 'Permanently remove your account.',
        icon: Trash2,
        key: 'delete-account',
        label: 'Delete account',
    },
];

type AvailableLanguage = {
    code: string;
    name: string;
    nativeName: string;
};

type PersonalSettingsProps = {
    availableLanguages: AvailableLanguage[];
    initialSection: PersonalSection;
    locale: string;
    mustVerifyEmail: boolean;
    status?: string;
} & SecuritySettingsProps;

export default function PersonalSettings({
    availableLanguages,
    initialSection,
    locale,
    mustVerifyEmail,
    status,
    ...security
}: PersonalSettingsProps) {
    const [section, setSection] = useState<PersonalSection>(initialSection);

    useEffect(() => setSection(initialSection), [initialSection]);

    return (
        <>
            <Head title="Personal settings" />
            <SettingsConfigurationShell
                eyebrow="Personal"
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionNavigation
                            activeSection={section}
                            ariaLabel="Personal settings sections"
                            items={personalSections}
                            onChange={setSection}
                        />
                    </SettingsSidebar>
                }
                title="Personal settings"
            >
                <SettingsContentPane>
                    {section === 'profile' ? (
                        <ProfileSettingsPanel
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                        />
                    ) : null}
                    {section === 'appearance' ? (
                        <AppearanceSettingsPanel />
                    ) : null}
                    {section === 'language' ? (
                        <LanguageSettingsPanel
                            availableLanguages={availableLanguages}
                            locale={locale}
                        />
                    ) : null}
                    {section === 'notifications' ? (
                        <NotificationsPanel />
                    ) : null}
                    {section === 'security' ? (
                        <SecuritySettingsPanel {...security} />
                    ) : null}
                    {section === 'delete-account' ? (
                        <DeleteAccountPanel />
                    ) : null}
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

function DeleteAccountPanel() {
    return (
        <section className="rounded-2xl border border-red-200 bg-red-50/70 p-5 dark:border-red-400/20 dark:bg-red-950/15">
            <DeleteUser />
        </section>
    );
}

function NotificationsPanel() {
    return (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div>
                <p
                    className="text-xs font-medium tracking-[0.18em] uppercase"
                    style={{ color: 'var(--settings-accent)' }}
                >
                    Notifications
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                    Communication preferences
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    This area will hold optional reminders, quiet hours and
                    communication preferences. It will remain opt-in and avoid
                    pressure-based learning loops.
                </p>
            </div>
        </section>
    );
}
