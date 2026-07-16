import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SettingsConfigurationShellProps = {
    action?: ReactNode;
    backHref?: string;
    backLabel?: string;
    children: ReactNode;
    eyebrow: string;
    sidebar: ReactNode;
    title: string;
};

type SettingsSectionButtonProps<T extends string> = {
    active: boolean;
    description?: string;
    danger?: boolean;
    icon: LucideIcon;
    id: T;
    label: string;
    onSelect: (id: T) => void;
};

export type SettingsNavigationItem<T extends string> = {
    description: string;
    danger?: boolean;
    icon: LucideIcon;
    key: T;
    label: string;
};

type SettingsConfigurationLayoutProps = {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    sidebar: ReactNode;
};

type SettingsSectionNavigationProps<T extends string> = {
    activeSection: T;
    ariaLabel: string;
    items: SettingsNavigationItem<T>[];
    onChange: (section: T) => void;
};

export function SettingsConfigurationShell({
    action,
    backHref = '/settings',
    backLabel = 'Settings',
    children,
    eyebrow,
    sidebar,
    title,
}: SettingsConfigurationShellProps) {
    return (
        <main className="fixed inset-0 overflow-hidden bg-slate-100 px-4 pt-5 pb-24 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[92rem] flex-col overflow-hidden">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Button asChild className="mb-4" variant="ghost">
                            <Link href={backHref}>
                                <ArrowLeft className="size-4" />
                                {backLabel}
                            </Link>
                        </Button>
                        <p
                            className="text-xs font-medium tracking-[0.18em] uppercase"
                            style={{ color: 'var(--settings-accent)' }}
                        >
                            {eyebrow}
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            {title}
                        </h1>
                    </div>
                    {action}
                </header>

                <section className="grid min-h-0 flex-1 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:grid-cols-[16rem_minmax(0,1fr)] dark:border-white/10 dark:bg-[#111820]">
                    {sidebar}
                    <div className="min-h-0 overflow-hidden">{children}</div>
                </section>
            </div>
        </main>
    );
}

export function SettingsSidebar({ children }: { children: ReactNode }) {
    return (
        <aside className="h-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
            <nav className="grid gap-2">{children}</nav>
        </aside>
    );
}

export function SettingsSectionButton<T extends string>({
    active,
    danger = false,
    description,
    icon: Icon,
    id,
    label,
    onSelect,
}: SettingsSectionButtonProps<T>) {
    return (
        <button
            className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition',
                active && 'shadow-sm',
                !active &&
                    (danger
                        ? 'text-red-600 hover:bg-red-50 dark:text-red-200 dark:hover:bg-red-400/10'
                        : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'),
            )}
            onClick={() => onSelect(id)}
            style={
                active
                    ? {
                          background: danger
                              ? '#dc2626'
                              : 'var(--settings-accent, #2dd4bf)',
                          color: danger
                              ? '#ffffff'
                              : 'var(--settings-accent-foreground, #020617)',
                      }
                    : undefined
            }
            type="button"
        >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
                <span className="block">{label}</span>
                {description ? (
                    <span
                        className={cn(
                            'mt-1 block text-xs leading-5',
                            active
                                ? 'opacity-80'
                                : 'text-slate-500 dark:text-slate-400',
                        )}
                    >
                        {description}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

export function SettingsContentPane({ children }: { children: ReactNode }) {
    return <div className="h-full overflow-y-auto pr-1">{children}</div>;
}

export function SettingsConfigurationLayout({
    children,
    className,
    contentClassName,
    sidebar,
}: SettingsConfigurationLayoutProps) {
    return (
        <div
            className={cn(
                'grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[16rem_minmax(0,1fr)]',
                className,
            )}
        >
            {sidebar}
            <div className={cn('min-h-0 overflow-hidden', contentClassName)}>
                {children}
            </div>
        </div>
    );
}

export function SettingsSectionNavigation<T extends string>({
    activeSection,
    ariaLabel,
    items,
    onChange,
}: SettingsSectionNavigationProps<T>) {
    return (
        <div aria-label={ariaLabel} className="grid gap-2" role="tablist">
            {items.map((item) => (
                <SettingsSectionButton
                    active={activeSection === item.key}
                    danger={item.danger}
                    description={item.description}
                    icon={item.icon}
                    id={item.key}
                    key={item.key}
                    label={item.label}
                    onSelect={onChange}
                />
            ))}
        </div>
    );
}
