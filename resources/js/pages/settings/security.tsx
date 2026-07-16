import { Head } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import {
    SecuritySettingsPanel,
    type SecuritySettingsProps,
} from '@/features/settings/security-settings-panel';

export default function Security(props: SecuritySettingsProps) {
    return (
        <>
            <Head title="Security settings" />
            <SettingsConfigurationShell
                eyebrow="Personal"
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
                    <SecuritySettingsPanel {...props} />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}
