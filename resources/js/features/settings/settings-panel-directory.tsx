import { router } from '@inertiajs/react';
import { Database } from 'lucide-react';
import AppearanceTabs from '@/components/appearance-tabs';
import {
    SettingsContentPane,
    SettingsPanelHeader,
} from '@/components/settings-configuration-shell';
import {
    canSeeSettingsLink,
    settingsItemDescription,
    settingsItemLabel,
    settingsLinkLabel,
    type AccessCapability,
    type SettingsListItem,
    type SettingsNavigationSection,
    type SettingsPanelKey,
} from '@/features/settings/settings-navigation';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type SettingsOverviewProps = {
    accessCapabilities: Record<string, AccessCapability>;
    onOpenItem: (item: SettingsListItem) => void;
    sections: SettingsNavigationSection[];
};

type SettingsRouteGroupPanelProps = {
    accessCapabilities: Record<string, AccessCapability>;
    item: SettingsListItem;
};

type SettingsPlaceholderPanelProps = {
    content: { body: string; title: string };
    panel: SettingsPanelKey;
};

export function SettingsOverview({
    accessCapabilities,
    onOpenItem,
    sections,
}: SettingsOverviewProps) {
    const t = usePlatformTranslation();

    return (
        <div className="h-full overflow-y-auto p-5">
            <div className="grid gap-5">
                {sections.map((section) => (
                    <section key={section.key}>
                        <h2 className="mb-3 text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                            {section.label}
                        </h2>
                        <div className="grid gap-3 xl:grid-cols-2">
                            {section.items.map((item) => (
                                <SettingsOverviewCard
                                    accessCapabilities={accessCapabilities}
                                    item={item}
                                    key={item.key}
                                    onOpen={onOpenItem}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

export function SettingsRouteGroupPanel({
    accessCapabilities,
    item,
}: SettingsRouteGroupPanelProps) {
    const t = usePlatformTranslation();
    const Icon = item.icon;
    const visibleChildren = (item.children ?? []).filter((child) =>
        canSeeSettingsLink(child, accessCapabilities),
    );

    return (
        <SettingsContentPane>
            <div className="grid content-start gap-5 p-5">
                <SettingsPanelHeader
                    description={settingsItemDescription(item, t)}
                    eyebrow={settingsItemLabel(item, t)}
                    icon={Icon}
                    title={settingsItemLabel(item, t)}
                />

                <div className="grid gap-3 xl:grid-cols-2">
                    {visibleChildren.map((child) => (
                        <button
                            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[var(--settings-accent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_8%,transparent)] dark:border-white/10 dark:bg-white/5 dark:hover:border-[var(--settings-accent)] dark:hover:bg-white/10"
                            key={child.href}
                            onClick={() => router.visit(child.href)}
                            type="button"
                        >
                            <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                                {settingsLinkLabel(child, t)}
                            </span>
                        </button>
                    ))}
                </div>

                {visibleChildren.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {t(
                            'settings.no_options_available',
                            'No settings are available here with the current permissions.',
                        )}
                    </p>
                ) : null}
            </div>
        </SettingsContentPane>
    );
}

export function SettingsPlaceholderPanel({
    content,
    panel,
}: SettingsPlaceholderPanelProps) {
    const t = usePlatformTranslation();

    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/6">
            <SettingsPanelHeader
                eyebrow={content.title}
                icon={Database}
                title={content.title}
            />
            <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {content.body}
            </p>
            {panel === 'appearance' ? (
                <div className="mt-5">
                    <AppearanceTabs />
                </div>
            ) : (
                <div className="mt-5 rounded-md border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-500 dark:border-white/15 dark:text-slate-400">
                    {t(
                        'settings.scaffold',
                        'This is a scaffolded settings panel. The next step can connect this area to real forms and policies.',
                    )}
                </div>
            )}
        </div>
    );
}

function SettingsOverviewCard({
    accessCapabilities,
    item,
    onOpen,
}: {
    accessCapabilities: Record<string, AccessCapability>;
    item: SettingsListItem;
    onOpen: (item: SettingsListItem) => void;
}) {
    const t = usePlatformTranslation();
    const Icon = item.icon;
    const visibleChildren = (item.children ?? []).filter((child) =>
        canSeeSettingsLink(child, accessCapabilities),
    );

    return (
        <article className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100 dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/10">
            <button
                className="flex min-w-0 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                onClick={() => onOpen(item)}
                type="button"
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_16%,transparent)] text-[var(--settings-accent)]">
                    <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                        {settingsItemLabel(item, t)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {settingsItemDescription(item, t)}
                    </span>
                </span>
            </button>

            {visibleChildren.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {visibleChildren.map((child) => (
                        <button
                            className="inline-flex h-7 items-center rounded-md border border-[color-mix(in_srgb,var(--settings-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_10%,transparent)] px-2 text-xs font-medium whitespace-nowrap text-[var(--settings-accent)] transition hover:bg-[color-mix(in_srgb,var(--settings-accent)_16%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                            key={child.href}
                            onClick={() => router.visit(child.href)}
                            type="button"
                        >
                            {settingsLinkLabel(child, t)}
                        </button>
                    ))}
                </div>
            ) : null}
        </article>
    );
}
