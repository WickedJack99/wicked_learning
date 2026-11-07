import {
    Background,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    ArrowLeft,
    CircleAlert,
    CircleCheck,
    GitBranch,
    Map as MapIcon,
    Route,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type WorldGraph = components['schemas']['AdminWorldGraph'];
type MapSummary = components['schemas']['AdminMapSummary'];
type PortalLink = components['schemas']['AdminPortalLink'];
type EditableMap = components['schemas']['AdminEditableMap'];
type EditableNode = components['schemas']['AdminEditableNode'];
type Activity = components['schemas']['AdminEditableActivity'];

type WorldMapNodeData = {
    map: MapSummary;
};

type ActivityNodeData = {
    activity: Activity;
};

type WorldMapNode = Node<WorldMapNodeData, 'map'>;
type WorldPortalEdge = Edge<PortalLink>;
type ActivityNode = Node<ActivityNodeData, 'activity'>;
type SpecialNode = Node<{ label: string }, 'special'>;
type ActivityFlowNode = ActivityNode | SpecialNode;

/**
 * Source-adapted from the Laravel `AdminWorldIndex` and activity-graph
 * surfaces. It deliberately consumes the three scoped Rust reads separately:
 * the world graph selects a map, the map read selects a node, and the node
 * read renders its activity graph. Mutations remain limited to source graph
 * card positioning while their full source forms are migrated separately.
 */
export function OriginalWorldBuilderPage({
    isAuthenticated,
}: {
    isAuthenticated: boolean;
}) {
    if (!isAuthenticated) {
        return <Navigate replace to="/login" />;
    }

    return (
        <ReactFlowProvider>
            <WorldBuilderContent />
        </ReactFlowProvider>
    );
}

function WorldBuilderContent() {
    const location = useLocation();
    const navigate = useNavigate();
    const query = useMemo(
        () => new URLSearchParams(location.search),
        [location.search],
    );
    const selectedMapId = query.get('map');
    const selectedNodeId = query.get('node');
    const [worldGraph, setWorldGraph] = useState<WorldGraph | null>(null);
    const [editableMap, setEditableMap] = useState<EditableMap | null>(null);
    const [editableNode, setEditableNode] = useState<EditableNode | null>(null);
    const [portal, setPortal] = useState<PortalLink | null>(null);
    const [error, setError] = useState<string | null>(null);

    const selectMap = useCallback(
        (mapId: string) => {
            const next = new URLSearchParams(location.search);
            next.set('panel', 'admin-world-builder');
            next.set('map', mapId);
            next.delete('node');
            navigate(`/settings?${next.toString()}`);
        },
        [location.search, navigate],
    );

    const selectNode = useCallback(
        (mapId: string, nodeId: string) => {
            const next = new URLSearchParams(location.search);
            next.set('panel', 'admin-world-builder');
            next.set('map', mapId);
            next.set('node', nodeId);
            navigate(`/settings?${next.toString()}`);
        },
        [location.search, navigate],
    );

    const loadWorld = useCallback(async () => {
        setError(null);
        const { data, response } = await apiClient.GET('/admin/world-builder');
        if (!response.ok || !data) {
            setWorldGraph(null);
            setError('World Builder is unavailable for this account.');
            return;
        }
        setWorldGraph(data);
    }, []);

    useEffect(() => {
        void loadWorld().catch(() =>
            setError('World Builder is temporarily unavailable.'),
        );
    }, [loadWorld]);

    useEffect(() => {
        if (!selectedMapId) {
            setEditableMap(null);
            return;
        }
        let current = true;
        setEditableMap(null);
        void apiClient
            .GET('/admin/world-builder/maps/{map_id}', {
                params: { path: { map_id: selectedMapId } },
            })
            .then(({ data, response }) => {
                if (!current) {
                    return;
                }
                if (!response.ok || !data) {
                    setError(
                        'The selected map is no longer available for editing.',
                    );
                    return;
                }
                setEditableMap(data);
            })
            .catch(
                () =>
                    current &&
                    setError('The selected map could not be loaded.'),
            );
        return () => {
            current = false;
        };
    }, [selectedMapId]);

    useEffect(() => {
        if (!selectedNodeId) {
            setEditableNode(null);
            return;
        }
        let current = true;
        setEditableNode(null);
        void apiClient
            .GET('/admin/world-builder/nodes/{node_id}', {
                params: { path: { node_id: selectedNodeId } },
            })
            .then(({ data, response }) => {
                if (!current) {
                    return;
                }
                if (!response.ok || !data) {
                    setError(
                        'The selected activity graph is no longer available for editing.',
                    );
                    return;
                }
                setEditableNode(data);
            })
            .catch(
                () =>
                    current &&
                    setError(
                        'The selected activity graph could not be loaded.',
                    ),
            );
        return () => {
            current = false;
        };
    }, [selectedNodeId]);

    if (error && !worldGraph) {
        return <WorldBuilderStatus message={error} />;
    }
    if (!worldGraph) {
        return <WorldBuilderStatus message="Loading World Builder…" />;
    }

    return (
        <main className="min-h-svh bg-slate-100 px-4 py-4 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
            <header className="mx-auto mb-4 flex max-w-[1600px] items-start justify-between gap-4">
                <div>
                    <Link
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                        to="/settings"
                    >
                        <ArrowLeft className="size-4" />
                        Settings
                    </Link>
                    <p className="mt-4 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                        World editing
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold">
                        {worldGraph.world.title}
                    </h1>
                </div>
                <p className="hidden max-w-2xl text-sm leading-6 text-slate-600 md:block dark:text-slate-300">
                    {worldGraph.world.description}
                </p>
            </header>
            {error ? (
                <p className="mx-auto mb-3 max-w-[1600px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                    {error}
                </p>
            ) : null}
            <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="min-h-[34rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
                    {editableNode ? (
                        <ActivityGraph
                            document={editableNode}
                            onSelectMap={() =>
                                selectedMapId && selectMap(selectedMapId)
                            }
                        />
                    ) : (
                        <WorldGraphCanvas
                            graph={worldGraph}
                            onPortal={setPortal}
                            onSelectMap={selectMap}
                        />
                    )}
                </section>
                <aside className="min-h-[20rem] rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
                    {editableNode && selectedMapId ? (
                        <NodeDetails
                            document={editableNode}
                            onBack={() => selectMap(selectedMapId)}
                        />
                    ) : editableMap && selectedMapId ? (
                        <MapDetails
                            document={editableMap}
                            onSelectNode={(nodeId) =>
                                selectNode(selectedMapId, nodeId)
                            }
                        />
                    ) : portal ? (
                        <PortalDetails
                            portal={portal}
                            onSelectNode={selectNode}
                        />
                    ) : (
                        <EmptyDetails />
                    )}
                </aside>
            </div>
        </main>
    );
}

function WorldBuilderStatus({ message }: { message: string }) {
    return (
        <main className="grid min-h-svh place-items-center bg-slate-100 p-6 text-slate-700 dark:bg-[#0b1117] dark:text-slate-200">
            <p role="status">{message}</p>
        </main>
    );
}

function WorldGraphCanvas({
    graph,
    onPortal,
    onSelectMap,
}: {
    graph: WorldGraph;
    onPortal: (portal: PortalLink | null) => void;
    onSelectMap: (mapId: string) => void;
}) {
    const initialNodes = useMemo<WorldMapNode[]>(
        () =>
            graph.maps.map((map, index) => ({
                id: map.id,
                type: 'map',
                data: { map },
                position: circlePosition(index, graph.maps.length),
            })),
        [graph.maps],
    );
    const initialEdges = useMemo<WorldPortalEdge[]>(
        () =>
            graph.portal_links.map((link) => ({
                id: link.id,
                source: link.source_map_id,
                target: link.target_map_id,
                label: link.label ?? 'Portal',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: link,
                style: { stroke: 'rgb(13 148 136)', strokeWidth: 2 },
            })),
        [graph.portal_links],
    );
    const [nodes, , onNodesChange] = useNodesState<WorldMapNode>(initialNodes);
    const [edges, , onEdgesChange] =
        useEdgesState<WorldPortalEdge>(initialEdges);

    useEffect(() => onPortal(null), [graph, onPortal]);

    return (
        <ReactFlow<WorldMapNode, WorldPortalEdge>
            edges={edges}
            fitView
            minZoom={0.12}
            nodeTypes={{ map: MapGraphCard }}
            nodes={nodes}
            onEdgeClick={(_, edge) => onPortal(edge.data ?? null)}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => onSelectMap(node.id)}
            onEdgesChange={onEdgesChange}
            proOptions={{ hideAttribution: true }}
        >
            <Background gap={20} />
            <Controls />
        </ReactFlow>
    );
}

