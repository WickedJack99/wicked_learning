import { Head } from '@inertiajs/react';
import { Languages } from 'lucide-react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
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
    return (
        <>
            <Head title="Language" />
            <SettingsConfigurationShell
                eyebrow="Personal"
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
                        locale={locale}
                    />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}
