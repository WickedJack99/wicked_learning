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
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type AssetSection = {
    descriptionKey: string;
    descriptionFallback: string;
    href: string | null;
    icon: typeof Hammer;
    labelFallback: string;
    labelKey: string;
    openLabelKey?: string;
};

const sections: AssetSection[] = [
    {
        labelKey: 'settings.assets.sections.tools',
        labelFallback: 'Tools',
        descriptionKey: 'settings.assets.sections.tools.description',
        descriptionFallback:
            'Create reusable learner tools for obstacle activities.',
        href: '/settings/assets/tools',
        icon: Hammer,
        openLabelKey: 'settings.assets.sections.tools.open',
    },
    {
        labelKey: 'settings.assets.sections.items',
        labelFallback: 'Items',
        descriptionKey: 'settings.assets.sections.items.description',
        descriptionFallback:
            'Create consumable inventory objects for item-based activities.',
        href: '/settings/assets/items',
        icon: Package,
        openLabelKey: 'settings.assets.sections.items.open',
    },
    {
        labelKey: 'settings.assets.sections.currencies',
        labelFallback: 'Currencies',
        descriptionKey: 'settings.assets.sections.currencies.description',
        descriptionFallback:
            'Future non-pressure resource concepts, if ever needed.',
        href: null,
        icon: Coins,
    },
];

export default function AdminAssetsIndex() {
    const t = usePlatformTranslation();
    const [selectedSectionLabel, setSelectedSectionLabel] = useState(
        sections[0].labelKey,
    );
    const selectedSection =
        sections.find((section) => section.labelKey === selectedSectionLabel) ??
        sections[0];

    return (
        <>
            <Head
                title={t(
                    'settings.assets.title',
                    'Tools, items and currencies',
                )}
            />
            <SettingsConfigurationShell
                eyebrow={t(
                    'settings.assets.eyebrow',
                    'Administration',
                )}
                sidebar={
                    <SettingsSidebar>
                        {sections.map((section) => (
                            <SettingsSectionButton
                                active={
                                    section.labelKey === selectedSectionLabel
                                }
                                description={t(
                                    section.descriptionKey,
                                    section.descriptionFallback,
                                )}
                                icon={section.icon}
                                id={section.labelKey}
                                key={section.labelKey}
                                label={t(
                                    section.labelKey,
                                    section.labelFallback,
                                )}
                                onSelect={setSelectedSectionLabel}
                            />
                        ))}
                    </SettingsSidebar>
                }
                title={t(
                    'settings.assets.title',
                    'Tools, items and currencies',
                )}
            >
                <SettingsContentPane>
                    <AssetSectionDetail section={selectedSection} />
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

function AssetSectionDetail({ section }: { section: AssetSection }) {
    const t = usePlatformTranslation();
    const Icon = section.icon;
    const label = t(section.labelKey, section.labelFallback);
    const description = t(section.descriptionKey, section.descriptionFallback);

    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                <Icon className="size-5" />
            </span>
            <div>
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    {t('settings.assets.library', 'Asset library')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{label}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </div>

            {section.href ? (
                <Button asChild className="w-fit">
                    <Link href={section.href}>
                        {t(
                            section.openLabelKey ?? 'settings.assets.open',
                            'Open :label',
                            { label },
                        )}
                    </Link>
                </Button>
            ) : (
                <Button disabled className="w-fit" variant="secondary">
                    {t('settings.assets.planned', 'Planned for later')}
                </Button>
            )}
        </section>
    );
}
