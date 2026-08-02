import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Save } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import { getSettingsPresentationStyle } from '@/theme/presentation';

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

type SettingsGroupedPaneProps = {
    children: ReactNode;
    className?: string;
};

type SettingsFormColumnProps = {
    children: ReactNode;
    className?: string;
};

type SettingsNestedWorkspaceProps = {
    action?: ReactNode;
    children: ReactNode;
    contentClassName?: string;
    description?: ReactNode;
    eyebrow?: ReactNode;
    headerContentClassName?: string;
    icon?: LucideIcon;
    item?: SettingsNavigationItem<string>;
    sidebar: ReactNode;
    title?: ReactNode;
};

type SettingsSectionWorkspaceProps<T extends string> = {
    activeItem: SettingsNavigationItem<T>;
    ariaLabel: string;
    bannerClassName?: string;
    bannerItem?: SettingsNavigationItem<string>;
    children: ReactNode;
    contentClassName?: string;
    items: SettingsNavigationItem<T>[];
    onChange: (section: T) => void;
};

export type SettingsSaveAction = {
    disabled?: boolean;
    form?: string;
    label: ReactNode;
    onClick?: () => void;
    saving?: boolean;
    savingLabel?: ReactNode;
};

type SettingsLevelBannerProps = {
    action?: ReactNode;
    className?: string;
    contentClassName?: string;
    description?: ReactNode;
    eyebrow?: ReactNode;
    icon?: LucideIcon;
    item?: SettingsNavigationItem<string>;
    title?: ReactNode;
};

export type SettingsPanelHeaderProps = {
    action?: ReactNode;
    className?: string;
    constrainActionToContent?: boolean;
    danger?: boolean;
    description?: ReactNode;
    eyebrow?: ReactNode;
    icon?: LucideIcon;
    item?: SettingsNavigationItem<string>;
    title: ReactNode;
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
    backLabel,
    children,
    eyebrow,
    sidebar,
    title,
}: SettingsConfigurationShellProps) {
    const t = usePlatformTranslation();
    const { props } = usePage();
    const { resolvedAppearance } = useAppearance();
    const resolvedBackLabel = backLabel ?? t('common.settings', 'Settings');

    return (
        <main
            className="settings-surface fixed inset-0 overflow-hidden bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100"
            style={getSettingsPresentationStyle(
                props.publicPresentation,
                resolvedAppearance,
            )}
        >
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[92rem] flex-col overflow-hidden">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Button asChild className="mb-4" variant="ghost">
                            <Link href={backHref}>
                                <ArrowLeft className="size-4" />
                                {resolvedBackLabel}
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

                <section className="grid min-h-0 flex-1 gap-4 overflow-hidden rounded-2xl border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4 shadow-2xl md:grid-cols-[16rem_minmax(0,1fr)]">
                    {sidebar}
                    <div className="min-h-0 overflow-hidden">{children}</div>
                </section>
            </div>
        </main>
    );
}

