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
        <section className="grid shrink-0 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xl lg:grid-cols-[18rem_minmax(0,1fr)] dark:border-white/10 dark:bg-[#111820]">
            <div className="grid max-h-64 content-start gap-2 overflow-y-auto">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    World maps
                </p>
                {maps.map((map) => (
                    <button
                        className={cn(
                            'rounded-lg border p-3 text-left text-sm transition',
                            selectedMap?.id === map.id
                                ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)]'
                                : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
                        )}
                        key={map.id}
                        onClick={() => setSelectedMapId(map.id)}
                        type="button"
                    >
                        <span className="block font-semibold">{map.title}</span>
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                            {map.nodeCount} tile{map.nodeCount === 1 ? '' : 's'}
                        </span>
                    </button>
                ))}
            </div>

            <div className="min-w-0">
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
                                        href={`/settings/worlds/maps/${selectedMap.id}/configure`}
                                    >
                                        Configure map
                                    </Link>
                                </Button>
                                <Button asChild>
                                    <Link
                                        href={`/settings/worlds/maps/${selectedMap.id}/edit`}
                                    >
                                        Configure nodes
                                    </Link>
                                </Button>
                            </div>
                        </div>
                        <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-white/10">
                            {selectedMap.nodes.map((node) => (
                                <Link
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"
                                    href={`/settings/worlds/nodes/${node.id}/activities`}
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
                                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                                    No nodes yet.
                                </p>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        Create a map before configuring map or node access.
                    </p>
                )}
            </div>
        </section>
    );
}
