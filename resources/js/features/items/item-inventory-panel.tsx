import { usePage } from '@inertiajs/react';
import { Package, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type { LearningItem } from '@/types';
import { useAvailableLearningItems } from './item-inventory';

export function ItemInventoryPanel() {
    const { props } = usePage();
    const [isOpen, setIsOpen] = useState(false);
    const items = useAvailableLearningItems(props.auth.items);

    return (
        <div className="fixed top-1/2 right-4 z-30 -translate-y-1/2">
            <div
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white/88 p-1.5 shadow-xl backdrop-blur-md dark:border-white/12 dark:bg-slate-950/82"
                style={{
                    background: 'var(--map-side-control-background)',
                    borderColor: 'var(--map-side-control-border-color)',
                    color: 'var(--map-side-control-text-color)',
                    cursor: 'var(--platform-cursor)',
                }}
            >
                <Button
                    aria-label="Open inventory"
                    className={cn(
                        'size-10 rounded-xl',
                        isOpen &&
                            'bg-cyan-600 text-white dark:bg-teal-300 dark:text-slate-950',
                    )}
                    onClick={() => setIsOpen((current) => !current)}
                    size="icon"
                    style={{
                        background: isOpen
                            ? 'var(--map-side-control-active-background)'
                            : undefined,
                        color: isOpen
                            ? 'var(--map-side-control-active-text-color)'
                            : 'var(--map-side-control-text-color)',
                        cursor: 'var(--platform-action-cursor)',
                    }}
                    type="button"
                    variant="ghost"
                >
                    <Package className="size-4" />
                </Button>
            </div>

            {isOpen ? (
                <InventoryPopover
                    items={items}
                    onClose={() => setIsOpen(false)}
                />
            ) : null}
        </div>
    );
}

function InventoryPopover({
    items,
    onClose,
}: {
    items: LearningItem[];
    onClose: () => void;
}) {
    return (
        <div
            className="absolute top-1/2 right-14 w-64 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]"
            style={{
                background: 'var(--map-side-control-background)',
                borderColor: 'var(--map-side-control-border-color)',
                color: 'var(--map-side-control-text-color)',
                cursor: 'var(--platform-cursor)',
            }}
        >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 dark:border-white/10">
                <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        Inventory
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Drag items into matching slots.
                    </p>
                </div>
                <Button
                    aria-label="Close inventory"
                    onClick={onClose}
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <X className="size-4" />
                </Button>
            </header>
            <div className="max-h-[22rem] overflow-y-auto p-3">
                {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No consumable items yet.
                    </p>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {items.map((item) => (
                            <InventoryItem item={item} key={item.id} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function InventoryItem({ item }: { item: LearningItem }) {
    const { resolvedAppearance } = useAppearance();
    const image = normalizeMediaUrl(
        resolvedAppearance === 'light'
            ? item.imageLight || item.imageDark
            : item.imageDark || item.imageLight,
    );

    return (
        <button
            className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-700 transition hover:border-cyan-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData(
                    'application/learning-item-id',
                    item.id.toString(),
                );
                event.dataTransfer.effectAllowed = 'move';
            }}
            title={item.title}
            type="button"
            style={{ cursor: 'var(--platform-action-cursor)' }}
        >
            {image ? (
                <img
                    alt=""
                    className="h-full w-full object-contain"
                    draggable={false}
                    src={image}
                />
            ) : (
                <Package className="size-6" />
            )}
            <span className="absolute right-1 bottom-1 min-w-5 rounded bg-slate-950/82 px-1 text-center text-[0.65rem] font-semibold text-white dark:bg-teal-300 dark:text-slate-950">
                {item.quantity}
            </span>
        </button>
    );
}