export function SettingsSidebar({ children }: { children: ReactNode }) {
    return (
        <aside className="h-full min-h-0 overflow-hidden rounded-xl border border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-2">
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
                'relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                active &&
                    (danger
                        ? 'bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-200'
                        : 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'),
                !active &&
                    (danger
                        ? 'text-red-600 hover:bg-red-50 dark:text-red-200 dark:hover:bg-red-400/10'
                        : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]'),
            )}
            onClick={() => onSelect(id)}
            type="button"
        >
            <span
                aria-hidden="true"
                className={cn(
                    'absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity',
                    danger ? 'bg-red-500' : 'bg-[var(--settings-accent)]',
                    active ? 'opacity-100' : 'opacity-0',
                )}
            />
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
                <span className="block">{label}</span>
                {description ? (
                    <span
                        className={cn(
                            'mt-1 block text-xs leading-5',
                            active
                                ? 'opacity-80'
                                : 'text-[var(--settings-muted-text)]',
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

export function SettingsPanelHeader({
    action,
    className,
    constrainActionToContent = false,
    danger = false,
    description,
    eyebrow,
    icon: Icon,
    item,
    title,
}: SettingsPanelHeaderProps) {
    const HeaderIcon = item?.icon ?? Icon;
    const headerEyebrow = eyebrow ?? item?.label;
    const headerDanger = danger || item?.danger === true;

    const content = (
        <>
            <div className="min-w-0">
                {headerEyebrow ? (
                    <div
                        className={cn(
                            'mb-3 flex items-center gap-3',
                            headerDanger
                                ? 'text-red-500 dark:text-red-200'
                                : 'text-[var(--settings-accent)]',
                        )}
                    >
                        {HeaderIcon ? <HeaderIcon className="size-5" /> : null}
                        <p className="text-xs font-medium tracking-[0.18em] uppercase">
                            {headerEyebrow}
                        </p>
                    </div>
                ) : null}
                <h2 className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
                    {title}
                </h2>
                {description ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                        {description}
                    </p>
                ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </>
    );

    if (constrainActionToContent) {
        return (
            <header
                className={cn(
                    'border-b border-[var(--settings-border-color)] pb-5',
                    className,
                )}
            >
                <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:max-w-[45%]">
                    {content}
                </div>
            </header>
        );
    }

    return (
        <header
            className={cn(
                'flex flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between',
                className,
            )}
        >
            {content}
        </header>
    );
}

export function SettingsItemPanelHeader<T extends string>({
    item,
    ...props
}: Omit<SettingsPanelHeaderProps, 'item'> & {
    item: SettingsNavigationItem<T>;
}) {
    return <SettingsPanelHeader {...props} item={item} />;
}

export function SettingsGroupedPane({
    children,
    className,
}: SettingsGroupedPaneProps) {
    return (
        <section
            className={cn(
                'min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4 shadow-2xl',
                className,
            )}
        >
            {children}
        </section>
    );
}

export function SettingsFormColumn({
    children,
    className,
}: SettingsFormColumnProps) {
    return (
        <div
            className={cn(
                'grid w-full min-w-0 gap-5 lg:max-w-[45%]',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function SettingsNestedWorkspace({
    action,
    children,
    contentClassName,
    description,
    eyebrow,
    headerContentClassName,
    icon: Icon,
    item,
    sidebar,
    title,
}: SettingsNestedWorkspaceProps) {
    const bannerTitle = title ?? item?.label;
    const bannerDescription = description ?? item?.description;
    const BannerIcon = item?.icon ?? Icon;

    return (
        <SettingsConfigurationLayout
            className="h-full gap-0"
            contentClassName="flex min-h-0 flex-col bg-[var(--settings-panel-background)]"
            sidebar={
                <aside className="min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                    <nav className="grid gap-2">{sidebar}</nav>
                </aside>
            }
        >
            <SettingsLevelBanner
                action={action}
                contentClassName={headerContentClassName}
                description={bannerDescription}
                eyebrow={eyebrow}
                icon={BannerIcon}
                item={item}
                title={bannerTitle}
            />

            <div
                className={cn(
                    'min-h-0 flex-1 overflow-y-auto p-4 sm:p-5',
                    contentClassName,
                )}
            >
                {children}
            </div>
        </SettingsConfigurationLayout>
    );
}

/**
 * Use this for nested Settings levels where the parent selection owns the
 * banner and the inner selection owns the content heading. Example: Level 2
 * "Support Signals" stays in the Level 3 banner, while Level 3 "Individual
 * Support" is rendered inside the content area by the feature panel.
 */
export function SettingsSectionWorkspace<T extends string>({
    activeItem,
    ariaLabel,
    bannerClassName,
    bannerItem,
    children,
    contentClassName,
    items,
    onChange,
}: SettingsSectionWorkspaceProps<T>) {
    return (
        <SettingsConfigurationLayout
            className="h-full gap-0"
            contentClassName="flex min-h-0 flex-col bg-[var(--settings-panel-background)]"
            sidebar={
                <aside className="min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                    <SettingsSectionNavigation
                        activeSection={activeItem.key}
                        ariaLabel={ariaLabel}
                        items={items}
                        onChange={onChange}
                    />
                </aside>
            }
        >
            <SettingsLevelBanner
                className={bannerClassName}
                item={bannerItem ?? activeItem}
            />

            <div
                className={cn(
                    'min-h-0 flex-1 overflow-y-auto p-4 sm:p-5',
                    contentClassName,
                )}
            >
                {children}
            </div>
        </SettingsConfigurationLayout>
    );
}

export function SettingsLevelBanner({
    action,
    className,
    contentClassName,
    description,
    eyebrow,
    icon: Icon,
    item,
    title,
}: SettingsLevelBannerProps) {
    const BannerIcon = item?.icon ?? Icon;
    const bannerTitle = title ?? item?.label;
    const bannerDescription = description ?? item?.description;
    const bannerDanger = item?.danger === true;

    return (
        <header
            className={cn(
                'shrink-0 border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] px-4 py-4 sm:px-5',
                className,
            )}
        >
            <div
                className={cn(
                    'flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:max-w-[45%]',
                    contentClassName,
                )}
            >
                <div className="min-w-0">
                    {eyebrow ? (
                        <p
                            className={cn(
                                'mb-2 text-xs font-medium tracking-[0.18em] uppercase',
                                bannerDanger
                                    ? 'text-red-500 dark:text-red-200'
                                    : 'text-[var(--settings-accent)]',
                            )}
                        >
                            {eyebrow}
                        </p>
                    ) : null}
                    <div
                        className={cn(
                            'flex items-center gap-3',
                            bannerDanger
                                ? 'text-red-500 dark:text-red-200'
                                : 'text-[var(--settings-accent)]',
                        )}
                    >
                        {BannerIcon ? <BannerIcon className="size-5" /> : null}
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            {bannerTitle}
                        </h2>
                    </div>
                    {bannerDescription ? (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                            {bannerDescription}
                        </p>
                    ) : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
        </header>
    );
}

export function SettingsSaveButton({
    action,
}: {
    action: SettingsSaveAction | null;
}) {
    if (!action) {
        return null;
    }

    return (
        <Button
            disabled={action.disabled}
            form={action.form}
            onClick={action.onClick}
            type={action.form ? 'submit' : 'button'}
        >
            <Save className="size-4" />
            {action.saving && action.savingLabel
                ? action.savingLabel
                : action.label}
        </Button>
    );
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
        <div
            aria-label={ariaLabel}
            className="grid auto-rows-max content-start gap-2"
            role="tablist"
        >
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
