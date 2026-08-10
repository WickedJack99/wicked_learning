import { Head } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSaveButton,
    SettingsSectionButton,
    SettingsSidebar,
    type SettingsSaveAction,
} from '@/components/settings-configuration-shell';
import {
    SecuritySettingsPanel,
    type SecuritySettingsProps,
} from '@/features/settings/security-settings-panel';

export default function Security(props: SecuritySettingsProps) {
    const [saveAction, setSaveAction] = useState<SettingsSaveAction | null>(
        null,
    );

    return (
        <>
            <Head title="Security settings" />
            <SettingsConfigurationShell
                eyebrow="Personal"
                footerAction={
                    saveAction ? (
                        <div className="w-full lg:max-w-[45%] [&_button]:w-full">
                            <SettingsSaveButton action={saveAction} />
                        </div>
                    ) : undefined
                }
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionButton
                            active
                            icon={KeyRound}
                            id="security"
                            label="Security"
                            onSelect={() => undefined}
                        />
                    </SettingsSidebar>
                }
                title="Security"
            >
                <SettingsContentPane>
                    <SecuritySettingsPanel
                        {...props}
                        formId="standalone-security-form"
                        hideSaveButton
                        onSaveActionChange={setSaveAction}
                    />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}
