import type { ReactNode } from 'react';

export function TopicAdminField({
    children,
    className = '',
    label,
}: {
    children: ReactNode;
    className?: string;
    label: string;
}) {
    return (
        <label className={`grid gap-2 text-sm font-medium ${className}`}>
            <span>{label}</span>
            {children}
        </label>
    );
}

export const topicAdminInputClass =
    'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-500/12 dark:border-white/25 dark:bg-white/[0.035] dark:text-white';

export const topicAdminPrimaryButtonClass =
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-violet-500/50 bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500/25 dark:text-violet-100 dark:hover:bg-violet-500/35';

export const topicAdminSecondaryButtonClass =
    'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/6';
