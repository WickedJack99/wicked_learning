import { Head, Link } from '@inertiajs/react';
import { Coins, Hammer, Package } from 'lucide-react';
import { useState } from 'react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';

type AssetSection = {
    description: string;
    href: string | null;
    icon: typeof Hammer;
    label: string;
};

const sections: AssetSection[] = [
    {
        label: 'Tools',
        description: 'Create reusable learner tools for obstacle activities.',
        href: '/settings/assets/tools',
        icon: Hammer,
    },
    {
        label: 'Items',
        description:
            'Create consumable inventory objects for item-based activities.',
        href: '/settings/assets/items',
        icon: Package,
    },
    {
        label: 'Currencies',
        description: 'Future non-pressure resource concepts, if ever needed.',
        href: null,
        icon: Coins,
    },
];

export default function AdminAssetsIndex() {
    const [selectedSectionLabel, setSelectedSectionLabel] = useState(
        sections[0].label,
    );
    const selectedSection =
        sections.find((section) => section.label === selectedSectionLabel) ??
        sections[0];

    return (
        <>
            <Head title="Tools, items and currencies" />
            <SettingsConfigurationShell
                eyebrow="Administration"
                sidebar={
                    <SettingsSidebar>
                        {sections.map((section) => (
                            <SettingsSectionButton
                                active={section.label === selectedSectionLabel}
                                description={section.description}
                                icon={section.icon}
                                id={section.label}
                                key={section.label}
                                label={section.label}
                                onSelect={setSelectedSectionLabel}
                            />
                        ))}
                    </SettingsSidebar>
                }
                title="Tools, items and currencies"
            >
                <SettingsContentPane>
                    <AssetSectionDetail section={selectedSection} />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

function AssetSectionDetail({ section }: { section: AssetSection }) {
    const Icon = section.icon;

    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                <Icon className="size-5" />
            </span>
            <div>
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    Asset library
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{section.label}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {section.description}
                </p>
            </div>

            {section.href ? (
                <Button asChild className="w-fit">
                    <Link href={section.href}>Open {section.label}</Link>
                </Button>
            ) : (
                <Button disabled className="w-fit" variant="secondary">
                    Planned for later
                </Button>
            )}
        </section>
    );
}
