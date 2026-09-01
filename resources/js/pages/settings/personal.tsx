import { Link, router } from '@inertiajs/react';
import {
    Bell,
    Brush,
    KeyRound,
    Languages,
    MessageSquareText,
    Trash2,
    UserRound,
    Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import DeleteUser from '@/components/delete-user';
import {
    SettingsFormColumn,
    SettingsItemPanelHeader,
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
    SettingsSaveButton,
    type SettingsSaveAction,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
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
    | 'feedback'
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
                'settings.personal.sections.feedback.description',
                'Share thoughts about the platform and manage invitations.',
            ),
            icon: MessageSquareText,
            key: 'feedback',
            label: t('settings.personal.sections.feedback', 'Feedback'),
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
    feedbackPromptStatus: 'declined' | 'enabled' | 'snoozed';
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
    feedbackPromptStatus,
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
    const personalItem: SettingsNavigationItem<'personal'> = {
        description: t(
            'settings.personal.description',
            'Profile, appearance, language, notifications and account safety.',
        ),
        icon: UserRound,
        key: 'personal',
        label: t('settings.personal.title_short', 'Personal'),
    };
    const sectionItems = buildPersonalSections(t);
    const activeSectionItem =
        sectionItems.find((item) => item.key === resolvedSection) ??
        sectionItems[0];
    const resolvedSaveAction =
        saveAction ??
        (resolvedSection === 'profile'
            ? {
                  form: 'personal-profile-form',
                  label: t('common.save', 'Save'),
              }
            : null);
    useEffect(() => setSection(initialSection), [initialSection]);

    const selectSection = (nextSection: PersonalSection) => {
        setSaveAction(null);

        if (!activeSection) {
            setSection(nextSection);
        }

        onSelectSection?.(nextSection);
    };

    return (
        <SettingsNestedWorkspace
            footerAction={
                resolvedSaveAction ? (
                    <div className="w-full lg:max-w-[45%] [&_button]:w-full">
                        <SettingsSaveButton action={resolvedSaveAction} />
                    </div>
                ) : undefined
            }
            item={activeSectionItem ?? personalItem}
            sidebar={
                <PersonalSettingsSectionNavigation
                    activeSection={resolvedSection}
                    items={sectionItems}
                    onChange={selectSection}
                />
            }
        >
            <PersonalSettingsSectionContent
                activeItem={activeSectionItem}
                availableLanguages={availableLanguages}
                locale={locale}
                mustVerifyEmail={mustVerifyEmail}
                onSaveActionChange={setSaveAction}
                soundPreferences={soundPreferences}
                status={status}
                feedbackPromptStatus={feedbackPromptStatus}
                activeSection={resolvedSection}
                {...security}
            />
        </SettingsNestedWorkspace>
    );
}

function PersonalSettingsSectionNavigation({
    activeSection,
    items,
    onChange,
}: {
    activeSection: PersonalSection;
    items: SettingsNavigationItem<PersonalSection>[];
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
            items={items}
            onChange={onChange}
        />
    );
}

function PersonalSettingsSectionContent({
    activeSection,
    activeItem,
    availableLanguages,
    locale,
    mustVerifyEmail,
    onSaveActionChange,
    soundPreferences,
    status,
    feedbackPromptStatus,
    ...security
}: Omit<PersonalSettingsProps, 'initialSection'> & {
    activeSection: PersonalSection;
    activeItem: SettingsNavigationItem<PersonalSection>;
    onSaveActionChange?: (action: SettingsSaveAction | null) => void;
}) {
    return (
        <>
            {activeSection === 'profile' ? (
                <ProfileSettingsPanel
                    formId="personal-profile-form"
                    headingItem={activeItem}
                    hideSaveButton
                    mustVerifyEmail={mustVerifyEmail}
                    onSaveActionChange={onSaveActionChange}
                    status={status}
                />
            ) : null}
            {activeSection === 'appearance' ? (
                <AppearanceSettingsPanel headingItem={activeItem} />
            ) : null}
            {activeSection === 'language' ? (
                <LanguageSettingsPanel
                    availableLanguages={availableLanguages}
                    headingItem={activeItem}
                    hideSaveButton
                    locale={locale}
                    onSaveActionChange={onSaveActionChange}
                />
            ) : null}
            {activeSection === 'notifications' ? (
                <NotificationsPanel headingItem={activeItem} />
            ) : null}
            {activeSection === 'feedback' ? (
                <FeedbackPanel
                    headingItem={activeItem}
                    promptStatus={feedbackPromptStatus}
                />
            ) : null}
            {activeSection === 'sound' ? (
                <SoundSettingsPanel
                    headingItem={activeItem}
                    hideSaveButton
                    onSaveActionChange={onSaveActionChange}
                    preferences={soundPreferences}
                />
            ) : null}
            {activeSection === 'security' ? (
                <SecuritySettingsPanel
                    {...security}
                    formId="personal-security-form"
                    headingItem={activeItem}
                    hideSaveButton
                    onSaveActionChange={onSaveActionChange}
                />
            ) : null}
            {activeSection === 'delete-account' ? (
                <DeleteAccountPanel headingItem={activeItem} />
            ) : null}
        </>
    );
}

