import { Backpack, Hammer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';

import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type LearnerItem = components['schemas']['LearnerItem'];
type LearnerTool = components['schemas']['LearnerTool'];
type OverlayMode = 'inventory' | 'tools' | null;
type MapThemedStyle = CSSProperties & Record<`--${string}`, string>;

/**
 * Source-adapted from `components/app-side-action-bar.tsx`. It deliberately
 * contains only the existing Inventory and Tools affordances: companion,
 * obstacle and grant flows remain absent until their source contracts exist.
 */
export function OriginalToolBelt({
    appearance,
    items,
    onSelectTool,
    selectedTool,
    tools,
}: {
    appearance: OriginalAppearance;
    items: LearnerItem[];
    onSelectTool: (tool: LearnerTool | null) => void;
    selectedTool: LearnerTool | null;
    tools: LearnerTool[];
}) {
    const [overlay, setOverlay] = useState<OverlayMode>(null);
    const sideActionRef = useRef<HTMLElement | null>(null);
    const overlayTriggerRef = useRef<HTMLButtonElement | null>(null);

    const closeOverlay = () => {
        setOverlay(null);
        window.setTimeout(() => overlayTriggerRef.current?.focus(), 0);
    };

    function toggleOverlay(
        next: Exclude<OverlayMode, null>,
        trigger: HTMLButtonElement,
    ) {
        if (overlay === next) {
            closeOverlay();
            return;
        }

        overlayTriggerRef.current = trigger;
        setOverlay(next);
    }

    useEffect(() => {
        if (!overlay) return;

        const closeOutside = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                sideActionRef.current?.contains(event.target)
            ) {
                return;
            }
            closeOverlay();
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeOverlay();
        };

        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [overlay]);

    return (
        <aside
            aria-label="Player actions"
            className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-3 md:top-1/2 md:right-5 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2 md:flex-row"
            data-wl-id="learner.world.tool-belt"
            ref={sideActionRef}
        >
            {overlay === 'inventory' ? (
                <SideOverlay
                    eyebrow="Inventory"
                    id="learning-inventory-panel"
                    onClose={closeOverlay}
                    title="Items"
                >
                    <ItemGrid items={items} mode={appearance} />
                </SideOverlay>
            ) : null}
            {overlay === 'tools' ? (
                <SideOverlay
                    eyebrow="Tools"
                    id="learning-tools-panel"
                    onClose={closeOverlay}
                    title="Select a tool"
                >
                    <ToolGrid
                        mode={appearance}
                        onClose={closeOverlay}
                        onSelectTool={onSelectTool}
                        selectedTool={selectedTool}
                        tools={tools}
                    />
                </SideOverlay>
            ) : null}
            <div
                className="grid grid-flow-col gap-1.5 rounded-2xl border p-1.5 shadow-2xl shadow-slate-950/15 backdrop-blur-md md:grid-flow-row dark:shadow-black/35"
                style={{
                    background: 'var(--map-side-control-background)',
                    borderColor: 'var(--map-side-control-border-color)',
                    color: 'var(--map-side-control-text-color)',
                    cursor: 'var(--platform-cursor)',
                }}
            >
                <ActionButton
                    ariaControls="learning-inventory-panel"
                    ariaExpanded={overlay === 'inventory'}
                    isActive={overlay === 'inventory'}
                    label="Open inventory"
                    onClick={(event) =>
                        toggleOverlay('inventory', event.currentTarget)
                    }
                >
                    <Backpack className="size-5" />
                </ActionButton>
                <ActionButton
                    ariaControls="learning-tools-panel"
                    ariaExpanded={overlay === 'tools'}
                    isActive={overlay === 'tools' || Boolean(selectedTool)}
                    label="Open tools"
                    onClick={(event) => {
                        if (selectedTool) {
                            onSelectTool(null);
                            closeOverlay();
                            return;
                        }
                        toggleOverlay('tools', event.currentTarget);
                    }}
                >
                    {selectedTool ? (
                        <ToolImage
                            className="size-6"
                            mode={appearance}
                            tool={selectedTool}
                        />
                    ) : (
                        <Hammer className="size-5" />
                    )}
                </ActionButton>
            </div>
        </aside>
    );
}

function ItemGrid({ items, mode }: { items: LearnerItem[]; mode: OriginalAppearance }) {
    if (items.length === 0) {
        return <EmptyOverlayState>No items acquired yet.</EmptyOverlayState>;
    }

    return (
        <div className="max-h-80 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2">
                {items.map((item) => <ItemTile item={item} key={item.slug} mode={mode} />)}
            </div>
        </div>
    );
}

