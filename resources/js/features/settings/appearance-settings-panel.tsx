import AppearanceTabs from '@/components/appearance-tabs';
import {
    SettingsFormColumn,
    SettingsPanelHeader,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export function AppearanceSettingsPanel({
    headingItem,
}: {
    headingItem?: SettingsNavigationItem<string>;
}) {
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-5">
            <SettingsPanelHeader
                description={t(
                    'settings.personal.appearance.description',
                    'Choose the appearance used after signing in.',
                )}
                eyebrow={
                    headingItem
                        ? undefined
                        : t(
                              'settings.personal.appearance.eyebrow',
                              'Appearance',
                          )
                }
                item={headingItem}
                title={t('settings.personal.appearance.title', 'Visual mode')}
            />
            <SettingsFormColumn>
                <AppearanceTabs />
            </SettingsFormColumn>
        </section>
    );
}
