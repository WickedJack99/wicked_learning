import type { ReactNode } from 'react';

/**
 * A static, labelled group of related configuration fields.
 *
 * Configuration editors already use page-level navigation to control density,
 * so another collapsible layer makes their fields harder to discover.
 */
export function SettingsConfigurationSection({
    children,
    description,
    title,
}: {
    children: ReactNode;
    description: string;
    title: string;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/5">
            <header className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    {title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </header>
            <div className="grid gap-4 px-4 py-4">{children}</div>
        </section>
    );
}

export function SettingsEmptyStateSection({
    description,
    title,
}: {
    description: string;
    title: string;
}) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
                {title}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
            </p>
        </div>
    );
}