function DeleteAccountPanel({
    headingItem,
}: {
    headingItem: SettingsNavigationItem<PersonalSection>;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="grid gap-5">
            <section className="grid gap-5">
                <SettingsItemPanelHeader
                    description={t(
                        'settings.personal.delete_account.description',
                        'Delete your account and all of its resources.',
                    )}
                    item={headingItem}
                    title={t(
                        'settings.personal.delete_account.title',
                        'Delete account',
                    )}
                />

                <SettingsFormColumn>
                    <div className="border-t border-red-400/30 pt-5">
                        <DeleteUser hideHeading />
                    </div>
                </SettingsFormColumn>
            </section>
        </div>
    );
}

function NotificationsPanel({
    headingItem,
}: {
    headingItem: SettingsNavigationItem<PersonalSection>;
}) {
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-5">
            <SettingsItemPanelHeader
                description={t(
                    'settings.personal.notifications.description',
                    'This area will hold optional reminders, quiet hours and communication preferences. It will remain opt-in and avoid pressure-based learning loops.',
                )}
                item={headingItem}
                title={t(
                    'settings.personal.notifications.title',
                    'Communication preferences',
                )}
            />
        </section>
    );
}

function FeedbackPanel({
    headingItem,
    promptStatus,
}: {
    headingItem: SettingsNavigationItem<PersonalSection>;
    promptStatus: 'declined' | 'enabled' | 'snoozed';
}) {
    const t = usePlatformTranslation();
    const invitationsEnabled = promptStatus !== 'declined';

    return (
        <section className="grid gap-5">
            <SettingsItemPanelHeader
                description={t(
                    'settings.personal.feedback.description',
                    'Share feedback about the platform separately from journal pages and learning activity responses.',
                )}
                item={headingItem}
                title={t(
                    'settings.personal.feedback.title',
                    'Platform feedback',
                )}
            />
            <SettingsFormColumn>
                <div className="grid gap-4">
                    <p className="text-sm leading-6 text-[var(--settings-muted-text)]">
                        {t(
                            'settings.personal.feedback.reminders',
                            invitationsEnabled
                                ? 'Occasional invitations to share feedback are enabled.'
                                : 'Feedback invitations are turned off. You can turn them back on here at any time.',
                        )}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild>
                            <Link href="/feedback">
                                <MessageSquareText className="size-4" />
                                {t(
                                    'settings.personal.feedback.open',
                                    'Open feedback page',
                                )}
                            </Link>
                        </Button>
                        <Button
                            onClick={() =>
                                router.patch('/settings/feedback-prompt', {
                                    action: invitationsEnabled
                                        ? 'decline'
                                        : 'enable',
                                })
                            }
                            variant="outline"
                        >
                            {invitationsEnabled
                                ? t(
                                      'settings.personal.feedback.turn_off',
                                      'Turn off invitations',
                                  )
                                : t(
                                      'settings.personal.feedback.turn_on',
                                      'Turn invitations back on',
                                  )}
                        </Button>
                    </div>
                </div>
            </SettingsFormColumn>
        </section>
    );
}
