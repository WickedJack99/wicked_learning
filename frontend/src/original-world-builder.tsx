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
    Plus,
    Route,
    Trash2,
    X,
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
type EditableItem = components['schemas']['AdminEditableItem'];
type EditableTool = components['schemas']['AdminEditableTool'];

type WorldMapNodeData = {
    map: MapSummary;
};

type ActivityNodeData = {
    activity: Activity;
    onDelete: (activity: Activity) => void;
};

type WorldMapNode = Node<WorldMapNodeData, 'map'>;
type WorldPortalEdge = Edge<PortalLink>;
type ActivityNode = Node<ActivityNodeData, 'activity'>;
type SpecialNode = Node<{ label: string }, 'special'>;
type ActivityFlowNode = ActivityNode | SpecialNode;
type SupportedActivityType =
    | 'open_practice'
    | 'reflection'
    | 'item_grant'
    | 'tool_grant';
type ActivityAuthorForm = {
    backgroundDark: string;
    backgroundLight: string;
    backgroundMirrored: boolean;
    bubbleBorderColorDark: string;
    bubbleBorderColorLight: string;
    bubbleColorDark: string;
    bubbleColorLight: string;
    bubbleOpacityDark: string;
    bubbleOpacityLight: string;
    fadeDurationSeconds: string;
    introduction: string;
    items: Array<{ itemId: string; quantity: string }>;
    nextStep: string;
    note: string;
    prompt: string;
    slug: string;
    subtopic: string;
    title: string;
    topic: string;
    type: SupportedActivityType;
    probabilityPercent: string;
    slideDirection: string;
    slideDurationSeconds: string;
    text: string;
    toolId: string;
    toolMirrored: boolean;
    toolX: string;
    toolY: string;
    typingSpeed: string;
};

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
    const [nodeReload, setNodeReload] = useState(0);
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
    }, [nodeReload, selectedNodeId]);

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
                            onReload={() =>
                                setNodeReload((current) => current + 1)
                            }
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
    onReload,
    onSelectMap,
}: {
    document: EditableNode;
    onReload: () => void;
    onSelectMap: () => void;
}) {
    const graph = document.activity_graph;
    const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
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
                data: { activity, onDelete: setPendingDelete },
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
    const [editor, setEditor] = useState<{
        activity?: Activity;
        type: SupportedActivityType;
    } | null>(null);

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

    const deleteActivity = async () => {
        if (!pendingDelete) {
            return;
        }

        setDeleteError(null);
        setDeleting(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/activities/{activity_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_id: pendingDelete.id },
                    },
                },
            );
            if (!response.ok) {
                setDeleteError(
                    'The activity could not be deleted. Reload the graph and try again.',
                );
                return;
            }
            setPendingDelete(null);
            onReload();
        } catch {
            setDeleteError(
                'The activity could not be deleted. Check your connection and try again.',
            );
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <div className="h-[34rem]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm dark:border-white/10">
                    <button
                        className="inline-flex items-center gap-2 font-medium text-teal-700 hover:underline dark:text-teal-300"
                        onClick={onSelectMap}
                        type="button"
                    >
                        <ArrowLeft className="size-4" />
                        Back to map
                    </button>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="hidden text-slate-500 lg:inline">
                            {savingActivityId
                                ? 'Saving position…'
                                : 'Drag activity cards to arrange this graph.'}
                        </span>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'open_practice' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Open practice
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'reflection' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Reflection
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'item_grant' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Item grant
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'tool_grant' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Tool grant
                        </button>
                    </div>
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
                    onNodeClick={(_, node) => {
                        if (
                            node.type === 'activity' &&
                            isSupportedActivityType(
                                node.data.activity.activity_type,
                            )
                        ) {
                            setEditor({
                                activity: node.data.activity,
                                type: node.data.activity.activity_type,
                            });
                        }
                    }}
                    onNodeDragStop={(_, node) => void savePosition(node)}
                    onNodesChange={onNodesChange}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background gap={20} />
                    <Controls />
                </ReactFlow>
            </div>
            {editor ? (
                <ActivityAuthorDialog
                    activity={editor.activity}
                    items={document.items}
                    tools={document.tools}
                    nodeId={graph.node.id}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        setEditor(null);
                        onReload();
                    }}
                    type={editor.type}
                />
            ) : null}
            {pendingDelete ? (
                <DeleteActivityDialog
                    activity={pendingDelete}
                    error={deleteError}
                    onCancel={() => {
                        if (!deleting) {
                            setDeleteError(null);
                            setPendingDelete(null);
                        }
                    }}
                    onConfirm={() => void deleteActivity()}
                    processing={deleting}
                />
            ) : null}
        </>
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
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.16em] text-teal-700 uppercase dark:text-teal-300">
                    {activity.activity_type}
                </p>
                <button
                    aria-label={`Delete ${activity.title}`}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-300/10 dark:hover:text-red-300"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onDelete(activity);
                    }}
                    type="button"
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>
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

