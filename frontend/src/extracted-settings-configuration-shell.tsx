import type { LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import type {
    KeyboardEvent as ReactKeyboardEvent,
    ReactNode,
    Ref,
} from 'react';

/**
 * Extracted from resources/js/components/settings-configuration-shell.tsx.
 * This file intentionally retains the Laravel source component structure and
 * Tailwind classes. Only imports tied to Inertia/theme page props were left
 * behind; the standalone route supplies its Rust-backed content separately.
 */
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
    collapseSidebarBelowWide?: boolean;
    contentClassName?: string;
    sidebar: ReactNode;
};

type SettingsNestedWorkspaceProps = {
    action?: ReactNode;
    children: ReactNode;
    collapseSidebarBelowWide?: boolean;
    contentClassName?: string;
    footerAction?: ReactNode;
    sidebar: ReactNode;
};

type SettingsSectionButtonProps<T extends string> = {
    active: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
    compact?: boolean;
    danger?: boolean;
    description?: string;
    icon: LucideIcon;
    id: T;
    label: string;
    onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
    onSelect: (id: T) => void;
    role?: 'tab';
    tabIndex?: number;
};

type SettingsSectionNavigationProps<T extends string> = {
    activeSection: T;
    ariaLabel: string;
    items: SettingsNavigationItem<T>[];
    onChange: (section: T) => void;
};

