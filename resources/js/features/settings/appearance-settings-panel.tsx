import AppearanceTabs from '@/components/appearance-tabs';

export function AppearanceSettingsPanel() {
    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div>
                <p
                    className="text-xs font-medium tracking-[0.18em] uppercase"
                    style={{ color: 'var(--settings-accent)' }}
                >
                    Appearance
                </p>
                <h2 className="mt-2 text-xl font-semibold">Visual mode</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Choose the appearance used after signing in.
                </p>
            </div>
            <AppearanceTabs />
        </section>
    );
}
