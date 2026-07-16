import { Head } from '@inertiajs/react';
import { Brush } from 'lucide-react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { AppearanceSettingsPanel } from '@/features/settings/appearance-settings-panel';

export default function Appearance() {
    return (
        <>
            <Head title="Appearance settings" />
            <SettingsConfigurationShell
                eyebrow="Personal"
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionButton
                            active
                            icon={Brush}
                            id="appearance"
                            label="Appearance"
                            onSelect={() => undefined}
                        />
                    </SettingsSidebar>
                }
                title="Appearance"
            >
                <SettingsContentPane>
                    <AppearanceSettingsPanel />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}