function DeleteActivityDialog({
    activity,
    error,
    onCancel,
    onConfirm,
    processing,
}: {
    activity: Activity;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
    processing: boolean;
}) {
    return (
        <div
            aria-labelledby="delete-activity-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <h2
                    className="text-xl font-semibold"
                    id="delete-activity-title"
                >
                    Delete activity?
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    This removes &ldquo;{activity.title}&rdquo; and its outgoing
                    connections. This cannot be undone.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={processing}
                        onClick={onCancel}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={processing}
                        onClick={onConfirm}
                        type="button"
                    >
                        {processing ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function ActivityAuthorDialog({
    activity,
    items,
    nodeId,
    onClose,
    onSaved,
    type,
    tools,
}: {
    activity?: Activity;
    items: EditableItem[];
    nodeId: string;
    onClose: () => void;
    onSaved: () => void;
    type: SupportedActivityType;
    tools: EditableTool[];
}) {
    const [form, setForm] = useState(() =>
        activityAuthorForm(type, activity, items, tools),
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const isEditing = activity !== undefined;
    const typeLabel =
        type === 'open_practice'
            ? 'Open practice'
            : type === 'reflection'
              ? 'Reflection'
              : type === 'item_grant'
                ? 'Item grant'
                : 'Tool grant';

    const updateField = (field: keyof ActivityAuthorForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        if (!form.title.trim()) {
            setError('Add an activity title before saving.');
            return;
        }

        const itemGrant = itemGrantRequest(form);
        if (type === 'item_grant' && !itemGrant) {
            setError(
                'Use a probability between 0.01% and 100%, and give every selected item a quantity from 1 to 999.',
            );
            return;
        }
        const completeItemGrant = itemGrant ?? {
            items: [],
            probabilityPercent: 100,
        };
        const toolGrant = toolGrantRequest(form);
        if (type === 'tool_grant' && !toolGrant) {
            setError(
                'Use valid bubble colors and values within the shown source ranges before saving.',
            );
            return;
        }
        const completeToolGrant = toolGrant ?? defaultToolGrantRequest();

        setSaving(true);
        try {
            const token = await getCsrfToken();
            const common = {
                introduction: optionalValue(form.introduction),
                slug: optionalValue(form.slug),
                title: form.title,
            };
            let response: Response;

            if (type === 'open_practice') {
                if (activity) {
                    ({ response } = await apiClient.PATCH(
                        '/admin/world-builder/activities/{activity_id}/open-practice',
                        {
                            body: {
                                ...common,
                                next_step: optionalValue(form.nextStep),
                                updated_at: activity.updated_at,
                            },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { activity_id: activity.id },
                            },
                        },
                    ));
                } else {
                    ({ response } = await apiClient.POST(
                        '/admin/world-builder/nodes/{node_id}/open-practice-activities',
                        {
                            body: {
                                ...common,
                                next_step: optionalValue(form.nextStep),
                            },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { node_id: nodeId },
                            },
                        },
                    ));
                }
            } else if (type === 'reflection' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/reflection',
                    {
                        body: {
                            ...common,
                            note: optionalValue(form.note),
                            prompt: optionalValue(form.prompt),
                            subtopic: optionalValue(form.subtopic),
                            topic: optionalValue(form.topic),
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'reflection') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/reflection-activities',
                    {
                        body: {
                            ...common,
                            note: optionalValue(form.note),
                            prompt: optionalValue(form.prompt),
                            subtopic: optionalValue(form.subtopic),
                            topic: optionalValue(form.topic),
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: nodeId },
                        },
                    },
                ));
            } else if (type === 'item_grant' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/item-grant',
                    {
                        body: {
                            ...common,
                            background_dark: optionalValue(form.backgroundDark),
                            background_light: optionalValue(
                                form.backgroundLight,
                            ),
                            background_mirrored: form.backgroundMirrored,
                            items: completeItemGrant.items,
                            probability_percent:
                                completeItemGrant.probabilityPercent,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'item_grant') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/item-grant-activities',
                    {
                        body: {
                            ...common,
                            background_dark: optionalValue(form.backgroundDark),
                            background_light: optionalValue(
                                form.backgroundLight,
                            ),
                            background_mirrored: form.backgroundMirrored,
                            items: completeItemGrant.items,
                            probability_percent:
                                completeItemGrant.probabilityPercent,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: nodeId },
                        },
                    },
                ));
            } else if (activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/tool-grant',
                    {
                        body: {
                            ...common,
                            ...completeToolGrant,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/tool-grant-activities',
                    {
                        body: { ...common, ...completeToolGrant },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: nodeId },
                        },
                    },
                ));
            }

            if (!response.ok) {
                setError(
                    response.status === 409
                        ? 'This activity changed elsewhere. Close this form, reload the graph, and review the newer version.'
                        : 'The activity could not be saved. Check the field values and try again.',
                );
                return;
            }
            onSaved();
        } catch {
            setError(
                'The activity could not be saved. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="activity-author-dialog-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            Activity graph
                        </p>
                        <h2
                            className="mt-1 text-xl font-semibold"
                            id="activity-author-dialog-title"
                        >
                            {isEditing
                                ? `Edit ${typeLabel}`
                                : `Add ${typeLabel}`}
                        </h2>
                    </div>
                    <button
                        aria-label="Close activity form"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <ActivityTextField
                        autoFocus
                        label="Title"
                        onChange={(value) => updateField('title', value)}
                        required
                        value={form.title}
                    />
                    <ActivityTextField
                        label="Optional slug"
                        onChange={(value) => updateField('slug', value)}
                        value={form.slug}
                    />
                    <ActivityTextField
                        className="md:col-span-2"
                        label="Introduction"
                        onChange={(value) => updateField('introduction', value)}
                        textarea
                        value={form.introduction}
                    />
                    {type === 'open_practice' ? (
                        <ActivityTextField
                            className="md:col-span-2"
                            label="Learner invitation"
                            onChange={(value) => updateField('nextStep', value)}
                            textarea
                            value={form.nextStep}
                        />
                    ) : type === 'reflection' ? (
                        <>
                            <ActivityTextField
                                className="md:col-span-2"
                                label="Question"
                                onChange={(value) =>
                                    updateField('prompt', value)
                                }
                                textarea
                                value={form.prompt}
                            />
                            <ActivityTextField
                                label="Journal topic"
                                onChange={(value) =>
                                    updateField('topic', value)
                                }
                                value={form.topic}
                            />
                            <ActivityTextField
                                label="Optional subtopic"
                                onChange={(value) =>
                                    updateField('subtopic', value)
                                }
                                value={form.subtopic}
                            />
                            <ActivityTextField
                                className="md:col-span-2"
                                label="Supporting note"
                                onChange={(value) => updateField('note', value)}
                                value={form.note}
                            />
                        </>
                    ) : type === 'item_grant' ? (
                        <ItemGrantFields
                            form={form}
                            items={items}
                            onChange={setForm}
                        />
                    ) : (
                        <ToolGrantFields
                            form={form}
                            onChange={setForm}
                            tools={tools}
                        />
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        disabled={saving}
                        type="submit"
                    >
                        {saving
                            ? 'Saving…'
                            : isEditing
                              ? 'Save activity'
                              : 'Create activity'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function ActivityTextField({
    autoFocus = false,
    className,
    label,
    onChange,
    required = false,
    textarea = false,
    value,
}: {
    autoFocus?: boolean;
    className?: string;
    label: string;
    onChange: (value: string) => void;
    required?: boolean;
    textarea?: boolean;
    value: string;
}) {
    const controlClassName =
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white';

    return (
        <label className={`grid gap-2 text-sm font-medium ${className ?? ''}`}>
            {label}
            {textarea ? (
                <textarea
                    autoFocus={autoFocus}
                    className={`${controlClassName} min-h-28 resize-y`}
                    onChange={(event) => onChange(event.target.value)}
                    required={required}
                    value={value}
                />
            ) : (
                <input
                    autoFocus={autoFocus}
                    className={controlClassName}
                    onChange={(event) => onChange(event.target.value)}
                    required={required}
                    value={value}
                />
            )}
        </label>
    );
}

function ItemGrantFields({
    form,
    items,
    onChange,
}: {
    form: ActivityAuthorForm;
    items: EditableItem[];
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
}) {
    const updateRow = (
        index: number,
        field: 'itemId' | 'quantity',
        value: string,
    ) => {
        onChange((current) => ({
            ...current,
            items: current.items.map((row, rowIndex) =>
                rowIndex === index ? { ...row, [field]: value } : row,
            ),
        }));
    };

    return (
        <>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">
                Probability
                <span className="flex items-center gap-2">
                    <input
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                        max="100"
                        min="0.01"
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                probabilityPercent: event.target.value,
                            }))
                        }
                        step="0.01"
                        type="number"
                        value={form.probabilityPercent}
                    />
                    <span className="text-slate-500">%</span>
                </span>
            </label>
            <section className="grid gap-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">
                        Items granted on success
                    </h3>
                    <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                items: [
                                    ...current.items,
                                    { itemId: '', quantity: '1' },
                                ],
                            }))
                        }
                        type="button"
                    >
                        <Plus className="size-3.5" />
                        Add item
                    </button>
                </div>
                {form.items.map((row, index) => (
                    <div
                        className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_8rem_auto] dark:bg-white/5"
                        key={`${row.itemId}-${index}`}
                    >
                        <select
                            aria-label={`Item ${index + 1}`}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            onChange={(event) =>
                                updateRow(index, 'itemId', event.target.value)
                            }
                            value={row.itemId}
                        >
                            <option value="">Select item</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </select>
                        <input
                            aria-label={`Quantity for item ${index + 1}`}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            max="999"
                            min="1"
                            onChange={(event) =>
                                updateRow(index, 'quantity', event.target.value)
                            }
                            type="number"
                            value={row.quantity}
                        />
                        <button
                            aria-label="Remove item grant row"
                            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-300/10 dark:hover:text-red-300"
                            onClick={() =>
                                onChange((current) => ({
                                    ...current,
                                    items: current.items.filter(
                                        (_, rowIndex) => rowIndex !== index,
                                    ),
                                }))
                            }
                            type="button"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
            </section>
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div>
                    <h3 className="text-sm font-medium">Grant item scene</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Configure the authored scene assets for each appearance.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <ActivityTextField
                        label="Dark background"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                backgroundDark: value,
                            }))
                        }
                        value={form.backgroundDark}
                    />
                    <ActivityTextField
                        label="Light background"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                backgroundLight: value,
                            }))
                        }
                        value={form.backgroundLight}
                    />
                </div>
                <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                        checked={form.backgroundMirrored}
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                backgroundMirrored: event.target.checked,
                            }))
                        }
                        type="checkbox"
                    />
                    Mirror background horizontally
                </label>
            </section>
        </>
    );
}

