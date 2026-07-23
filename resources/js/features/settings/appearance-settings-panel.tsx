import AppearanceTabs from '@/components/appearance-tabs';
import { SettingsPanelHeader } from '@/components/settings-configuration-shell';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export function AppearanceSettingsPanel() {
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
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
