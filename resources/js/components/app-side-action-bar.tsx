import { router, usePage } from '@inertiajs/react';
import { Backpack, Hammer, NotebookPen, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useAvailableLearningItems } from '@/features/items/item-inventory';
import { JournalOverlay } from '@/features/journal/journal-overlay';
import {
    selectLearningTool,
    useAvailableLearningTools,
    useSelectedLearningTool,
} from '@/features/tools/tool-selection';
import { toolImageUrl } from '@/features/tools/tool-visuals';
import { useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type { LearningItem, LearningTool, User } from '@/types';

type OverlayMode = 'inventory' | 'journal' | 'tools' | null;
type MapThemedStyle = CSSProperties & Record<`--${string}`, string>;

export function AppSideActionBar() {
    const { props, url } = usePage();
    const { resolvedAppearance } = useAppearance();
    const [overlay, setOverlay] = useState<OverlayMode>(null);
    const selectedTool = useSelectedLearningTool();
    const items = useAvailableLearningItems(props.auth.items);
    const tools = useAvailableLearningTools(props.auth.tools);
    const user = props.auth.user;
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
            {overlay === 'journal' ? (
                <JournalOverlay onClose={() => setOverlay(null)} />
            ) : null}

            <nav
                className="grid gap-1.5 rounded-2xl border p-1.5 shadow-2xl shadow-slate-950/15 backdrop-blur-md dark:shadow-black/35"
                style={{
                    background: 'var(--map-side-control-background)',
                    borderColor: 'var(--map-side-control-border-color)',
                    color: 'var(--map-side-control-text-color)',
                    cursor: 'var(--platform-cursor)',
                }}
            >
                <ActionButton
                    label="Open personal settings"
                    onClick={() => {
                        setOverlay(null);
                        router.visit('/settings/personal?section=profile');
                    }}
                >
                    <ProfileActionAvatar user={user} />
                </ActionButton>
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
                    isActive={overlay === 'journal'}
                    label="Open journal"
                    onClick={() =>
                        setOverlay((current) =>
                            current === 'journal' ? null : 'journal',
                        )
                    }
                >
                    <NotebookPen className="size-5" />
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

function ProfileActionAvatar({ user }: { user: User | null }) {
    const getInitials = useInitials();
    const displayName = user?.username || user?.name || 'User';
    const imageUrl = normalizeMediaUrl(user?.profile_image || user?.avatar);

    if (imageUrl) {
        return (
            <span
                className="grid size-7 place-items-center overflow-hidden rounded-full border"
                style={{
                    borderColor: 'var(--map-floating-accent-color)',
                }}
            >
                <img
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                    src={imageUrl}
                />
            </span>
        );
    }

    return (
        <span
            className="grid size-7 place-items-center rounded-full text-xs font-semibold"
            style={{
                background:
                    'color-mix(in srgb, var(--map-floating-accent-color) 28%, transparent)',
                boxShadow:
                    'inset 0 0 0 1px color-mix(in srgb, var(--map-floating-accent-color) 62%, transparent)',
                color: 'var(--map-floating-accent-color)',
            }}
        >
            {getInitials(displayName)}
        </span>
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
        return <EmptyOverlayState>No items acquired yet.</EmptyOverlayState>;
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
    onClose,
    title,
}: {
    children: ReactNode;
    eyebrow: string;
    onClose: () => void;
    title: string;
}) {
    return (
        <div
            className="w-72 rounded-xl border p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-md dark:shadow-black/35"
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
                        className="text-sm font-semibold"
                        style={{ color: 'var(--map-side-control-text-color)' }}
                    >
                        {title}
                    </h2>
                </div>
                <button
                    className="rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                    onClick={onClose}
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