function MapGraphCard({
    data,
    selected,
}: {
    data: WorldMapNodeData;
    selected: boolean;
}) {
    const { map } = data;
    return (
        <div
            className={`w-56 rounded-xl border bg-slate-50 p-4 text-left shadow-lg dark:border-white/10 dark:bg-slate-950 ${selected ? 'border-teal-500 ring-2 ring-teal-500/25' : 'border-slate-200'}`}
        >
            <Handle position={Position.Left} type="target" />
            <Handle position={Position.Right} type="source" />
            <MapIcon className="size-5 text-teal-700 dark:text-teal-300" />
            <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">
                {map.title}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {map.node_count} tile{map.node_count === 1 ? '' : 's'}
            </p>
            <p
                className={`mt-3 rounded-md px-2 py-1 text-xs font-medium ${map.review_count > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200'}`}
            >
                {map.review_count > 0
                    ? `${map.review_count} activity${map.review_count === 1 ? '' : 'ies'} awaiting review`
                    : 'Activity reviews current'}
            </p>
        </div>
    );
}

function MapDetails({
    document,
    onSelectNode,
}: {
    document: EditableMap;
    onSelectNode: (nodeId: string) => void;
}) {
    const { map } = document.editable_map;
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                Map
            </p>
            <h2 className="mt-2 text-xl font-semibold">{map.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {map.description || 'No description yet.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
                <Detail label="Slug" value={map.slug} />
                <Detail label="Tiles" value={String(map.node_count)} />
            </dl>
            <section className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
                <h3 className="text-sm font-semibold">MapAssets</h3>
                <div className="mt-3 grid gap-2">
                    {map.nodes.map((node) => (
                        <button
                            className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-teal-500 dark:border-white/10"
                            key={node.id}
                            onClick={() => onSelectNode(node.id)}
                            type="button"
                        >
                            <span className="block font-medium">
                                {node.title}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {node.activity_review_count} activities awaiting
                                review
                            </span>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}

function NodeDetails({
    document,
    onBack,
}: {
    document: EditableNode;
    onBack: () => void;
}) {
    const graph = document.activity_graph;
    return (
        <div>
            <button
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
                onClick={onBack}
                type="button"
            >
                <ArrowLeft className="size-4" />
                {graph.map.title}
            </button>
            <p className="mt-5 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                Activity graph
            </p>
            <h2 className="mt-2 text-xl font-semibold">{graph.node.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {graph.node.description || 'No description yet.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
                <Detail
                    label="Activities"
                    value={String(graph.activities.length)}
                />
                <Detail
                    label="Start routes"
                    value={String(graph.node.start_routes.length)}
                />
            </dl>
            <section className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
                <h3 className="text-sm font-semibold">Learner starts</h3>
                {graph.node.start_routes.length > 0 ? (
                    <ol className="mt-3 grid gap-2">
                        {graph.node.start_routes.map((route) => (
                            <li
                                className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-white/5"
                                key={route.id}
                            >
                                {route.label}
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="mt-2 text-sm text-slate-500">
                        No route starts are configured.
                    </p>
                )}
            </section>
        </div>
    );
}

function ActivityGraph({
    document,
    onSelectMap,
}: {
    document: EditableNode;
    onSelectMap: () => void;
}) {
    const graph = document.activity_graph;
    const initialNodes = useMemo<ActivityFlowNode[]>(() => {
        const start: SpecialNode = {
            id: '__start',
            type: 'special',
            data: { label: 'Start' },
            position: graphPosition(graph.node.graph_layout, 'start', -260, 0),
            draggable: false,
        };
        const activities: ActivityNode[] = graph.activities.map(
            (activity, index) => ({
                id: activity.id,
                type: 'activity',
                data: { activity },
                position: {
                    x: activity.position.x ?? (index % 3) * 310,
                    y: activity.position.y ?? Math.floor(index / 3) * 220,
                },
            }),
        );
        const end: SpecialNode = {
            id: '__end',
            type: 'special',
            data: { label: 'End' },
            position: graphPosition(graph.node.graph_layout, 'end', 720, 0),
            draggable: false,
        };

        return [start, ...activities, end];
    }, [graph]);
    const initialEdges = useMemo<Edge[]>(
        () => [
            ...(graph.node.start_activity_id
                ? [
                      {
                          id: '__start-edge',
                          source: '__start',
                          target: graph.node.start_activity_id,
                          markerEnd: { type: MarkerType.ArrowClosed },
                      },
                  ]
                : []),
            ...graph.transitions.map((transition) => ({
                id: transition.id,
                source: transition.from_activity_id,
                target: transition.to_activity_id ?? '__end',
                label: transition.label ?? transition.trigger,
                markerEnd: { type: MarkerType.ArrowClosed },
            })),
        ],
        [graph],
    );
    const [nodes, setNodes, onNodesChange] =
        useNodesState<ActivityFlowNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [savingActivityId, setSavingActivityId] = useState<string | null>(
        null,
    );

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialEdges, initialNodes, setEdges, setNodes]);

    const savePosition = useCallback(async (node: ActivityFlowNode) => {
        if (node.id.startsWith('__')) {
            return;
        }
        setSavingActivityId(node.id);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/activities/{activity_id}/graph-position',
                {
                    body: { position: node.position },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_id: node.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('position unavailable');
            }
        } finally {
            setSavingActivityId(null);
        }
    }, []);

    return (
        <div className="h-[34rem]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm dark:border-white/10">
                <button
                    className="inline-flex items-center gap-2 font-medium text-teal-700 hover:underline dark:text-teal-300"
                    onClick={onSelectMap}
                    type="button"
                >
                    <ArrowLeft className="size-4" />
                    Back to map
                </button>
                <span className="text-slate-500">
                    {savingActivityId
                        ? 'Saving position…'
                        : 'Drag activity cards to arrange this graph.'}
                </span>
            </div>
            <ReactFlow<ActivityFlowNode, Edge>
                edges={edges}
                fitView
                minZoom={0.12}
                nodeTypes={{
                    activity: ActivityGraphCard,
                    special: SpecialGraphNode,
                }}
                nodes={nodes}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={(_, node) => void savePosition(node)}
                onNodesChange={onNodesChange}
                proOptions={{ hideAttribution: true }}
            >
                <Background gap={20} />
                <Controls />
            </ReactFlow>
        </div>
    );
}

function ActivityGraphCard({
    data,
    selected,
}: {
    data: ActivityNodeData;
    selected: boolean;
}) {
    const { activity } = data;
    return (
        <div
            className={`w-64 rounded-xl border bg-slate-50 p-4 shadow-lg dark:border-white/10 dark:bg-slate-950 ${selected ? 'border-teal-500 ring-2 ring-teal-500/25' : 'border-slate-200'}`}
        >
            <Handle position={Position.Left} type="target" />
            <Handle position={Position.Right} type="source" />
            <p className="text-xs font-medium tracking-[0.16em] text-teal-700 uppercase dark:text-teal-300">
                {activity.activity_type}
            </p>
            <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {activity.title}
            </h3>
            {activity.introduction ? (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {activity.introduction}
                </p>
            ) : null}
            <p
                className={`mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${activity.ai_review_status === 'reviewed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200'}`}
            >
                {activity.ai_review_status === 'reviewed' ? (
                    <CircleCheck className="size-3" />
                ) : (
                    <CircleAlert className="size-3" />
                )}
                {activity.ai_review_status === 'reviewed'
                    ? 'AI reviewed'
                    : 'Needs AI review'}
            </p>
        </div>
    );
}

function SpecialGraphNode({ data }: { data: { label: string } }) {
    return (
        <div className="rounded-full border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 shadow dark:border-teal-300 dark:bg-teal-300/10 dark:text-teal-100">
            <Handle position={Position.Left} type="target" />
            {data.label}
            <Handle position={Position.Right} type="source" />
        </div>
    );
}

function PortalDetails({
    portal,
    onSelectNode,
}: {
    portal: PortalLink;
    onSelectNode: (mapId: string, nodeId: string) => void;
}) {
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                Portal link
            </p>
            <h2 className="mt-2 text-xl font-semibold">
                {portal.label ?? 'Unnamed portal'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {portal.description ?? 'No portal description yet.'}
            </p>
            <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <PortalEndpoint
                    activity={portal.source_activity}
                    direction="From"
                    title={portal.source_node.title}
                />
                <Route className="mx-auto size-4 text-slate-400" />
                <PortalEndpoint
                    activity={portal.target_activity}
                    direction="To"
                    title={portal.target_node.title}
                />
            </div>
            <button
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
                onClick={() =>
                    onSelectNode(portal.source_map_id, portal.source_node.id)
                }
                type="button"
            >
                Open source activity graph <GitBranch className="size-4" />
            </button>
        </div>
    );
}

function PortalEndpoint({
    activity,
    direction,
    title,
}: {
    activity: PortalLink['source_activity'];
    direction: string;
    title: string;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase dark:text-slate-400">
                {direction}
            </p>
            <p className="mt-1 text-sm font-semibold">{title}</p>
            {activity ? (
                <p className="mt-1 text-xs text-teal-700 dark:text-teal-300">
                    {activity.title}
                </p>
            ) : null}
        </div>
    );
}
function EmptyDetails() {
    return (
        <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <GitBranch className="mb-4 size-10 text-teal-700 dark:text-teal-300" />
            <h2 className="text-lg font-semibold">Select a map or portal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click a world-map card to inspect its MapAssets, or a portal
                link to see the connected activity graph.
            </p>
        </div>
    );
}
function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                {label}
            </dt>
            <dd className="mt-1">{value}</dd>
        </div>
    );
}
function circlePosition(index: number, total: number) {
    const radius = Math.max(220, total * 86);
    const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
function graphPosition(
    layout: Record<string, unknown>,
    key: 'start' | 'end',
    fallbackX: number,
    fallbackY: number,
) {
    const value = layout[key];
    if (
        value &&
        typeof value === 'object' &&
        'x' in value &&
        'y' in value &&
        typeof value.x === 'number' &&
        typeof value.y === 'number'
    ) {
        return { x: value.x, y: value.y };
    }
    return { x: fallbackX, y: fallbackY };
}
