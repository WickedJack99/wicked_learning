import { Link } from '@inertiajs/react';
import { GitBranch, Map as MapIcon, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { SettingsLevelBanner } from '@/components/settings-configuration-shell';
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

type WorldMapManagementDetail = {
    activeView: 'configure' | 'nodes';
    content: ReactNode;
    mapId: number;
    mapTitle: string;
    nodeId?: number;
    nodeTitle?: string;
};

export function WorldMapManagementPanel({
    detail = null,
    maps,
}: {
    detail?: WorldMapManagementDetail | null;
    maps: WorldMapManagementMap[];
}) {
    const [selectedMapId, setSelectedMapId] = useState<number | null>(
        detail?.mapId ?? maps[0]?.id ?? null,
    );
    const activeMapId = detail?.mapId ?? selectedMapId;
    const selectedMap =
        maps.find((map) => map.id === activeMapId) ?? maps[0] ?? null;
    const showDetailContent =
        detail?.activeView === 'configure' || Boolean(detail?.nodeId);

    useEffect(() => {
        if (detail?.mapId) {
            setSelectedMapId(detail.mapId);
        }
    }, [detail?.mapId]);

    return (
        <section className="grid h-full min-h-0 gap-0 lg:grid-cols-[18rem_18rem_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    World maps
                </p>
                <div className="mt-3 grid gap-2">
                    {maps.map((map) => (
                        <Link
                            className={cn(
                                'relative rounded-lg px-3 py-3 text-left text-sm transition',
                                selectedMap?.id === map.id
                                    ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                    : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                            )}
                            href={`/settings?panel=admin-world-builder&worldSection=structural&map=${map.id}`}
                            key={map.id}
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
                        </Link>
                    ))}
                </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] lg:border-r lg:border-b-0">
                {selectedMap ? (
                    <>
                        <SettingsLevelBanner
                            className="bg-transparent px-4"
                            contentClassName="lg:max-w-none"
                            description={
                                selectedMap.description ??
                                'No map description yet.'
                            }
                            eyebrow="Selected map"
                            icon={MapIcon}
                            title={selectedMap.title}
                        />

                        <nav className="min-h-0 flex-1 overflow-y-auto p-3">
                            <Link
                                className={cn(
                                    'relative mb-2 flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left text-sm transition',
                                    detail?.activeView === 'configure'
                                        ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                        : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                                )}
                                href={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&worldView=configure`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--settings-accent)] transition-opacity',
                                        detail?.activeView === 'configure'
                                            ? 'opacity-100'
                                            : 'opacity-0',
                                    )}
                                />
                                <SlidersHorizontal className="mt-0.5 size-4 shrink-0" />
                                <span className="min-w-0">
                                    <span className="block font-semibold">
                                        Map configuration
                                    </span>
                                    <span className="mt-1 block text-xs opacity-80">
                                        Details, visuals and access.
                                    </span>
                                </span>
                            </Link>

                            <p className="px-3 pt-3 pb-2 text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                Nodes
                            </p>
                            <div className="grid gap-2">
                                {selectedMap.nodes.map((node) => (
                                    <Link
                                        className={cn(
                                            'relative flex items-start gap-3 rounded-lg px-3 py-3 text-sm transition',
                                            detail?.nodeId === node.id
                                                ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                                : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                                        )}
                                        href={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&node=${node.id}&worldView=nodes`}
                                        key={node.id}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--settings-accent)] transition-opacity',
                                                detail?.nodeId === node.id
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                            )}
                                        />
                                        <GitBranch className="mt-0.5 size-4 shrink-0" />
                                        <span className="min-w-0">
                                            <span className="block truncate font-semibold">
                                                {node.title}
                                            </span>
                                            <span className="mt-1 line-clamp-2 text-xs opacity-80">
                                                {node.description ?? node.slug}
                                            </span>
                                        </span>
                                    </Link>
                                ))}
                                {selectedMap.nodes.length === 0 ? (
                                    <p className="border border-dashed border-[var(--settings-border-color)] p-3 text-sm text-[var(--settings-muted-text)]">
                                        No nodes yet.
                                    </p>
                                ) : null}
                            </div>
                        </nav>
                    </>
                ) : (
                    <p className="m-4 border border-dashed border-[var(--settings-border-color)] p-4 text-sm text-[var(--settings-muted-text)]">
                        Create a map before configuring map or node access.
                    </p>
                )}
            </div>

            <div className="min-h-0 min-w-0 overflow-hidden bg-[var(--settings-panel-background)]">
                {selectedMap && showDetailContent && detail ? (
                    detail.content
                ) : selectedMap ? (
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                        <SettingsLevelBanner
                            className="bg-[var(--settings-sidebar-background)]"
                            action={
                                <Button asChild variant="secondary">
                                    <Link
                                        href={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&worldView=configure`}
                                    >
                                        Configure map
                                    </Link>
                                </Button>
                            }
                            description="Select a node to edit its activities, or open the map configuration for details, visuals and access."
                            eyebrow="Node activity editing"
                            icon={GitBranch}
                            title={selectedMap.title}
                        />
                    </div>
                ) : (
                    <p className="m-4 border border-dashed border-[var(--settings-border-color)] p-4 text-sm text-[var(--settings-muted-text)] sm:m-5">
                        Create a map before configuring map or node access.
                    </p>
                )}
            </div>
        </section>
    );
}