function ItemTile({ item, mode }: { item: LearnerItem; mode: OriginalAppearance }) {
    const image = themedAsset(item.image_dark, item.image_light, mode);

    return (
        <button
            className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border p-1 transition hover:border-[var(--map-floating-accent-color)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
            style={{
                background: 'var(--map-side-control-panel-background)',
                borderColor: 'var(--map-side-control-panel-border-color)',
                color: 'var(--map-side-control-text-color)',
                cursor: 'var(--platform-action-cursor)',
            }}
            title={item.title}
            type="button"
        >
            {image ? <img alt="" className="h-full w-full object-contain" draggable={false} src={image} /> : <Backpack className="size-6" />}
            <span
                className="absolute right-1 bottom-1 min-w-5 rounded px-1 text-center text-xs font-semibold"
                style={{
                    background: 'var(--map-side-control-active-background)',
                    color: 'var(--map-side-control-active-text-color)',
                }}
            >
                {item.quantity}
            </span>
            <span className="sr-only">{item.title}</span>
        </button>
    );
}

function ToolGrid({
    mode,
    onClose,
    onSelectTool,
    selectedTool,
    tools,
}: {
    mode: OriginalAppearance;
    onClose: () => void;
    onSelectTool: (tool: LearnerTool | null) => void;
    selectedTool: LearnerTool | null;
    tools: LearnerTool[];
}) {
    if (tools.length === 0) {
        return <EmptyOverlayState>No tools acquired yet.</EmptyOverlayState>;
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            {tools.map((tool) => {
                const selected = selectedTool?.slug === tool.slug;
                return (
                    <button
                        className={`grid aspect-square place-items-center rounded-lg border p-2 transition hover:-translate-y-0.5 hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none ${selected ? 'border-[var(--map-floating-accent-color)] bg-[var(--map-side-control-hover-background)]' : ''}`}
                        key={tool.slug}
                        onClick={() => {
                            onSelectTool(selected ? null : tool);
                            onClose();
                        }}
                        style={
                            {
                                background: selected
                                    ? 'var(--map-side-control-hover-background)'
                                    : 'var(--map-side-control-panel-background)',
                                borderColor: selected
                                    ? 'var(--map-floating-accent-color)'
                                    : 'var(--map-side-control-panel-border-color)',
                                color: 'var(--map-side-control-text-color)',
                                cursor: 'var(--platform-action-cursor)',
                            } satisfies MapThemedStyle
                        }
                        title={tool.title}
                        type="button"
                    >
                        <ToolImage className="size-10" mode={mode} tool={tool} />
                        <span className="mt-1 max-w-full truncate text-xs font-medium">{tool.title}</span>
                    </button>
                );
            })}
        </div>
    );
}

function ActionButton({
    ariaControls,
    ariaExpanded,
    children,
    isActive = false,
    label,
    onClick,
}: {
    ariaControls?: string;
    ariaExpanded?: boolean;
    children: ReactNode;
    isActive?: boolean;
    label: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
    return (
        <button
            aria-controls={ariaControls}
            aria-expanded={ariaExpanded}
            aria-label={label}
            className="grid size-11 place-items-center rounded-xl transition hover:bg-[var(--map-side-control-hover-background)] hover:text-[var(--map-side-control-active-icon-color)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
            onClick={onClick}
            style={{
                background: isActive ? 'var(--map-side-control-active-background)' : undefined,
                color: isActive
                    ? 'var(--map-side-control-active-icon-color, var(--map-side-control-active-text-color))'
                    : 'var(--map-side-control-icon-color, var(--map-side-control-text-color))',
                cursor: 'var(--platform-action-cursor)',
            }}
            title={label}
            type="button"
        >
            {children}
        </button>
    );
}

function SideOverlay({
    children,
    eyebrow,
    id,
    onClose,
    title,
}: {
    children: ReactNode;
    eyebrow: string;
    id: string;
    onClose: () => void;
    title: string;
}) {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        closeButtonRef.current?.focus();
    }, []);

    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const handleTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;

            const focusable = Array.from(
                panel.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            );
            if (focusable.length === 0) {
                event.preventDefault();
                panel.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        panel.addEventListener('keydown', handleTab);
        return () => panel.removeEventListener('keydown', handleTab);
    }, []);

    return (
        <div
            aria-labelledby={`${id}-title`}
            aria-modal="true"
            className="flex max-h-[calc(100svh-10rem)] w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-y-auto overscroll-contain rounded-xl border p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-md sm:max-h-[calc(100svh-8rem)] dark:shadow-black/35"
            data-wl-id="learner.world.tool-belt.overlay"
            id={id}
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
            style={{
                background: 'var(--map-side-control-panel-background)',
                borderColor: 'var(--map-side-control-panel-border-color)',
                color: 'var(--map-side-control-text-color)',
            }}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium tracking-[0.16em] uppercase" style={{ color: 'var(--map-floating-accent-color)' }}>{eyebrow}</p>
                    <h2 className="text-sm font-semibold" id={`${id}-title`}>{title}</h2>
                </div>
                <button
                    className="rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                    onClick={onClose}
                    ref={closeButtonRef}
                    style={{
                        color: 'var(--map-side-control-text-color)',
                        cursor: 'var(--platform-action-cursor)',
                    }}
                    type="button"
                >
                    Close
                </button>
            </div>
            {children}
        </div>
    );
}

function EmptyOverlayState({ children }: { children: ReactNode }) {
    return <p className="rounded-lg border border-dashed p-3 text-sm leading-6" style={{ borderColor: 'var(--map-side-control-panel-border-color)', color: 'var(--map-side-control-muted-text-color)' }}>{children}</p>;
}

function ToolImage({ className, mode, tool }: { className?: string; mode: OriginalAppearance; tool: LearnerTool }) {
    const image = themedAsset(tool.image_dark, tool.image_light, mode);
    return image ? <img alt="" className={`object-contain ${className ?? ''}`} draggable={false} src={image} /> : <Hammer className={className} />;
}

function themedAsset(dark: string | null, light: string | null, mode: OriginalAppearance): string {
    return mode === 'light' ? light || dark || '' : dark || light || '';
}
