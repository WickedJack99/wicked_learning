import AppearanceTabs from '@/components/appearance-tabs';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export function AppearanceSettingsPanel() {
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div>
                <p
                    className="text-xs font-medium tracking-[0.18em] uppercase"
                    style={{ color: 'var(--settings-accent)' }}
                >
                    {t(
                        'settings.personal.appearance.eyebrow',
                        'Appearance',
                    )}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                    {t('settings.personal.appearance.title', 'Visual mode')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.personal.appearance.description',
                        'Choose the appearance used after signing in.',
                    )}
                </p>
            </div>
            <AppearanceTabs />
        </section>
    );
}
