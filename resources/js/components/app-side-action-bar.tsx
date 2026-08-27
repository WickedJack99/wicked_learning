import { router, usePage } from '@inertiajs/react';
import {
    Backpack,
    Building2,
    Hammer,
    NotebookPen,
    Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useAvailableLearningItems } from '@/features/items/item-inventory';
import { JournalOverlay } from '@/features/journal/journal-overlay';
import {
    selectLearningTool,
    useAvailableLearningTools,
    useSelectedLearningTool,
} from '@/features/tools/tool-selection';
import { toolImageUrl } from '@/features/tools/tool-visuals';
import { useAppearance } from '@/hooks/use-appearance';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type {
    LearningItem,
    LearningTool,
    LearningWorld,
    LearningNode,
} from '@/types';

type OverlayMode = 'inventory' | 'journal' | 'tools' | null;
type MapThemedStyle = CSSProperties & Record<`--${string}`, string>;

export function AppSideActionBar() {
    const { props, url } = usePage();
    const pageProps = props as typeof props & {
        node?: LearningNode;
        world?: LearningWorld | null;
    };
    const { node, world } = pageProps;
    const { resolvedAppearance } = useAppearance();
    const [overlay, setOverlay] = useState<OverlayMode>(null);
    const sideActionRef = useRef<HTMLElement | null>(null);
    const overlayTriggerRef = useRef<HTMLButtonElement | null>(null);
    const selectedTool = useSelectedLearningTool();
    const items = useAvailableLearningItems(props.auth.items);
    const tools = useAvailableLearningTools(props.auth.tools);
    const competenceHref = useMemo(
        () => competenceMapHref({ node, world }, url),
        [node, url, world],
    );
    const shouldShow = useMemo(
        () =>
            Boolean(props.auth.user) &&
            (url.startsWith('/world') ||
                url.startsWith('/bookmarks') ||
                url.startsWith('/learning/')),
        [props.auth.user, url],
    );
    const closeOverlay = useCallback(() => {
        setOverlay(null);
        window.setTimeout(() => overlayTriggerRef.current?.focus(), 0);
    }, []);

    const toggleOverlay = (
        next: Exclude<OverlayMode, null>,
        trigger: HTMLButtonElement,
    ) => {
        if (overlay === next) {
            closeOverlay();

            return;
        }

        overlayTriggerRef.current = trigger;
        setOverlay(next);
    };

    useEffect(() => {
        if (overlay !== 'inventory' && overlay !== 'tools') {
            return;
        }

        const closeOverlayOnOutsidePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (
                target instanceof Node &&
                sideActionRef.current?.contains(target)
            ) {
                return;
            }

            closeOverlay();
        };

        document.addEventListener(
            'pointerdown',
            closeOverlayOnOutsidePointerDown,
        );

        return () => {
            document.removeEventListener(
                'pointerdown',
                closeOverlayOnOutsidePointerDown,
            );
        };
    }, [closeOverlay, overlay]);

    useEffect(() => {
        if (!overlay) {
            return;
        }

        const closeOverlayOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeOverlay();
            }
        };

        document.addEventListener('keydown', closeOverlayOnEscape);

        return () => {
            document.removeEventListener('keydown', closeOverlayOnEscape);
        };
    }, [closeOverlay, overlay]);

    if (!shouldShow) {
        return null;
    }

    return (
        <aside
            aria-label="Player actions"
            className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-3 md:top-1/2 md:right-5 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2 md:flex-row"
            ref={sideActionRef}
        >
            {overlay === 'inventory' ? (
                <SideOverlay
                    eyebrow="Inventory"
                    id="learning-inventory-panel"
                    onClose={closeOverlay}
                    title="Items"
                >
                    <ItemGrid items={items} mode={resolvedAppearance} />
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
                        mode={resolvedAppearance}
                        onClose={closeOverlay}
                        selectedTool={selectedTool}
                        tools={tools}
                    />
                </SideOverlay>
            ) : null}
            {overlay === 'journal' ? (
                <JournalOverlay onClose={closeOverlay} />
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
                    label="Open organizations"
                    onClick={() => {
                        closeOverlay();
                        router.visit('/organizations');
                    }}
                >
                    <Building2 className="size-5" />
                </ActionButton>
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
                            selectLearningTool(null);
                            closeOverlay();

                            return;
                        }

                        toggleOverlay('tools', event.currentTarget);
                    }}
                >
                    {selectedTool ? (
                        <ToolImage
                            className="size-6"
                            mode={resolvedAppearance}
                            tool={selectedTool}
                        />
                    ) : (
                        <Hammer className="size-5" />
                    )}
                </ActionButton>
                <ActionButton
                    ariaControls="learning-journal-panel"
                    ariaExpanded={overlay === 'journal'}
                    isActive={overlay === 'journal'}
                    label="Open journal"
                    onClick={(event) =>
                        toggleOverlay('journal', event.currentTarget)
                    }
                >
                    <NotebookPen className="size-5" />
                </ActionButton>
                <ActionButton
                    label="Open competence star map"
                    onClick={() => {
                        closeOverlay();
                        router.visit(competenceHref);
                    }}
                >
                    <Sparkles className="size-5" />
                </ActionButton>
            </div>
        </aside>
    );
}