function ToolGrantFields({
    form,
    onChange,
    tools,
}: {
    form: ActivityAuthorForm;
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
    tools: EditableTool[];
}) {
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) =>
        onChange((current) => ({ ...current, [field]: value }));

    return (
        <>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">
                Tool to give
                <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                    onChange={(event) => update('toolId', event.target.value)}
                    value={form.toolId}
                >
                    <option value="">Select a tool</option>
                    {tools.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                            {tool.title}
                        </option>
                    ))}
                </select>
            </label>
            <ActivityTextField
                className="md:col-span-2"
                label="Speech bubble text"
                onChange={(value) => update('text', value)}
                textarea
                value={form.text}
            />
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div>
                    <h3 className="text-sm font-medium">Grant scene</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Position the tool and configure its scene presentation.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <ActivityTextField
                        label="Dark background"
                        onChange={(value) => update('backgroundDark', value)}
                        value={form.backgroundDark}
                    />
                    <ActivityTextField
                        label="Light background"
                        onChange={(value) => update('backgroundLight', value)}
                        value={form.backgroundLight}
                    />
                    <ToolGrantNumberField
                        label="Tool x position"
                        max={100}
                        min={0}
                        onChange={(value) => update('toolX', value)}
                        suffix="%"
                        value={form.toolX}
                    />
                    <ToolGrantNumberField
                        label="Tool y position"
                        max={100}
                        min={0}
                        onChange={(value) => update('toolY', value)}
                        suffix="%"
                        value={form.toolY}
                    />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input
                            checked={form.backgroundMirrored}
                            onChange={(event) =>
                                update(
                                    'backgroundMirrored',
                                    event.target.checked,
                                )
                            }
                            type="checkbox"
                        />
                        Mirror background horizontally
                    </label>
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input
                            checked={form.toolMirrored}
                            onChange={(event) =>
                                update('toolMirrored', event.target.checked)
                            }
                            type="checkbox"
                        />
                        Mirror tool image horizontally
                    </label>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-2 text-sm font-medium">
                        Slide direction
                        <select
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            onChange={(event) =>
                                update('slideDirection', event.target.value)
                            }
                            value={form.slideDirection}
                        >
                            <option value="left">From left</option>
                            <option value="right">From right</option>
                            <option value="top">From top</option>
                            <option value="bottom">From bottom</option>
                            <option value="none">No slide</option>
                        </select>
                    </label>
                    <ToolGrantNumberField
                        label="Slide duration"
                        max={30}
                        min={0}
                        onChange={(value) =>
                            update('slideDurationSeconds', value)
                        }
                        suffix="s"
                        value={form.slideDurationSeconds}
                    />
                    <ToolGrantNumberField
                        label="Fade duration"
                        max={30}
                        min={0}
                        onChange={(value) =>
                            update('fadeDurationSeconds', value)
                        }
                        suffix="s"
                        value={form.fadeDurationSeconds}
                    />
                    <ToolGrantNumberField
                        label="Typing speed"
                        max={250}
                        min={1}
                        onChange={(value) => update('typingSpeed', value)}
                        suffix="ms"
                        value={form.typingSpeed}
                    />
                </div>
            </section>
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div>
                    <h3 className="text-sm font-medium">Speech bubble</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Keep dark and light appearance values distinct.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <ToolGrantColorField
                        label="Dark bubble color"
                        onChange={(value) => update('bubbleColorDark', value)}
                        value={form.bubbleColorDark}
                    />
                    <ToolGrantColorField
                        label="Dark bubble border"
                        onChange={(value) =>
                            update('bubbleBorderColorDark', value)
                        }
                        value={form.bubbleBorderColorDark}
                    />
                    <ToolGrantNumberField
                        label="Dark opacity"
                        max={100}
                        min={0}
                        onChange={(value) => update('bubbleOpacityDark', value)}
                        suffix="%"
                        value={form.bubbleOpacityDark}
                    />
                    <ToolGrantColorField
                        label="Light bubble color"
                        onChange={(value) => update('bubbleColorLight', value)}
                        value={form.bubbleColorLight}
                    />
                    <ToolGrantColorField
                        label="Light bubble border"
                        onChange={(value) =>
                            update('bubbleBorderColorLight', value)
                        }
                        value={form.bubbleBorderColorLight}
                    />
                    <ToolGrantNumberField
                        label="Light opacity"
                        max={100}
                        min={0}
                        onChange={(value) =>
                            update('bubbleOpacityLight', value)
                        }
                        suffix="%"
                        value={form.bubbleOpacityLight}
                    />
                </div>
            </section>
        </>
    );
}