type SettingsPanelHeaderProps = {
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

type SettingsSectionWorkspaceProps<T extends string> = {
    activeItem: SettingsNavigationItem<T>;
    ariaLabel: string;
    children: ReactNode;
    contentClassName?: string;
    items: SettingsNavigationItem<T>[];
    onChange: (section: T) => void;
};

export function SettingsSectionButton<T extends string>({
    active,
    buttonRef,
    compact = false,
    danger = false,
    description,
    icon: Icon,
    id,
    label,
    onKeyDown,
    onSelect,
    role,
    tabIndex,
}: SettingsSectionButtonProps<T>) {
    return (
        <button
            aria-selected={role === 'tab' ? active : undefined}
            className={classNames(
                'relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                compact && 'max-[1535px]:items-center',
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
            onKeyDown={onKeyDown}
            ref={buttonRef}
            role={role}
            tabIndex={tabIndex}
            type="button"
        >
            <span
                aria-hidden="true"
                className={classNames(
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
                        className={classNames(
                            'mt-1 block text-xs leading-5',
                            compact && 'max-[1535px]:hidden',
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

export function SettingsConfigurationLayout({
    children,
    className,
    collapseSidebarBelowWide = false,
    contentClassName,
    sidebar,
}: SettingsConfigurationLayoutProps) {
    return (
        <div
            className={classNames(
                'grid min-h-0 gap-4 overflow-hidden',
                collapseSidebarBelowWide
                    ? '2xl:grid-cols-[16rem_minmax(0,1fr)]'
                    : 'lg:grid-cols-[16rem_minmax(0,1fr)]',
                className,
            )}
        >
            {sidebar}
            <div
                className={classNames(
                    'min-h-0 min-w-0 overflow-hidden',
                    contentClassName,
                )}
            >
                {children}
            </div>
        </div>
    );
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
                    <div className={classNames('mb-3 flex items-center gap-3', headerDanger ? 'text-red-500 dark:text-red-200' : 'text-[var(--settings-accent)]')}>
                        {HeaderIcon ? <HeaderIcon className="size-5" /> : null}
                        <p className="text-xs font-medium tracking-[0.18em] uppercase">{headerEyebrow}</p>
                    </div>
                ) : null}
                <h2 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h2>
                {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">{description}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </>
    );
    if (constrainActionToContent) {
        return <header className={classNames('border-b border-[var(--settings-border-color)] pb-5', className)}><div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:max-w-[45%]">{content}</div></header>;
    }
    return <header className={classNames('flex flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between', className)}>{content}</header>;
}

export function SettingsItemPanelHeader<T extends string>({ item, ...props }: Omit<SettingsPanelHeaderProps, 'item'> & { item: SettingsNavigationItem<T> }) {
    return <SettingsPanelHeader {...props} item={item} />;
}

export function SettingsNestedWorkspace({
    action,
    children,
    collapseSidebarBelowWide = false,
    contentClassName,
    footerAction,
    sidebar,
}: SettingsNestedWorkspaceProps) {
    return (
        <SettingsConfigurationLayout
            className="h-full gap-0"
            collapseSidebarBelowWide={collapseSidebarBelowWide}
            contentClassName="flex min-h-0 flex-col bg-[var(--settings-content-background)]"
            sidebar={
                <aside
                    className={classNames(
                        'min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-3',
                        collapseSidebarBelowWide
                            ? '2xl:border-r 2xl:border-b-0'
                            : 'lg:border-r lg:border-b-0',
                    )}
                >
                    <nav
                        className={classNames(
                            'gap-2',
                            collapseSidebarBelowWide &&
                                'flex flex-wrap 2xl:grid',
                            !collapseSidebarBelowWide && 'grid',
                        )}
                    >
                        {sidebar}
                    </nav>
                </aside>
            }
        >
            <div className="flex min-h-0 flex-1 flex-col">
                {action ? (
                    <div className="flex shrink-0 justify-end border-b border-[var(--settings-border-color)] px-4 py-4 sm:px-5">
                        {action}
                    </div>
                ) : null}
                <div
                    className={classNames(
                        'min-h-0 flex-1 overflow-y-auto p-4 sm:p-5',
                        contentClassName,
                    )}
                >
                    {children}
                </div>
                {footerAction ? (
                    <footer className="flex shrink-0 justify-start border-t border-[var(--settings-border-color)] px-4 py-4 sm:px-5">
                        {footerAction}
                    </footer>
                ) : null}
            </div>
        </SettingsConfigurationLayout>
    );
}

/** Extracted from the source configuration shell for third-level Settings panels. */
export function SettingsSectionWorkspace<T extends string>({ activeItem, ariaLabel, children, contentClassName, items, onChange }: SettingsSectionWorkspaceProps<T>) {
    return <SettingsConfigurationLayout className="h-full gap-0" contentClassName="flex min-h-0 flex-col bg-[var(--settings-content-background)]" sidebar={<aside className="min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0"><SettingsSectionNavigation activeSection={activeItem.key} ariaLabel={ariaLabel} items={items} onChange={onChange} /></aside>}><div className={classNames('min-h-0 flex-1 overflow-y-auto p-4 sm:p-5', contentClassName)}>{children}</div></SettingsConfigurationLayout>;
}

export function SettingsSectionNavigation<T extends string>({
    activeSection,
    ariaLabel,
    items,
    onChange,
}: SettingsSectionNavigationProps<T>) {
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const moveToSection = (
        index: number,
        direction: 'next' | 'previous' | 'first' | 'last',
    ) => {
        const targetIndex =
            direction === 'first'
                ? 0
                : direction === 'last'
                  ? items.length - 1
                  : direction === 'next'
                    ? (index + 1) % items.length
                    : (index - 1 + items.length) % items.length;
        const target = items[targetIndex];

        if (!target) {
            return;
        }

        onChange(target.key);
        buttonRefs.current[targetIndex]?.focus();
    };

    return (
        <div
            aria-label={ariaLabel}
            className="grid auto-rows-max content-start gap-2"
            role="tablist"
        >
            {items.map((item, index) => (
                <SettingsSectionButton
                    active={activeSection === item.key}
                    danger={item.danger}
                    description={item.description}
                    icon={item.icon}
                    id={item.key}
                    key={item.key}
                    label={item.label}
                    buttonRef={(element) => {
                        buttonRefs.current[index] = element;
                    }}
                    onKeyDown={(event) => {
                        if (
                            event.key === 'ArrowDown' ||
                            event.key === 'ArrowRight'
                        ) {
                            event.preventDefault();
                            moveToSection(index, 'next');
                        } else if (
                            event.key === 'ArrowUp' ||
                            event.key === 'ArrowLeft'
                        ) {
                            event.preventDefault();
                            moveToSection(index, 'previous');
                        } else if (event.key === 'Home') {
                            event.preventDefault();
                            moveToSection(index, 'first');
                        } else if (event.key === 'End') {
                            event.preventDefault();
                            moveToSection(index, 'last');
                        }
                    }}
                    onSelect={onChange}
                    role="tab"
                    tabIndex={activeSection === item.key ? 0 : -1}
                />
            ))}
        </div>
    );
}

function classNames(...values: Array<string | boolean | undefined>): string {
    return values
        .filter((value): value is string => typeof value === 'string')
        .join(' ');
}
