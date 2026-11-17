import { Head } from '@inertiajs/react';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSaveButton,
    SettingsSectionButton,
    SettingsSidebar,
    type SettingsSaveAction,
} from '@/components/settings-configuration-shell';
import { ProfileSettingsPanel } from '@/features/settings/profile-settings-panel';

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const [saveAction, setSaveAction] = useState<SettingsSaveAction | null>(
        null,
    );
    const resolvedSaveAction = saveAction ?? {
        form: 'standalone-profile-form',
        label: 'Save',
    };

    return (
        <>
            <Head title="Profile settings" />
            <SettingsConfigurationShell
                eyebrow="Personal"
                footerAction={
                    <div className="w-full lg:max-w-[45%] [&_button]:w-full">
                        <SettingsSaveButton action={resolvedSaveAction} />
                    </div>
                }
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionButton
                            active
                            icon={UserRound}
                            id="profile"
                            label="Profile"
                            onSelect={() => undefined}
                        />
                    </SettingsSidebar>
                }
                title="Profile"
            >
                <SettingsContentPane>
                    <ProfileSettingsPanel
                        formId="standalone-profile-form"
                        hideSaveButton
                        mustVerifyEmail={mustVerifyEmail}
                        onSaveActionChange={setSaveAction}
                        status={status}
                    />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}