function ToolGrantNumberField({
    label,
    max,
    min,
    onChange,
    suffix,
    value,
}: {
    label: string;
    max: number;
    min: number;
    onChange: (value: string) => void;
    suffix: string;
    value: string;
}) {
    return (
        <label className="grid gap-2 text-sm font-medium">
            {label}
            <span className="flex items-center gap-2">
                <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                    max={max}
                    min={min}
                    onChange={(event) => onChange(event.target.value)}
                    step="any"
                    type="number"
                    value={value}
                />
                <span className="text-slate-500">{suffix}</span>
            </span>
        </label>
    );
}

function ToolGrantColorField({
    label,
    onChange,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <label className="grid gap-2 text-sm font-medium">
            {label}
            <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-slate-950/40"
                onChange={(event) => onChange(event.target.value)}
                type="color"
                value={value}
            />
        </label>
    );
}

function activityAuthorForm(
    type: SupportedActivityType,
    activity?: Activity,
    items: EditableItem[] = [],
    tools: EditableTool[] = [],
): ActivityAuthorForm {
    const config = activity?.config ?? {};
    return {
        backgroundDark: configString(config, 'backgroundDark'),
        backgroundLight: configString(config, 'backgroundLight'),
        backgroundMirrored: configBoolean(config, 'backgroundMirrored'),
        bubbleBorderColorDark: configStringOr(
            config,
            'bubbleBorderColorDark',
            '#2dd4bf',
        ),
        bubbleBorderColorLight: configStringOr(
            config,
            'bubbleBorderColorLight',
            '#0891b2',
        ),
        bubbleColorDark: configStringOr(config, 'bubbleColorDark', '#0f172a'),
        bubbleColorLight: configStringOr(config, 'bubbleColorLight', '#ffffff'),
        bubbleOpacityDark: String(
            configNumber(config, 'bubbleOpacityDark', 92),
        ),
        bubbleOpacityLight: String(
            configNumber(config, 'bubbleOpacityLight', 94),
        ),
        fadeDurationSeconds: String(
            configNumber(config, 'fadeDurationSeconds', 0.4),
        ),
        introduction: activity?.introduction ?? '',
        items: itemGrantItems(config, items),
        nextStep:
            configString(config, 'nextStep') ||
            'Choose a useful next step, then continue when you are ready.',
        note: configString(config, 'note'),
        prompt: activity
            ? configString(config, 'prompt')
            : 'What feels clearer now?',
        slug: activity?.slug ?? '',
        subtopic: configString(config, 'subtopic'),
        title: activity?.title ?? '',
        topic: configString(config, 'topic'),
        type,
        probabilityPercent: String(
            configNumber(config, 'probabilityPercent', 100),
        ),
        slideDirection: configStringOr(config, 'slideDirection', 'left'),
        slideDurationSeconds: String(
            configNumber(config, 'slideDurationSeconds', 0.6),
        ),
        text: configString(config, 'text'),
        toolId: toolGrantToolId(config, tools),
        toolMirrored: configBoolean(config, 'toolMirrored'),
        toolX: String(configNumber(config, 'toolX', 50)),
        toolY: String(configNumber(config, 'toolY', 50)),
        typingSpeed: String(configNumber(config, 'typingSpeed', 24)),
    };
}

