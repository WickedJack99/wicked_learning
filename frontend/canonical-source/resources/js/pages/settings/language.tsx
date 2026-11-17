import { Head } from '@inertiajs/react';
import { Languages } from 'lucide-react';
import { useState } from 'react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSaveButton,
    SettingsSectionButton,
    SettingsSidebar,
    type SettingsSaveAction,
} from '@/components/settings-configuration-shell';
import { LanguageSettingsPanel } from '@/features/settings/language-settings-panel';

type AvailableLanguage = {
    code: string;
    name: string;
    nativeName: string;
};

export default function LanguageSettings({
    availableLanguages,
    locale,
}: {
    availableLanguages: AvailableLanguage[];
    locale: string;
}) {
    const [saveAction, setSaveAction] = useState<SettingsSaveAction | null>(
        null,
    );

    return (
        <>
            <Head title="Language" />
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
                            icon={Languages}
                            id="language"
                            label="Language"
                            onSelect={() => undefined}
                        />
                    </SettingsSidebar>
                }
                title="Language"
            >
                <SettingsContentPane>
                    <LanguageSettingsPanel
                        availableLanguages={availableLanguages}
                        hideSaveButton
                        locale={locale}
                        onSaveActionChange={setSaveAction}
                    />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}
