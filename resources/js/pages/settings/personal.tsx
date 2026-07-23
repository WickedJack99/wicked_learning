import { Head } from '@inertiajs/react';
import {
    Bell,
    Brush,
    KeyRound,
    Languages,
    Trash2,
    UserRound,
    Volume2,
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
import { SoundSettingsPanel } from '@/features/settings/sound-settings-panel';
import { type SoundPreferences } from '@/features/sounds/sound-player';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type PersonalSection =
    | 'appearance'
    | 'delete-account'
    | 'language'
    | 'notifications'
    | 'profile'
    | 'security'
    | 'sound';

export type AvailableLanguage = {
    code: string;
    name: string;
    nativeName: string;
};

function buildPersonalSections(
    t: ReturnType<typeof usePlatformTranslation>,
): SettingsNavigationItem<PersonalSection>[] {
    return [
        {
            description: t(
                'settings.personal.sections.profile.description',
                'Identity and account details.',
            ),
            icon: UserRound,
            key: 'profile',
            label: t('settings.personal.sections.profile', 'Profile'),
        },
        {
            description: t(
                'settings.personal.sections.appearance.description',
                'Light and dark appearance.',
            ),
            icon: Brush,
            key: 'appearance',
            label: t('settings.personal.sections.appearance', 'Appearance'),
        },
        {
            description: t(
                'settings.personal.sections.language.description',
                'Platform and learner copy.',
            ),
            icon: Languages,
            key: 'language',
            label: t('settings.personal.sections.language', 'Language'),
        },
        {
            description: t(
                'settings.personal.sections.notifications.description',
                'Future reminders and quiet hours.',
            ),
            icon: Bell,
            key: 'notifications',
            label: t(
                'settings.personal.sections.notifications',
                'Notifications',
            ),
        },
        {
            description: t(
                'settings.personal.sections.sound.description',
                'Sound effects and ambient audio.',
            ),
            icon: Volume2,
            key: 'sound',
            label: t('settings.personal.sections.sound', 'Sound'),
        },
        {
            description: t(
                'settings.personal.sections.security.description',
                'Password, two-factor and passkeys.',
            ),
            icon: KeyRound,
            key: 'security',
            label: t('settings.personal.sections.security', 'Security'),
        },
        {
            danger: true,
            description: t(
                'settings.personal.sections.delete_account.description',
                'Permanently remove your account.',
            ),
            icon: Trash2,
            key: 'delete-account',
            label: t(
                'settings.personal.sections.delete_account',
                'Delete account',
            ),
        },
    ];
}

export type PersonalSettingsProps = {
    availableLanguages: AvailableLanguage[];
    initialSection: PersonalSection;
    locale: string;
    mustVerifyEmail: boolean;
    soundPreferences: SoundPreferences;
    status?: string;
} & SecuritySettingsProps;

export default function PersonalSettings({
    initialSection,
    ...props
}: PersonalSettingsProps) {
    const t = usePlatformTranslation();
    const [section, setSection] = useState<PersonalSection>(initialSection);

    useEffect(() => setSection(initialSection), [initialSection]);

    return (
        <>
            <Head title={t('settings.personal.title', 'Personal settings')} />
            <SettingsConfigurationShell
                eyebrow={t('settings.personal.eyebrow', 'Personal')}
                sidebar={
                    <SettingsSidebar>
                        <PersonalSettingsSectionNavigation
                            activeSection={section}
                            onChange={setSection}
                        />
                    </SettingsSidebar>
                }
                title={t('settings.personal.title', 'Personal settings')}
            >
                <SettingsContentPane>
                    <PersonalSettingsSectionContent
                        {...props}
                        activeSection={section}
                    />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

export function PersonalSettingsContent({
    availableLanguages,
    initialSection,
    locale,
    mustVerifyEmail,
    soundPreferences,
    status,
    ...security
}: PersonalSettingsProps) {
    const [section, setSection] = useState<PersonalSection>(initialSection);

    useEffect(() => setSection(initialSection), [initialSection]);

    return (
        <div className="grid h-full min-h-0 gap-4 p-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <PersonalSettingsSectionNavigation
                activeSection={section}
                onChange={setSection}
            />

            <SettingsContentPane>
                <PersonalSettingsSectionContent
                    availableLanguages={availableLanguages}
                    locale={locale}
                    mustVerifyEmail={mustVerifyEmail}
                    soundPreferences={soundPreferences}
                    status={status}
                    activeSection={section}
                    {...security}
                />
            </SettingsContentPane>
        </div>
    );
}

function PersonalSettingsSectionNavigation({
    activeSection,
    onChange,
}: {
    activeSection: PersonalSection;
    onChange: (section: PersonalSection) => void;
}) {
    const t = usePlatformTranslation();

    return (
        <SettingsSectionNavigation
            activeSection={activeSection}
            ariaLabel={t(
                'settings.personal.sections.aria',
                'Personal settings sections',
            )}
            items={buildPersonalSections(t)}
            onChange={onChange}
        />
    );
}

function PersonalSettingsSectionContent({
    activeSection,
    availableLanguages,
    locale,
    mustVerifyEmail,
    soundPreferences,
    status,
    ...security
}: Omit<PersonalSettingsProps, 'initialSection'> & {
    activeSection: PersonalSection;
}) {
    return (
        <>
            {activeSection === 'profile' ? (
                <ProfileSettingsPanel
                    mustVerifyEmail={mustVerifyEmail}
                    status={status}
                />
            ) : null}
            {activeSection === 'appearance' ? (
                <AppearanceSettingsPanel />
            ) : null}
            {activeSection === 'language' ? (
                <LanguageSettingsPanel
                    availableLanguages={availableLanguages}
                    locale={locale}
                />
            ) : null}
            {activeSection === 'notifications' ? <NotificationsPanel /> : null}
            {activeSection === 'sound' ? (
                <SoundSettingsPanel preferences={soundPreferences} />
            ) : null}
            {activeSection === 'security' ? (
                <SecuritySettingsPanel {...security} />
            ) : null}
            {activeSection === 'delete-account' ? <DeleteAccountPanel /> : null}
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
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div>
                <p
                    className="text-xs font-medium tracking-[0.18em] uppercase"
                    style={{ color: 'var(--settings-accent)' }}
                >
                    {t(
                        'settings.personal.notifications.eyebrow',
                        'Notifications',
                    )}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                    {t(
                        'settings.personal.notifications.title',
                        'Communication preferences',
                    )}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.personal.notifications.description',
                        'This area will hold optional reminders, quiet hours and communication preferences. It will remain opt-in and avoid pressure-based learning loops.',
                    )}
                </p>
            </div>
        </section>
    );
}