function competenceMapHref(
    props: {
        node?: LearningNode;
        world?: LearningWorld | null;
    },
    url: string,
): string {
    const nodeTopic = props.node?.topic;

    if (url.startsWith('/learning/') && nodeTopic) {
        return nodeTopic.competenceHref;
    }

    if (!url.startsWith('/world') || !props.world) {
        return '/competence';
    }

    const mapSlug = new URL(url, 'http://learning.local').searchParams.get(
        'map',
    );
    const map = props.world.maps.find(
        (candidate) =>
            candidate.slug === mapSlug || candidate.id.toString() === mapSlug,
    );

    return map?.topic?.competenceHref ?? '/competence';
}

function ItemGrid({
    items,
    mode,
}: {
    items: LearningItem[];
    mode: 'dark' | 'light';
}) {
    if (items.length === 0) {
        return <EmptyOverlayState>No items acquired yet.</EmptyOverlayState>;
    }

    return (
        <div className="learner-scroll-region max-h-80 pr-1">
            <div className="grid grid-cols-3 gap-2">
                {items.map((item) => (
                    <ItemTile item={item} key={item.id} mode={mode} />
                ))}
            </div>
        </div>
    );
}

function ItemTile({
    item,
    mode,
}: {
    item: LearningItem;
    mode: 'dark' | 'light';
}) {
    const image = normalizeMediaUrl(
        mode === 'light'
            ? item.imageLight || item.imageDark
            : item.imageDark || item.imageLight,
    );

    return (
        <button
            className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border p-1 transition hover:border-[var(--map-floating-accent-color)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData(
                    'application/learning-item-id',
                    item.id.toString(),
                );
                event.dataTransfer.effectAllowed = 'move';
            }}
            style={{
                background: 'var(--map-side-control-panel-background)',
                borderColor: 'var(--map-side-control-panel-border-color)',
                color: 'var(--map-side-control-text-color)',
                cursor: 'var(--platform-action-cursor)',
            }}
            title={item.title}
            type="button"
        >
            {image ? (
                <img
                    alt=""
                    className="h-full w-full object-contain"
                    draggable={false}
                    src={image}
                />
            ) : (
                <Backpack className="size-6" />
            )}
            <span
                className="absolute right-1 bottom-1 min-w-5 rounded px-1 text-center text-[0.65rem] font-semibold"
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

function ActionButton({
    ariaControls,
    ariaExpanded,
    children,
    disabled = false,
    isActive = false,
    label,
    onClick,
}: {
    ariaControls?: string;
    ariaExpanded?: boolean;
    children: ReactNode;
    disabled?: boolean;
    isActive?: boolean;
    label: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
    return (
        <button
            aria-label={label}
            aria-controls={ariaControls}
            aria-expanded={ariaExpanded}
            className={cn(
                'grid size-11 place-items-center rounded-xl transition hover:bg-[var(--map-side-control-hover-background)] hover:text-[var(--map-side-control-active-icon-color)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none',
                disabled &&
                    'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-[var(--map-side-control-icon-color)]',
            )}
            disabled={disabled}
            onClick={onClick}
            style={{
                background: isActive
                    ? 'var(--map-side-control-active-background)'
                    : undefined,
                color: isActive
                    ? 'var(--map-side-control-active-icon-color, var(--map-side-control-active-text-color))'
                    : 'var(--map-side-control-icon-color, var(--map-side-control-text-color))',
                cursor: disabled
                    ? 'var(--platform-denied-cursor)'
                    : 'var(--platform-action-cursor)',
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
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        closeButtonRef.current?.focus();
    }, []);

    return (
        <div
            aria-labelledby={`${id}-title`}
            aria-modal="true"
            className="learner-scroll-region flex max-h-[calc(100svh-10rem)] w-[min(18rem,calc(100vw-1.5rem))] flex-col overscroll-contain rounded-xl border p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-md sm:max-h-[calc(100svh-8rem)] dark:shadow-black/35"
            id={id}
            role="dialog"
            style={{
                background: 'var(--map-side-control-panel-background)',
                borderColor: 'var(--map-side-control-panel-border-color)',
                color: 'var(--map-side-control-text-color)',
            }}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p
                        className="text-xs font-medium tracking-[0.16em] uppercase"
                        style={{ color: 'var(--map-floating-accent-color)' }}
                    >
                        {eyebrow}
                    </p>
                    <h2
                        id={`${id}-title`}
                        className="text-sm font-semibold"
                        style={{ color: 'var(--map-side-control-text-color)' }}
                    >
                        {title}
                    </h2>
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

function ToolGrid({
    mode,
    onClose,
    selectedTool,
    tools,
}: {
    mode: 'dark' | 'light';
    onClose: () => void;
    selectedTool: LearningTool | null;
    tools: LearningTool[];
}) {
    if (tools.length === 0) {
        return <EmptyOverlayState>No tools acquired yet.</EmptyOverlayState>;
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            {tools.map((tool) => (
                <button
                    className={cn(
                        'grid aspect-square place-items-center rounded-lg border p-2 transition hover:-translate-y-0.5 hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none',
                        selectedTool?.id === tool.id &&
                            'border-[var(--map-floating-accent-color)] bg-[var(--map-side-control-hover-background)]',
                    )}
                    key={tool.id}
                    onClick={() => {
                        selectLearningTool(
                            selectedTool?.id === tool.id ? null : tool,
                        );
                        onClose();
                    }}
                    style={
                        {
                            background:
                                selectedTool?.id === tool.id
                                    ? 'var(--map-side-control-hover-background)'
                                    : 'var(--map-side-control-panel-background)',
                            borderColor:
                                selectedTool?.id === tool.id
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
                    <span
                        className="mt-1 max-w-full truncate text-[0.65rem] font-medium"
                        style={{
                            color: 'var(--map-side-control-text-color)',
                        }}
                    >
                        {tool.title}
                    </span>
                </button>
            ))}
        </div>
    );
}

function EmptyOverlayState({ children }: { children: ReactNode }) {
    return (
        <p
            className="rounded-lg border border-dashed p-3 text-sm leading-6"
            style={{
                borderColor: 'var(--map-side-control-panel-border-color)',
                color: 'var(--map-side-control-muted-text-color)',
            }}
        >
            {children}
        </p>
    );
}

function ToolImage({
    className,
    mode,
    tool,
}: {
    className?: string;
    mode: 'dark' | 'light';
    tool: LearningTool;
}) {
    const image = toolImageUrl(tool, mode);

    if (!image) {
        return <Hammer className={cn('text-current', className)} />;
    }

    return (
        <img
            alt=""
            className={cn('object-contain', className)}
            draggable={false}
            src={image}
        />
    );
}