function configString(config: Record<string, unknown>, key: string): string {
    const value = config[key];
    return typeof value === 'string' ? value : '';
}

function configStringOr(
    config: Record<string, unknown>,
    key: string,
    fallback: string,
): string {
    return configString(config, key) || fallback;
}

function configBoolean(config: Record<string, unknown>, key: string): boolean {
    return config[key] === true;
}

function configNumber(
    config: Record<string, unknown>,
    key: string,
    fallback: number,
): number {
    const value = config[key];
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function itemGrantItems(
    config: Record<string, unknown>,
    items: EditableItem[],
): Array<{ itemId: string; quantity: string }> {
    const configured = config.items;
    if (!Array.isArray(configured)) {
        return [];
    }
    return configured.flatMap((row) => {
        if (!row || typeof row !== 'object') {
            return [];
        }
        const itemSlug = 'itemId' in row ? row.itemId : null;
        const quantity = 'quantity' in row ? row.quantity : null;
        if (typeof itemSlug !== 'string' || typeof quantity !== 'number') {
            return [];
        }
        const item = items.find((candidate) => candidate.slug === itemSlug);
        return [
            {
                itemId: item?.id ?? itemSlug,
                quantity: String(quantity),
            },
        ];
    });
}

function itemGrantRequest(form: ActivityAuthorForm): {
    items: Array<{ item_id: string; quantity: number }>;
    probabilityPercent: number;
} | null {
    const probabilityPercent = Number(form.probabilityPercent);
    if (
        !Number.isFinite(probabilityPercent) ||
        probabilityPercent < 0.01 ||
        probabilityPercent > 100
    ) {
        return null;
    }
    const items = form.items.map((item) => ({
        item_id: item.itemId,
        quantity: Number(item.quantity),
    }));
    if (
        items.some(
            (item) =>
                !item.item_id ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 999,
        )
    ) {
        return null;
    }
    return { items, probabilityPercent };
}

function toolGrantToolId(
    config: Record<string, unknown>,
    tools: EditableTool[],
): string {
    const slug = configString(config, 'toolId');
    return tools.find((tool) => tool.slug === slug)?.id ?? slug;
}

function toolGrantRequest(form: ActivityAuthorForm): {
    background_dark: string | null;
    background_light: string | null;
    background_mirrored: boolean;
    bubble_border_color_dark: string;
    bubble_border_color_light: string;
    bubble_color_dark: string;
    bubble_color_light: string;
    bubble_opacity_dark: number;
    bubble_opacity_light: number;
    fade_duration_seconds: number;
    slide_direction: 'left' | 'right' | 'top' | 'bottom' | 'none';
    slide_duration_seconds: number;
    text: string | null;
    tool_id: string | null;
    tool_mirrored: boolean;
    tool_x: number;
    tool_y: number;
    typing_speed: number;
} | null {
    const bubbleOpacityDark = Number(form.bubbleOpacityDark);
    const bubbleOpacityLight = Number(form.bubbleOpacityLight);
    const fadeDurationSeconds = Number(form.fadeDurationSeconds);
    const slideDurationSeconds = Number(form.slideDurationSeconds);
    const toolX = Number(form.toolX);
    const toolY = Number(form.toolY);
    const typingSpeed = Number(form.typingSpeed);
    const slideDirection = form.slideDirection;
    if (
        !validHexColor(form.bubbleBorderColorDark) ||
        !validHexColor(form.bubbleBorderColorLight) ||
        !validHexColor(form.bubbleColorDark) ||
        !validHexColor(form.bubbleColorLight) ||
        !within(bubbleOpacityDark, 0, 100) ||
        !within(bubbleOpacityLight, 0, 100) ||
        !within(fadeDurationSeconds, 0, 30) ||
        !within(slideDurationSeconds, 0, 30) ||
        !within(toolX, 0, 100) ||
        !within(toolY, 0, 100) ||
        !within(typingSpeed, 1, 250) ||
        !['left', 'right', 'top', 'bottom', 'none'].includes(slideDirection)
    ) {
        return null;
    }
    return {
        background_dark: optionalValue(form.backgroundDark),
        background_light: optionalValue(form.backgroundLight),
        background_mirrored: form.backgroundMirrored,
        bubble_border_color_dark: form.bubbleBorderColorDark,
        bubble_border_color_light: form.bubbleBorderColorLight,
        bubble_color_dark: form.bubbleColorDark,
        bubble_color_light: form.bubbleColorLight,
        bubble_opacity_dark: bubbleOpacityDark,
        bubble_opacity_light: bubbleOpacityLight,
        fade_duration_seconds: fadeDurationSeconds,
        slide_direction: slideDirection as
            | 'left'
            | 'right'
            | 'top'
            | 'bottom'
            | 'none',
        slide_duration_seconds: slideDurationSeconds,
        text: optionalValue(form.text),
        tool_id: optionalValue(form.toolId),
        tool_mirrored: form.toolMirrored,
        tool_x: toolX,
        tool_y: toolY,
        typing_speed: typingSpeed,
    };
}

function defaultToolGrantRequest(): NonNullable<
    ReturnType<typeof toolGrantRequest>
> {
    return {
        background_dark: null,
        background_light: null,
        background_mirrored: false,
        bubble_border_color_dark: '#2dd4bf',
        bubble_border_color_light: '#0891b2',
        bubble_color_dark: '#0f172a',
        bubble_color_light: '#ffffff',
        bubble_opacity_dark: 92,
        bubble_opacity_light: 94,
        fade_duration_seconds: 0.4,
        slide_direction: 'left',
        slide_duration_seconds: 0.6,
        text: null,
        tool_id: null,
        tool_mirrored: false,
        tool_x: 50,
        tool_y: 50,
        typing_speed: 24,
    };
}

function validHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function within(value: number, minimum: number, maximum: number): boolean {
    return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function optionalValue(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function isSupportedActivityType(type: string): type is SupportedActivityType {
    return (
        type === 'open_practice' ||
        type === 'reflection' ||
        type === 'item_grant' ||
        type === 'tool_grant'
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
