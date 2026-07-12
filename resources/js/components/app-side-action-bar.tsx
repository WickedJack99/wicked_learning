import { usePage } from '@inertiajs/react';
import { Backpack, Hammer, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAvailableLearningItems } from '@/features/items/item-inventory';
import {
    selectLearningTool,
    useAvailableLearningTools,
    useSelectedLearningTool,
} from '@/features/tools/tool-selection';
import { toolImageUrl } from '@/features/tools/tool-visuals';
import { useAppearance } from '@/hooks/use-appearance';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type { LearningItem, LearningTool } from '@/types';

type OverlayMode = 'inventory' | 'tools' | null;

export function AppSideActionBar() {
    const { props, url } = usePage();
    const { resolvedAppearance } = useAppearance();
    const [overlay, setOverlay] = useState<OverlayMode>(null);
    const selectedTool = useSelectedLearningTool();
    const items = useAvailableLearningItems(props.auth.items);
    const tools = useAvailableLearningTools(props.auth.tools);
    const shouldShow = useMemo(
        () =>
            Boolean(props.auth.user) &&
            (url.startsWith('/world') ||
                url.startsWith('/bookmarks') ||
                url.startsWith('/learning/')),
        [props.auth.user, url],
    );

    if (!shouldShow) {
        return null;
    }

    return (
        <aside
            aria-label="Player actions"
            className="fixed top-1/2 right-3 z-40 flex -translate-y-1/2 items-center gap-3 md:right-5"
        >
            {overlay === 'inventory' ? (
                <SideOverlay
                    eyebrow="Inventory"
                    onClose={() => setOverlay(null)}
                    title="Items"
                >
                    <ItemGrid items={items} mode={resolvedAppearance} />
                </SideOverlay>
            ) : null}
            {overlay === 'tools' ? (
                <SideOverlay
                    eyebrow="Tools"
                    onClose={() => setOverlay(null)}
                    title="Select a tool"
                >
                    <ToolGrid
                        mode={resolvedAppearance}
                        onClose={() => setOverlay(null)}
                        selectedTool={selectedTool}
                        tools={tools}
                    />
                </SideOverlay>
            ) : null}

            <nav
                className="grid gap-1.5 rounded-2xl border border-slate-200 bg-white/88 p-1.5 shadow-2xl shadow-slate-950/15 backdrop-blur-md dark:border-white/12 dark:bg-slate-950/82 dark:shadow-black/35"
                style={{
                    background: 'var(--map-side-control-background)',
                    borderColor: 'var(--map-side-control-border-color)',
                    color: 'var(--map-side-control-text-color)',
                    cursor: 'var(--platform-cursor)',
                }}
            >
                <ActionButton
                    isActive={overlay === 'inventory'}
                    label="Open inventory"
                    onClick={() =>
                        setOverlay((current) =>
                            current === 'inventory' ? null : 'inventory',
                        )
                    }
                >
                    <Backpack className="size-5" />
                </ActionButton>
                <ActionButton
                    isActive={overlay === 'tools' || Boolean(selectedTool)}
                    label="Open tools"
                    onClick={() => {
                        if (selectedTool) {
                            selectLearningTool(null);
                            setOverlay(null);

                            return;
                        }

                        setOverlay((current) =>
                            current === 'tools' ? null : 'tools',
                        );
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
                    disabled
                    label="Competence star map"
                    onClick={() => undefined}
                >
                    <Sparkles className="size-5" />
                </ActionButton>
            </nav>
        </aside>
    );
}

function ItemGrid({
    items,
    mode,
}: {
    items: LearningItem[];
    mode: 'dark' | 'light';
}) {
    if (items.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                No items acquired yet.
            </p>
        );
    }

    return (
        <div className="max-h-80 overflow-y-auto pr-1">
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
            className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-700 transition hover:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100 dark:focus-visible:ring-teal-200"
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData(
                    'application/learning-item-id',
                    item.id.toString(),
                );
                event.dataTransfer.effectAllowed = 'move';
            }}
            style={{ cursor: 'var(--platform-action-cursor)' }}
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
            <span className="absolute right-1 bottom-1 min-w-5 rounded bg-slate-950/82 px-1 text-center text-[0.65rem] font-semibold text-white dark:bg-teal-300 dark:text-slate-950">
                {item.quantity}
            </span>
            <span className="sr-only">{item.title}</span>
        </button>
    );
}

function ActionButton({
    children,
    disabled = false,
    isActive = false,
    label,
    onClick,
}: {
    children: ReactNode;
    disabled?: boolean;
    isActive?: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            aria-label={label}
            className={cn(
                'grid size-11 place-items-center rounded-xl text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-teal-200 dark:focus-visible:ring-teal-200',
                isActive &&
                    'bg-cyan-500 text-slate-950 hover:bg-cyan-400 hover:text-slate-950 dark:bg-teal-300 dark:text-slate-950 dark:hover:bg-teal-200',
                disabled &&
                    'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-600 dark:hover:bg-transparent dark:hover:text-slate-300',
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
    onClose,
    title,
}: {
    children: ReactNode;
    eyebrow: string;
    onClose: () => void;
    title: string;
}) {
    return (
        <div className="w-72 rounded-xl border border-slate-200 bg-white/94 p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-md dark:border-white/12 dark:bg-slate-950/90 dark:shadow-black/35">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200/70">
                        {eyebrow}
                    </p>
                    <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                        {title}
                    </h2>
                </div>
                <Button
                    onClick={onClose}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    Close
                </Button>
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
        return (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                No tools acquired yet.
            </p>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            {tools.map((tool) => (
                <button
                    className={cn(
                        'grid aspect-square place-items-center rounded-lg border border-slate-200 bg-slate-50 p-2 transition hover:-translate-y-0.5 hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:border-white/10 dark:bg-white/6 dark:hover:bg-teal-200/10 dark:focus-visible:ring-teal-200',
                        selectedTool?.id === tool.id &&
                            'border-cyan-600 bg-cyan-50 dark:border-teal-200 dark:bg-teal-200/10',
                    )}
                    key={tool.id}
                    onClick={() => {
                        selectLearningTool(
                            selectedTool?.id === tool.id ? null : tool,
                        );
                        onClose();
                    }}
                    title={tool.title}
                    type="button"
                >
                    <ToolImage className="size-10" mode={mode} tool={tool} />
                    <span className="mt-1 max-w-full truncate text-[0.65rem] font-medium text-slate-600 dark:text-slate-300">
                        {tool.title}
                    </span>
                </button>
            ))}
        </div>
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
