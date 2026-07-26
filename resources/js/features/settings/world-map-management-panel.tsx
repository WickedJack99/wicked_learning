import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WorldMapManagementNode = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
};

export type WorldMapManagementMap = {
    description: string | null;
    id: number;
    nodeCount: number;
    nodes: WorldMapManagementNode[];
    slug: string;
    title: string;
};

export type WorldMapManagementGraph = {
    maps: WorldMapManagementMap[];
};

export function WorldMapManagementPanel({
    maps,
}: {
    maps: WorldMapManagementMap[];
}) {
    const [selectedMapId, setSelectedMapId] = useState<number | null>(
        maps[0]?.id ?? null,
    );
    const selectedMap =
        maps.find((map) => map.id === selectedMapId) ?? maps[0] ?? null;

    return (
        <section className="grid h-full min-h-0 gap-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    World maps
                </p>
                <div className="mt-3 grid gap-2">
                    {maps.map((map) => (
                        <button
                            className={cn(
                                'relative rounded-lg px-3 py-3 text-left text-sm transition',
                                selectedMap?.id === map.id
                                    ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                    : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                            )}
                            key={map.id}
                            onClick={() => setSelectedMapId(map.id)}
                            type="button"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--settings-accent)] transition-opacity',
                                    selectedMap?.id === map.id
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                )}
                            />
                            <span className="block font-semibold">
                                {map.title}
                            </span>
                            <span className="mt-1 block text-xs opacity-80">
                                {map.nodeCount} tile
                                {map.nodeCount === 1 ? '' : 's'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-5">
                {selectedMap ? (
                    <div className="grid gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                    Selected map
                                </p>
                                <h2 className="mt-1 text-xl font-semibold">
                                    {selectedMap.title}
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    {selectedMap.description ??
                                        'No map description yet.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button asChild variant="secondary">
                                    <Link
                                        href={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&worldView=configure`}
                                    >
                                        Configure map
                                    </Link>
                                </Button>
                                <Button asChild>
                                    <Link
                                        href={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&worldView=nodes`}
                                    >
                                        Configure nodes
                                    </Link>
                                </Button>
                            </div>
                        </div>
                        <div className="grid max-h-72 gap-2 overflow-y-auto border-t border-[var(--settings-border-color)] pt-3">
                            {selectedMap.nodes.map((node) => (
                                <Link
                                    className="border-b border-[var(--settings-border-color)] px-1 py-3 text-sm transition hover:text-[var(--settings-accent)]"
                                    href={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&node=${node.id}&worldView=nodes`}
                                    key={node.id}
                                >
                                    <span className="block font-semibold">
                                        {node.title}
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                        {node.description ?? node.slug}
                                    </span>
                                </Link>
                            ))}
                            {selectedMap.nodes.length === 0 ? (
                                <p className="border border-dashed border-[var(--settings-border-color)] p-3 text-sm text-[var(--settings-muted-text)]">
                                    No nodes yet.
                                </p>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <p className="border border-dashed border-[var(--settings-border-color)] p-4 text-sm text-[var(--settings-muted-text)]">
                        Create a map before configuring map or node access.
                    </p>
                )}
            </div>
        </section>
    );
}
