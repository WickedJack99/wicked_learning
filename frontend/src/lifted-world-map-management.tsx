import { GitBranch, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router';
import { type ReactNode, useState } from 'react';

import type { components } from './api/schema';
import { LiftedButton } from './lifted-button';
import { classNames } from './lifted-class-names';

type RustMapSummary = components['schemas']['AdminMapSummary'];

type WorldMapManagementNode = {
    activityReviewCount: number;
    description: string | null;
    id: string;
    slug: string;
    title: string;
};

type WorldMapManagementMap = {
    description: string | null;
    id: string;
    nodeCount: number;
    nodes: WorldMapManagementNode[];
    reviewCount: number;
    slug: string;
    title: string;
};

type WorldMapManagementDetail = {
    activeView: 'configure' | 'nodes';
    content: ReactNode;
    mapId: string;
    mapTitle: string;
    nodeId?: string;
    nodeTitle?: string;
};

/** Only adapts Rust's field names before the pinned source component renders. */
function adaptRustMap(map: RustMapSummary): WorldMapManagementMap {
    return {
        description: map.description,
        id: map.id,
        nodeCount: map.node_count,
        nodes: map.nodes.map((node) => ({
            activityReviewCount: node.activity_review_count,
            description: node.description,
            id: node.id,
            slug: node.slug,
            title: node.title,
        })),
        reviewCount: map.review_count,
        slug: map.slug,
        title: map.title,
    };
}

type RustNavigationLinkProps = {
    children: ReactNode;
    className?: string;
    onNavigate: () => void;
    onSelect?: () => void;
    to: string;
};

/** React Router replacement for the source Inertia Link boundary. */
function RustNavigationLink({
    children,
    className,
    onNavigate,
    onSelect,
    to,
}: RustNavigationLinkProps) {
    return (
        <Link
            className={className}
            onClick={(event) => {
                onSelect?.();
                event.preventDefault();
                onNavigate();
            }}
            to={to}
        >
            {children}
        </Link>
    );
}

/**
 * Direct lift of main:resources/js/features/settings/world-map-management-panel.tsx
 * `WorldMapManagementPanel`. React Router navigation and Rust field names are
 * the only transport seams.
 */
export function LiftedWorldMapManagementPanel({
    detail = null,
    maps: rustMaps,
    onSelectMap,
    onSelectMapConfiguration,
    onSelectNode,
}: {
    detail?: WorldMapManagementDetail | null;
    maps: RustMapSummary[];
    onSelectMap: (mapId: string) => void;
    onSelectMapConfiguration: (mapId: string) => void;
    onSelectNode: (mapId: string, nodeId: string) => void;
}) {
    const maps = rustMaps.map(adaptRustMap);
    const [selectedMapId, setSelectedMapId] = useState<string | null>(
        detail?.mapId ?? maps[0]?.id ?? null,
    );
    const activeMapId = detail?.mapId ?? selectedMapId;
    const selectedMap =
        maps.find((map) => map.id === activeMapId) ?? maps[0] ?? null;
    const showDetailContent =
        detail?.activeView === 'configure' || Boolean(detail?.nodeId);

    return (
        <section
            className="grid h-full min-h-0 gap-0 lg:grid-cols-[18rem_18rem_minmax(0,1fr)]"
            data-wl-id="authoring.world-builder.structural-workspace"
        >
            <div className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    World maps
                </p>
                <div className="mt-3 grid gap-2">
                    {maps.map((map) => (
                        <RustNavigationLink
                            className={classNames(
                                'relative rounded-lg px-3 py-3 text-left text-sm transition',
                                selectedMap?.id === map.id
                                    ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                    : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                            )}
                            key={map.id}
                            onNavigate={() => onSelectMap(map.id)}
                            onSelect={() => setSelectedMapId(map.id)}
                            to={`/settings?panel=admin-world-builder&worldSection=structural&map=${map.id}`}
                        >
                            <span
                                aria-hidden="true"
                                className={classNames(
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
                            {map.reviewCount > 0 ? (
                                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-200">
                                    {map.reviewCount}{' '}
                                    {map.reviewCount === 1
                                        ? 'activity needs'
                                        : 'activities need'}{' '}
                                    review
                                </span>
                            ) : null}
                        </RustNavigationLink>
                    ))}
                </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] lg:border-r lg:border-b-0">
                {selectedMap ? (
                    <>
                        <div className="shrink-0 border-b border-[var(--settings-border-color)] px-4 py-4">
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                Selected map
                            </p>
                            <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                                {selectedMap.title}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">
                                {selectedMap.description ??
                                    'No map description yet.'}
                            </p>
                        </div>

                        <nav className="min-h-0 flex-1 overflow-y-auto p-3">
                            <RustNavigationLink
                                className={classNames(
                                    'relative mb-2 flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left text-sm transition',
                                    detail?.activeView === 'configure'
                                        ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                        : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                                )}
                                onNavigate={() =>
                                    onSelectMapConfiguration(selectedMap.id)
                                }
                                to={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&worldView=configure`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={classNames(
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
                            </RustNavigationLink>

                            <p className="px-3 pt-3 pb-2 text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                MapAssets
                            </p>
                            <div className="grid gap-2">
                                {selectedMap.nodes.map((node) => (
                                    <RustNavigationLink
                                        className={classNames(
                                            'relative flex items-start gap-3 rounded-lg px-3 py-3 text-sm transition',
                                            detail?.nodeId === node.id
                                                ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                                : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                                        )}
                                        key={node.id}
                                        onNavigate={() =>
                                            onSelectNode(selectedMap.id, node.id)
                                        }
                                        to={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&node=${node.id}&worldView=nodes`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={classNames(
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
                                            {node.activityReviewCount > 0 ? (
                                                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-200">
                                                    {node.activityReviewCount}{' '}
                                                    {node.activityReviewCount ===
                                                    1
                                                        ? 'activity needs'
                                                        : 'activities need'}{' '}
                                                    review
                                                </span>
                                            ) : null}
                                        </span>
                                    </RustNavigationLink>
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
                        Create a map before configuring map or MapAsset access.
                    </p>
                )}
            </div>

            <div className="min-h-0 min-w-0 overflow-hidden bg-[var(--settings-panel-background)]">
                {selectedMap && showDetailContent && detail ? (
                    detail.content
                ) : selectedMap ? (
                    <div className="grid h-full min-h-0 place-items-center overflow-hidden p-5 text-center">
                        <div className="max-w-xl">
                            <GitBranch className="mx-auto size-8 text-[var(--settings-accent)]" />
                            <h2 className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">
                                {selectedMap.title}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--settings-muted-text)]">
                                Select a MapAsset to edit its activities, or
                                open the map configuration for details, visuals
                                and access.
                            </p>
                            <LiftedButton
                                asChild
                                className="mt-5"
                                variant="secondary"
                            >
                                <RustNavigationLink
                                    onNavigate={() =>
                                        onSelectMapConfiguration(selectedMap.id)
                                    }
                                    to={`/settings?panel=admin-world-builder&worldSection=structural&map=${selectedMap.id}&worldView=configure`}
                                >
                                    Configure map
                                </RustNavigationLink>
                            </LiftedButton>
                        </div>
                    </div>
                ) : (
                    <p className="m-4 border border-dashed border-[var(--settings-border-color)] p-4 text-sm text-[var(--settings-muted-text)] sm:m-5">
                        Create a map before configuring map or MapAsset access.
                    </p>
                )}
            </div>
        </section>
    );
}
