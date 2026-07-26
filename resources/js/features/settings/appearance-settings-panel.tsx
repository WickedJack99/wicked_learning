import AppearanceTabs from '@/components/appearance-tabs';
import { SettingsPanelHeader } from '@/components/settings-configuration-shell';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export function AppearanceSettingsPanel() {
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-5">
            <SettingsPanelHeader
                description={t(
                    'settings.personal.appearance.description',
                    'Choose the appearance used after signing in.',
                )}
                eyebrow={t(
                    'settings.personal.appearance.eyebrow',
                    'Appearance',
                )}
                title={t('settings.personal.appearance.title', 'Visual mode')}
            />
            <AppearanceTabs />
        </section>
    );
}
