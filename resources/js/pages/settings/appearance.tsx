import { Head } from '@inertiajs/react';
import { Brush } from 'lucide-react';
import AppearanceTabs from '@/components/appearance-tabs';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { edit as editAppearance } from '@/routes/appearance';

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
                            description="Theme preference and visual comfort."
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
                    <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                        <div>
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                Theme
                            </p>
                            <h2 className="mt-2 text-xl font-semibold">
                                Visual mode
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Choose the appearance used after signing in.
                            </p>
                        </div>
                        <AppearanceTabs />
                    </section>
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Appearance settings',
            href: editAppearance(),
        },
    ],
};
