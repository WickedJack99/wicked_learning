import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
    useNodesState,
} from '@xyflow/react';
import type { Edge, FitViewOptions, Node, ReactFlowInstance } from '@xyflow/react';
import { Download, GitBranch, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

import type { components } from './api/schema';
import { LiftedButton } from './lifted-button';
import { classNames } from './lifted-class-names';
import { LiftedSpinner } from './lifted-spinner';
import { LiftedWorldBuilderCreateMapDialog } from './lifted-world-builder-create-map-dialog';
import { LiftedMapExportValidationDialog } from './lifted-world-builder-map-export-validation';
import {
    LiftedWorldBuilderMapImportDialog,
    LiftedWorldBuilderWorldImportDialog,
} from './lifted-world-builder-world-import-dialog';
import { LiftedWorldBuilderWorldDetailsDialog } from './lifted-world-builder-world-details-dialog';
import { usePlatformTranslation } from './original-platform-translation';
import type { OriginalAppearance } from './original-appearance';

type RustWorldGraph = components['schemas']['AdminWorldGraph'];
type RustMapSummary = components['schemas']['AdminMapSummary'];
type RustNodeSummary = components['schemas']['AdminNodeSummary'];
type RustPortalLink = components['schemas']['AdminPortalLink'];

type SourceNodeSummary = {
    activityReviewCount: number;
    description: string | null;
    id: string;
    slug: string;
    title: string;
};

type SourceMapSummary = {
    description: string | null;
    id: string;
    native: RustMapSummary;
    nodeCount: number;
    nodes: SourceNodeSummary[];
    reviewCount: number;
    slug: string;
    title: string;
    updatedAt: string | null;
};

type SourcePortalActivitySummary = {
    id: string;
    title: string;
    type: string;
};

type SourcePortalLinkSummary = {
    description: string | null;
    id: string;
    label: string | null;
    native: RustPortalLink;
    sourceActivity: SourcePortalActivitySummary | null;
    sourceMapId: string;
    sourceNode: SourceNodeSummary;
    targetActivity: SourcePortalActivitySummary | null;
    targetMapId: string;
    targetNode: SourceNodeSummary;
};

type SourceWorldGraph = {
    maps: SourceMapSummary[];
    portalLinks: SourcePortalLinkSummary[];
};

type MapNodeData = {
    map: SourceMapSummary;
};

type MapGraphNode = Node<MapNodeData, 'mapNode'>;
type PortalEdge = Edge<SourcePortalLinkSummary>;
type GraphSide = 'bottom' | 'left' | 'right' | 'top';
type GraphHandleLane = -2 | -1 | 0 | 1 | 2;

const mapNodeSize = {
    height: 150,
    width: 224,
};

const graphHandleLanes: GraphHandleLane[] = [-2, -1, 0, 1, 2];
const graphHandleLanePercent: Record<GraphHandleLane, number> = {
    [-2]: 22,
    [-1]: 36,
    0: 50,
    1: 64,
    2: 78,
};

/**
 * Direct adapter from the Rust OpenAPI projection to the pinned-main
 * `WorldGraph` property names.  No presentation or graph behavior is derived
 * here; the fields below are the complete source graph read contract.
 */
export function adaptRustWorldGraph(graph: RustWorldGraph): SourceWorldGraph {
    return {
        maps: graph.maps.map((map) => ({
            description: map.description,
            id: map.id,
            native: map,
            nodeCount: map.node_count,
            nodes: map.nodes.map(adaptRustNode),
            reviewCount: map.review_count,
            slug: map.slug,
            title: map.title,
            updatedAt: map.updated_at,
        })),
        portalLinks: graph.portal_links.map((portal) => ({
            description: portal.description,
            id: portal.id,
            label: portal.label,
            native: portal,
            sourceActivity: portal.source_activity
                ? {
                      id: portal.source_activity.id,
                      title: portal.source_activity.title,
                      type: portal.source_activity.activity_type,
                  }
                : null,
            sourceMapId: portal.source_map_id,
            sourceNode: adaptRustNode(portal.source_node),
            targetActivity: portal.target_activity
                ? {
                      id: portal.target_activity.id,
                      title: portal.target_activity.title,
                      type: portal.target_activity.activity_type,
                  }
                : null,
            targetMapId: portal.target_map_id,
            targetNode: adaptRustNode(portal.target_node),
        })),
    };
}

function adaptRustNode(node: RustNodeSummary): SourceNodeSummary {
    return {
        activityReviewCount: node.activity_review_count,
        description: node.description,
        id: node.id,
        slug: node.slug,
        title: node.title,
    };
}

type Props = {
    appearance: OriginalAppearance;
    graph: RustWorldGraph;
    onMapCreated: (mapId: string) => void;
    onMapImported: (mapId: string) => void;
    onWorldUpdated: () => void;
    onWorldImported: (mapIds: string[]) => void;
    renderSelectedMap: (map: RustMapSummary) => ReactNode;
    renderSelectedPortal: (portal: RustPortalLink) => ReactNode;
};

/**
 * Lifted from main:resources/js/pages/settings/worlds/index.tsx.
 *
 * This slice deliberately retains the existing selected-map and selected-portal
 * renderers behind explicit slots. Their source lift is a later audited slice.
 */
export function LiftedWorldBuilderGraph({
    appearance,
    graph,
    onMapCreated,
    onMapImported,
    onWorldUpdated,
    onWorldImported,
    renderSelectedMap,
    renderSelectedPortal,
}: Props) {
    const sourceGraph = useMemo(() => adaptRustWorldGraph(graph), [graph]);
    const t = usePlatformTranslation();
    const initialNodes = useMemo(
        () => buildGraphNodes(sourceGraph.maps),
        [sourceGraph.maps],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(
        null,
    );
    const edges = useMemo(
        () =>
            buildGraphEdges(
                sourceGraph.portalLinks,
                nodes,
                highlightedEdgeId,
            ),
        [highlightedEdgeId, nodes, sourceGraph.portalLinks],
    );
    const fitViewOptions = useMemo(
        () => graphFitViewOptions(sourceGraph.maps.length),
        [sourceGraph.maps.length],
    );
    const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<
        MapGraphNode,
        PortalEdge
    > | null>(null);
    const [isFittingGraph, setIsFittingGraph] = useState(true);
    const fitRequestId = useRef(0);
    const [selectedMap, setSelectedMap] = useState<SourceMapSummary | null>(
        null,
    );
    const [selectedPortal, setSelectedPortal] =
        useState<SourcePortalLinkSummary | null>(null);

    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
    useEffect(() => {
        if (!flowInstance || initialNodes.length === 0) {
            return;
        }

        const requestId = fitRequestId.current + 1;
        fitRequestId.current = requestId;

        requestAnimationFrame(() => {
            void flowInstance.fitView(fitViewOptions).finally(() => {
                if (fitRequestId.current === requestId) {
                    setIsFittingGraph(false);
                }
            });
        });
    }, [fitViewOptions, flowInstance, initialNodes]);

    return (
        <section
            className="settings-world-builder-graph grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]"
            data-wl-id="authoring.world-builder.graph-workspace"
        >
            <div
                className="relative min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-content-background)] lg:border-r lg:border-b-0"
                data-wl-id="authoring.world-builder.graph"
            >
                <ReactFlow<MapGraphNode, PortalEdge>
                    className={classNames(
                        'transition-opacity duration-150',
                        isFittingGraph ? 'opacity-0' : 'opacity-100',
                    )}
                    colorMode={appearance === 'dark' ? 'dark' : 'light'}
                    edges={edges}
                    fitView
                    fitViewOptions={fitViewOptions}
                    maxZoom={1.35}
                    minZoom={0.12}
                    nodeTypes={{ mapNode: MapGraphNode }}
                    nodes={nodes}
                    onEdgeClick={(_, edge) => {
                        setSelectedPortal(edge.data ?? null);
                        setSelectedMap(null);
                    }}
                    onEdgeMouseEnter={(_, edge) =>
                        setHighlightedEdgeId(edge.id)
                    }
                    onEdgeMouseLeave={() => setHighlightedEdgeId(null)}
                    onInit={setFlowInstance}
                    onNodeClick={(_, node) => {
                        setSelectedMap(node.data.map);
                        setSelectedPortal(null);
                    }}
                    onNodeDragStart={(_, node) => {
                        setSelectedMap(node.data.map);
                        setSelectedPortal(null);
                    }}
                    onNodesChange={onNodesChange}
                >
                    <Background gap={24} />
                    <Controls fitViewOptions={fitViewOptions} />
                    <MiniMap pannable zoomable />
                </ReactFlow>
                {isFittingGraph && initialNodes.length > 0 ? (
                    <GraphViewportLoadingOverlay />
                ) : null}
            </div>

            <aside className="flex min-h-0 flex-col border-[var(--settings-border-color)] bg-[var(--settings-panel-background)]">
                <div className="min-h-0 flex-1 overflow-y-auto border-b border-[var(--settings-border-color)] p-5">
                    {selectedPortal
                        ? renderSelectedPortal(selectedPortal.native)
                        : selectedMap
                          ? renderSelectedMap(selectedMap.native)
                          : <EmptyDetails />}
                </div>

                <div className="shrink-0 border-b border-[var(--settings-border-color)] bg-[color-mix(in_srgb,var(--settings-accent)_10%,transparent)] p-5">
                    <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                        Prepare
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">New world map</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Create a standalone map now and connect it with portal
                        tiles later.
                    </p>
                    <LiftedWorldBuilderCreateMapDialog
                        onCreated={onMapCreated}
                    />
                    <LiftedButton asChild className="mt-2 w-full" variant="outline">
                        <a
                            data-wl-id="settings.world-builder.world.export"
                            download
                            href="/api/v1/admin/world-builder/world/export"
                        >
                            <Download className="size-4" />
                            {t('settings.world_builder.world.export', 'Export world')}
                        </a>
                    </LiftedButton>
                    <LiftedButton asChild className="mt-2 w-full" variant="outline">
                        <a
                            data-wl-id="settings.world-builder.world.export-package"
                            download
                            href="/api/v1/admin/world-builder/world/export-package"
                        >
                            <Download className="size-4" />
                            {t(
                                'settings.world_builder.world.export_package',
                                'Export world with media',
                            )}
                        </a>
                    </LiftedButton>
                    <LiftedWorldBuilderWorldDetailsDialog
                        onUpdated={onWorldUpdated}
                        world={graph.world}
                    />
                    <LiftedMapExportValidationDialog />
                    <LiftedWorldBuilderMapImportDialog
                        onCreated={onMapImported}
                    />
                    <LiftedWorldBuilderWorldImportDialog
                        onCreated={onWorldImported}
                    />
                </div>

                <div className="shrink-0 p-5">
                    <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                        Travel
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">Portal routes</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Routes are edited inside Entry portal activities. Hover a
                        graph edge to see the connected portal activities.
                    </p>
                </div>
            </aside>
        </section>
    );
}

function GraphViewportLoadingOverlay() {
    return (
        <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-[var(--settings-content-background)]">
            <LiftedSpinner
                aria-label="Preparing graph view"
                className="size-7 text-[var(--settings-accent)]"
            />
        </div>
    );
}

function MapGraphNode({
    data,
    selected,
}: {
    data: MapNodeData;
    selected: boolean;
}) {
    const t = usePlatformTranslation();
    const map = data.map;
    const firstNodeNeedingReview = map.nodes.find(
        (node) => node.activityReviewCount > 0,
    );

    return (
        <div
            className={classNames(
                'relative w-56 rounded-xl border bg-slate-50 p-4 text-left shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-[var(--settings-accent)] ring-2 ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)]',
            )}
            data-wl-id="authoring.world-builder.graph.map-card"
        >
            <MapGraphHandles />
            <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_16%,transparent)] text-[var(--settings-accent)]">
                <MapIcon className="size-5" />
            </span>
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                {map.title}
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {map.nodeCount} tile{map.nodeCount === 1 ? '' : 's'}
            </span>
            <span
                className={classNames(
                    'mt-3 block rounded-md px-2 py-1 text-xs font-medium',
                    map.reviewCount > 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200',
                )}
            >
                {map.reviewCount > 0
                    ? t(
                          map.reviewCount === 1
                              ? 'settings.world_builder.review.waiting_one'
                              : 'settings.world_builder.review.waiting_many',
                          map.reviewCount === 1
                              ? '1 activity awaiting AI review'
                              : ':count activities awaiting AI review',
                          { count: map.reviewCount },
                      )
                    : t(
                          'settings.world_builder.review.current',
                          'Activity reviews current',
                      )}
            </span>
            {firstNodeNeedingReview ? (
                <Link
                    className="nodrag nopan mt-2 inline-flex text-xs font-semibold text-[var(--settings-accent)] underline-offset-2 hover:underline"
                    onClick={(event) => event.stopPropagation()}
                    to={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&node=${firstNodeNeedingReview.id}&worldView=nodes`}
                >
                    {t(
                        'settings.world_builder.review.open_queue',
                        'Open review queue',
                    )}
                    <span aria-hidden="true" className="ml-1">
                        →
                    </span>
                </Link>
            ) : null}
        </div>
    );
}

function MapGraphHandles() {
    return (
        <>
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <div key={side}>
                    {graphHandleLanes.map((lane) => (
                        <div key={`${side}-${lane}`}>
                            <Handle
                                className="!pointer-events-none !size-3 !border-0 !bg-transparent"
                                id={handleId('source', side, lane)}
                                isConnectable={false}
                                position={handlePosition(side)}
                                style={handleStyle(side, lane)}
                                type="source"
                            />
                            <Handle
                                className="!pointer-events-none !size-3 !border-0 !bg-transparent"
                                id={handleId('target', side, lane)}
                                isConnectable={false}
                                position={handlePosition(side)}
                                style={handleStyle(side, lane)}
                                type="target"
                            />
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

function EmptyDetails() {
    return (
        <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
            <GitBranch className="mb-4 size-10 text-[var(--settings-accent)]" />
            <h2 className="text-lg font-semibold">Select a map or portal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click a world-map node to edit it, or click a portal edge to see
                the connected portal activities.
            </p>
        </div>
    );
}

function graphFitViewOptions(mapCount: number): FitViewOptions<MapGraphNode> {
    if (mapCount <= 1) {
        return { duration: 320, maxZoom: 0.9, minZoom: 0.12, padding: 0.36 };
    }

    if (mapCount <= 3) {
        return { duration: 320, maxZoom: 0.78, minZoom: 0.12, padding: 0.3 };
    }

    if (mapCount <= 6) {
        return { duration: 320, maxZoom: 0.66, minZoom: 0.12, padding: 0.24 };
    }

    if (mapCount <= 10) {
        return { duration: 320, maxZoom: 0.54, minZoom: 0.12, padding: 0.2 };
    }

    return { duration: 320, maxZoom: 0.46, minZoom: 0.12, padding: 0.16 };
}

function buildGraphNodes(maps: SourceMapSummary[]): MapGraphNode[] {
    if (maps.length === 0) {
        return [];
    }

    const radius = Math.max(220, maps.length * 86);

    return maps.map((map, index) => {
        const angle = (Math.PI * 2 * index) / maps.length - Math.PI / 2;

        return {
            data: { map },
            id: map.id,
            position: {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            },
            type: 'mapNode',
        };
    });
}

function buildGraphEdges(
    portalLinks: SourcePortalLinkSummary[],
    nodes: MapGraphNode[],
    highlightedEdgeId: string | null,
): PortalEdge[] {
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
    const pairCounts = countPortalPairs(portalLinks);
    const pairIndexes = new Map<string, number>();

    return portalLinks.map((portal) => {
        const source = portal.sourceMapId;
        const target = portal.targetMapId;
        const active = portal.id === highlightedEdgeId;
        const pairKey = [source, target].sort().join(':');
        const pairIndex = pairIndexes.get(pairKey) ?? 0;
        pairIndexes.set(pairKey, pairIndex + 1);
        const route = chooseEdgeRoute(
            nodeById.get(source),
            nodeById.get(target),
            pairIndex,
            pairCounts.get(pairKey) ?? 1,
        );

        return {
            animated: active,
            data: portal,
            id: portal.id,
            label: active
                ? portalActivityLabel(portal)
                : (portal.label ?? 'Portal'),
            markerEnd: { type: MarkerType.ArrowClosed },
            pathOptions: { borderRadius: 24, offset: route.offset },
            source,
            sourceHandle: handleId('source', route.sourceSide, route.sourceLane),
            style: edgeStyle(active),
            target,
            targetHandle: handleId('target', route.targetSide, route.targetLane),
            type: 'smoothstep',
        };
    });
}

function countPortalPairs(portalLinks: SourcePortalLinkSummary[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const portal of portalLinks) {
        const pairKey = [portal.sourceMapId, portal.targetMapId]
            .sort()
            .join(':');

        counts.set(pairKey, (counts.get(pairKey) ?? 0) + 1);
    }

    return counts;
}

function chooseEdgeRoute(
    sourceNode: MapGraphNode | undefined,
    targetNode: MapGraphNode | undefined,
    pairIndex: number,
    pairCount: number,
): {
    offset: number;
    sourceLane: GraphHandleLane;
    sourceSide: GraphSide;
    targetLane: GraphHandleLane;
    targetSide: GraphSide;
} {
    const lane = pairCount > 1 ? laneForPairIndex(pairIndex) : 0;

    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
        return {
            offset: 72 + pairIndex * 24,
            sourceLane: lane,
            sourceSide: pairIndex % 2 === 0 ? 'right' : 'left',
            targetLane: reverseLane(lane),
            targetSide: pairIndex % 2 === 0 ? 'bottom' : 'top',
        };
    }

    const sourceCenter = nodeCenter(sourceNode);
    const targetCenter = nodeCenter(targetNode);
    const deltaX = targetCenter.x - sourceCenter.x;
    const deltaY = targetCenter.y - sourceCenter.y;

    if (pairCount > 1) {
        return parallelPairRoute(deltaX, deltaY, pairIndex);
    }

    const primarySide =
        Math.abs(deltaX) >= Math.abs(deltaY)
            ? deltaX >= 0
                ? 'right'
                : 'left'
            : deltaY >= 0
              ? 'bottom'
              : 'top';

    return {
        offset: 32 + pairIndex * 18,
        sourceLane: lane,
        sourceSide: primarySide,
        targetLane: reverseLane(lane),
        targetSide: oppositeSide(primarySide),
    };
}

function parallelPairRoute(
    deltaX: number,
    deltaY: number,
    pairIndex: number,
): {
    offset: number;
    sourceLane: GraphHandleLane;
    sourceSide: GraphSide;
    targetLane: GraphHandleLane;
    targetSide: GraphSide;
} {
    const laneIndex = Math.floor(pairIndex / 2);
    const offset = 56 + laneIndex * 28;
    const lane = laneForPairIndex(pairIndex);

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        const side = pairIndex % 2 === 0 ? 'bottom' : 'top';

        return {
            offset,
            sourceLane: lane,
            sourceSide: side,
            targetLane: reverseLane(lane),
            targetSide: side,
        };
    }

    const side = pairIndex % 2 === 0 ? 'right' : 'left';

    return {
        offset,
        sourceLane: lane,
        sourceSide: side,
        targetLane: reverseLane(lane),
        targetSide: side,
    };
}

function handleId(
    type: 'source' | 'target',
    side: GraphSide,
    lane: GraphHandleLane,
): string {
    return `${type}-${side}-${lane}`;
}

function handlePosition(side: GraphSide): Position {
    if (side === 'left') {
        return Position.Left;
    }

    if (side === 'right') {
        return Position.Right;
    }

    if (side === 'bottom') {
        return Position.Bottom;
    }

    return Position.Top;
}

function handleStyle(side: GraphSide, lane: GraphHandleLane): CSSProperties {
    const position = `${graphHandleLanePercent[lane]}%`;

    if (side === 'top') {
        return {
            left: position,
            top: 0,
            transform: 'translate(-50%, -50%)',
        };
    }

    if (side === 'bottom') {
        return {
            bottom: 0,
            left: position,
            top: 'auto',
            transform: 'translate(-50%, 50%)',
        };
    }

    if (side === 'left') {
        return {
            left: 0,
            top: position,
            transform: 'translate(-50%, -50%)',
        };
    }

    return {
        left: 'auto',
        right: 0,
        top: position,
        transform: 'translate(50%, -50%)',
    };
}

function laneForPairIndex(pairIndex: number): GraphHandleLane {
    const lanesBySpread: GraphHandleLane[] = [-1, 1, -2, 2, 0];

    return lanesBySpread[pairIndex % lanesBySpread.length] ?? 0;
}

function reverseLane(lane: GraphHandleLane): GraphHandleLane {
    return -lane as GraphHandleLane;
}

function nodeCenter(node: MapGraphNode): { x: number; y: number } {
    return {
        x: node.position.x + mapNodeSize.width / 2,
        y: node.position.y + mapNodeSize.height / 2,
    };
}

function oppositeSide(side: GraphSide): GraphSide {
    if (side === 'left') {
        return 'right';
    }

    if (side === 'right') {
        return 'left';
    }

    if (side === 'bottom') {
        return 'top';
    }

    return 'bottom';
}

function portalActivityLabel(portal: SourcePortalLinkSummary): string {
    return `${portal.sourceActivity?.title ?? portal.sourceNode.title} → ${
        portal.targetActivity?.title ?? portal.targetNode.title
    }`;
}

function edgeStyle(active: boolean): CSSProperties {
    return {
        stroke: active
            ? 'var(--settings-accent)'
            : 'color-mix(in srgb, var(--settings-accent) 42%, transparent)',
        strokeWidth: active ? 4 : 2,
    };
}
