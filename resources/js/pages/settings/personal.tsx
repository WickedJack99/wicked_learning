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
    SettingsFormColumn,
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
    SettingsSaveButton,
    type SettingsSaveAction,
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

export function PersonalSettingsContent({
    activeSection,
    availableLanguages,
    initialSection,
    locale,
    mustVerifyEmail,
    onSelectSection,
    soundPreferences,
    status,
    ...security
}: PersonalSettingsProps & {
    activeSection?: PersonalSection;
    onSelectSection?: (section: PersonalSection) => void;
}) {
    const t = usePlatformTranslation();
    const [section, setSection] = useState<PersonalSection>(initialSection);
    const [saveAction, setSaveAction] = useState<SettingsSaveAction | null>(
        null,
    );
    const resolvedSection = activeSection ?? section;

    useEffect(() => setSection(initialSection), [initialSection]);
    useEffect(() => setSaveAction(null), [resolvedSection]);

    const selectSection = (nextSection: PersonalSection) => {
        if (!activeSection) {
            setSection(nextSection);
        }

        onSelectSection?.(nextSection);
    };

    return (
        <SettingsNestedWorkspace
            action={<SettingsSaveButton action={saveAction} />}
            description={t(
                'settings.personal.description',
                'Profile, appearance, language, notifications and account safety.',
            )}
            icon={UserRound}
            sidebar={
                <PersonalSettingsSectionNavigation
                    activeSection={resolvedSection}
                    onChange={selectSection}
                />
            }
            title={t('settings.personal.title_short', 'Personal')}
        >
            <PersonalSettingsSectionContent
                availableLanguages={availableLanguages}
                locale={locale}
                mustVerifyEmail={mustVerifyEmail}
                onSaveActionChange={setSaveAction}
                soundPreferences={soundPreferences}
                status={status}
                activeSection={resolvedSection}
                {...security}
            />
        </SettingsNestedWorkspace>
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
    onSaveActionChange,
    soundPreferences,
    status,
    ...security
}: Omit<PersonalSettingsProps, 'initialSection'> & {
    activeSection: PersonalSection;
    onSaveActionChange: (action: SettingsSaveAction | null) => void;
}) {
    return (
        <>
            {activeSection === 'profile' ? (
                <ProfileSettingsPanel
                    formId="personal-profile-form"
                    hideSaveButton
                    mustVerifyEmail={mustVerifyEmail}
                    onSaveActionChange={onSaveActionChange}
                    status={status}
                />
            ) : null}
            {activeSection === 'appearance' ? (
                <AppearanceSettingsPanel />
            ) : null}
            {activeSection === 'language' ? (
                <LanguageSettingsPanel
                    availableLanguages={availableLanguages}
                    hideSaveButton
                    locale={locale}
                    onSaveActionChange={onSaveActionChange}
                />
            ) : null}
            {activeSection === 'notifications' ? <NotificationsPanel /> : null}
            {activeSection === 'sound' ? (
                <SoundSettingsPanel
                    hideSaveButton
                    onSaveActionChange={onSaveActionChange}
                    preferences={soundPreferences}
                />
            ) : null}
            {activeSection === 'security' ? (
                <SecuritySettingsPanel
                    {...security}
                    formId="personal-security-form"
                    hideSaveButton
                    onSaveActionChange={onSaveActionChange}
                />
            ) : null}
            {activeSection === 'delete-account' ? <DeleteAccountPanel /> : null}
        </>
    );
}

function DeleteAccountPanel() {
    return (
        <SettingsFormColumn>
            <section className="border-t border-red-400/30 pt-5">
                <DeleteUser />
            </section>
        </SettingsFormColumn>
    );
}

function NotificationsPanel() {
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-4">
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
