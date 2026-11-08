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
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    ArrowLeft,
    BookmarkPlus,
    CircleAlert,
    CircleCheck,
    GitBranch,
    Map as MapIcon,
    Plus,
    RefreshCw,
    Route,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalActivityHistoryDialog } from './original-activity-history';
import { OriginalActivityTemplatesDialog } from './original-activity-templates';
import { OriginalSourceCatalogDialog } from './original-source-catalog';

type WorldGraph = components['schemas']['AdminWorldGraph'];
type MapSummary = components['schemas']['AdminMapSummary'];
type PortalLink = components['schemas']['AdminPortalLink'];
type EditableMap = components['schemas']['AdminEditableMap'];
type EditableNode = components['schemas']['AdminEditableNode'];
type Activity = components['schemas']['AdminEditableActivity'];
type EditableItem = components['schemas']['AdminEditableItem'];
type EditableSound = components['schemas']['AdminEditableSound'];
type EditableTool = components['schemas']['AdminEditableTool'];
type ActivityTransition = components['schemas']['AdminActivityTransition'];
type ActivityConnector = components['schemas']['AdminActivityConnector'];
type ActivityStartRoute = components['schemas']['AdminActivityStartRoute'];

type WorldMapNodeData = {
    map: MapSummary;
};

type ActivityNodeData = {
    activity: Activity;
    onDelete: (activity: Activity) => void;
    onHistory: (activity: Activity) => void;
    onSaveTemplate: (activity: Activity) => void;
    onUpdateTemplate: (activity: Activity) => void;
};

type WorldMapNode = Node<WorldMapNodeData, 'map'>;
type WorldPortalEdge = Edge<PortalLink>;
type ActivityNode = Node<ActivityNodeData, 'activity'>;
type SpecialNode = Node<{ kind: 'start' | 'end'; label: string }, 'special'>;
type ActivityFlowNode = ActivityNode | SpecialNode;
type SupportedActivityType =
    | 'open_practice'
    | 'reflection'
    | 'item_grant'
    | 'tool_grant'
    | 'item_obstacle'
    | 'obstacle';
type ObstacleForm = {
    allowedToolIds: string[];
    backgroundDark: string;
    backgroundLight: string;
    backgroundMirrored: boolean;
    bubbleBorderColorDark: string;
    bubbleBorderColorLight: string;
    bubbleColorDark: string;
    bubbleColorLight: string;
    bubbleOpacityDark: string;
    bubbleOpacityLight: string;
    imageDark: string;
    imageLight: string;
    imageMirrored: boolean;
    persistAfterSolved: boolean;
    promptText: string;
    revisitBackgroundDark: string;
    revisitBackgroundLight: string;
    revisitBackgroundMirrored: boolean;
    revisitImageDark: string;
    revisitImageLight: string;
    revisitImageMirrored: boolean;
    revisitText: string;
    successAnimation: string;
    successText: string;
    typingSpeed: string;
    width: string;
    x: string;
    y: string;
};
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
    itemObstacleBackgroundDark: string;
    itemObstacleBackgroundLight: string;
    itemObstacleBackgroundMirrored: boolean;
    itemObstacleConsumeOnEachEntry: boolean;
    itemObstacleLockMinutes: string;
    itemObstacleMetBackgroundDark: string;
    itemObstacleMetBackgroundLight: string;
    itemObstacleMetBackgroundMirrored: boolean;
    itemObstacleOverlayDark: string;
    itemObstacleOverlayLight: string;
    itemObstacleOverlayMirrored: boolean;
    itemObstacleOverlayWidth: string;
    itemObstacleOverlayX: string;
    itemObstacleOverlayY: string;
    itemObstacleSlots: Array<{
        itemId: string;
        width: string;
        x: string;
        y: string;
    }>;
    itemObstacleSoundMetEnabled: boolean;
    itemObstacleSoundMetId: string;
    itemObstacleSoundNotMetEnabled: boolean;
    itemObstacleSoundNotMetId: string;
    itemObstacleSoundTransitionEnabled: boolean;
    itemObstacleSoundTransitionId: string;
    items: Array<{ itemId: string; quantity: string }>;
    nextStep: string;
    note: string;
    obstacle: ObstacleForm;
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
type StartRouteForm = {
    buttonBorderColorDark: string;
    buttonBorderColorLight: string;
    buttonColorDark: string;
    buttonColorLight: string;
    description: string;
    imageDark: string;
    imageLight: string;
    label: string;
};

/**
 * Source-adapted from the Laravel `AdminWorldIndex` and activity-graph
 * surfaces. It deliberately consumes the three scoped Rust reads separately:
 * the world graph selects a map, the map read selects a node, and the node
 * read renders its activity graph. Each source mutation keeps its own typed
 * endpoint and refresh boundary while the remaining forms migrate separately.
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
    const [mapReload, setMapReload] = useState(0);
    const [nodeReload, setNodeReload] = useState(0);
    const [portal, setPortal] = useState<PortalLink | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [createMapOpen, setCreateMapOpen] = useState(false);
    const [sourceCatalogOpen, setSourceCatalogOpen] = useState(false);

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
    }, [mapReload, selectedMapId]);

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
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:border-white/20 dark:hover:bg-white/10" data-wl-id="authoring.source-catalog.open" onClick={() => setSourceCatalogOpen(true)} type="button">Source catalog</button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        onClick={() => setCreateMapOpen(true)}
                        type="button"
                    >
                        <Plus className="mr-1 inline size-4" />
                        Create map
                    </button>
                </div>
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
                            onUpdated={() => {
                                setMapReload((current) => current + 1);
                                void loadWorld();
                            }}
                            onDeleted={() => {
                                setEditableMap(null);
                                setEditableNode(null);
                                setPortal(null);
                                navigate('/settings?panel=admin-world-builder');
                                void loadWorld();
                            }}
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
            {createMapOpen ? (
                <CreateMapDialog
                    onClose={() => setCreateMapOpen(false)}
                    onCreated={(mapId) => {
                        setCreateMapOpen(false);
                        void loadWorld();
                        selectMap(mapId);
                    }}
                />
            ) : null}
            {sourceCatalogOpen ? <OriginalSourceCatalogDialog onClose={() => setSourceCatalogOpen(false)} /> : null}
        </main>
    );
}

function CreateMapDialog({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (mapId: string) => void;
}) {
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim()) {
            setError('Add a map title before creating it.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps',
                {
                    body: {
                        description: optionalValue(description),
                        slug: optionalValue(slug),
                        title,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data) {
                setError(
                    response.status === 400
                        ? 'Use a title, a lowercase slug, and a description within the shown limits.'
                        : 'The map could not be created. Refresh the World Builder and try again.',
                );
                return;
            }
            onCreated(data.map_id);
        } catch {
            setError('The map could not be created. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div aria-labelledby="create-map-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog">
            <form className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950" onSubmit={(event) => void save(event)}>
                <h2 className="text-xl font-semibold" id="create-map-title">Create world node</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Add a standalone map to this world graph. You can connect portal tiles later.</p>
                {error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">{error}</p> : null}
                <div className="mt-5 grid gap-4">
                    <ActivityTextField label="Title" onChange={setTitle} value={title} />
                    <ActivityTextField label="Slug" onChange={setSlug} value={slug} />
                    <ActivityTextField label="Description" onChange={setDescription} textarea value={description} />
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button">Cancel</button>
                    <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={saving} type="submit">{saving ? 'Creating…' : 'Create'}</button>
                </div>
            </form>
        </div>
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
    onDeleted,
    onUpdated,
    onSelectNode,
}: {
    document: EditableMap;
    onDeleted: () => void;
    onUpdated: () => void;
    onSelectNode: (nodeId: string) => void;
}) {
    const { map } = document.editable_map;
    const [editOpen, setEditOpen] = useState(false);
    const [accessOpen, setAccessOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const deleteMap = async () => {
        setDeleteError(null);
        setDeleting(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/maps/{map_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setDeleteError(
                    'The map could not be deleted. Refresh the World Builder and try again.',
                );
                return;
            }
            onDeleted();
        } catch {
            setDeleteError('The map could not be deleted. Check your connection and try again.');
        } finally {
            setDeleting(false);
        }
    };

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
            <button
                className="mt-5 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                onClick={() => setEditOpen(true)}
                type="button"
            >
                Edit map details
            </button>
            {document.can_manage_map_access ? (
                <button
                    className="mt-3 block rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10"
                    onClick={() => setAccessOpen(true)}
                    type="button"
                >
                    Manage map access
                </button>
            ) : null}
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
            {document.can_delete_world_maps ? (
                <section className="mt-6 border-t border-red-200 pt-4 dark:border-red-400/30">
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                        Delete map
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Remove this map and all of its authored tiles and learning state.
                    </p>
                    <button
                        className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-400/50 dark:text-red-200 dark:hover:bg-red-400/10"
                        onClick={() => setDeleteOpen(true)}
                        type="button"
                    >
                        <Trash2 className="size-4" />
                        Delete map
                    </button>
                </section>
            ) : null}
            {deleteOpen ? (
                <div
                    aria-labelledby="delete-map-title"
                    aria-modal="true"
                    className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
                    role="dialog"
                >
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                        <h2 className="text-xl font-semibold" id="delete-map-title">
                            Delete world map?
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            This removes the map, its tiles, activities, portal links and learner progress for those tiles. This cannot be undone.
                        </p>
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-100">
                            <span className="font-semibold">{map.title}</span>
                            <span className="mt-1 block text-red-800 dark:text-red-200/80">
                                {map.node_count} tile{map.node_count === 1 ? '' : 's'} will be deleted with this map.
                            </span>
                        </div>
                        {deleteError ? (
                            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                                {deleteError}
                            </p>
                        ) : null}
                        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                            <button
                                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                                disabled={deleting}
                                onClick={() => setDeleteOpen(false)}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 dark:bg-red-500 dark:text-slate-950 dark:hover:bg-red-400"
                                disabled={deleting}
                                onClick={() => void deleteMap()}
                                type="button"
                            >
                                <Trash2 className="size-4" />
                                {deleting ? 'Deleting…' : 'Delete world map'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {editOpen ? (
                <EditMapDetailsDialog
                    document={document}
                    onClose={() => setEditOpen(false)}
                    onUpdated={() => {
                        setEditOpen(false);
                        onUpdated();
                    }}
                />
            ) : null}
            {accessOpen ? (
                <EditMapAccessDialog
                    document={document}
                    onClose={() => setAccessOpen(false)}
                    onUpdated={() => {
                        setAccessOpen(false);
                        onUpdated();
                    }}
                />
            ) : null}
        </div>
    );
}

function EditMapAccessDialog({
    document,
    onClose,
    onUpdated,
}: {
    document: EditableMap;
    onClose: () => void;
    onUpdated: () => void;
}) {
    const { map } = document.editable_map;
    const [accessRoles, setAccessRoles] = useState(map.access_roles);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const toggleRole = (role: string, enabled: boolean) => {
        setAccessRoles((current) => {
            if (enabled) {
                return current.includes(role) ? current : [...current, role];
            }
            const next = current.filter((candidate) => candidate !== role);
            return next.length > 0 ? next : current;
        });
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (accessRoles.length === 0) {
            setError('Choose at least one group that can visit this map.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/maps/{map_id}/access',
                {
                    body: { access_roles: accessRoles },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    response.status === 400
                        ? 'Choose at least one current access group.'
                        : 'Map access could not be saved. Refresh the World Builder and try again.',
                );
                return;
            }
            onUpdated();
        } catch {
            setError('Map access could not be saved. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="edit-map-access-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <h2 className="text-xl font-semibold" id="edit-map-access-title">
                    Access permissions
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Choose which groups may visit this map and the tiles inside it. Configuration remains restricted to authorized admins.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <fieldset className="mt-5 grid gap-3">
                    <legend className="sr-only">Map access groups</legend>
                    {document.access_groups.map((group) => (
                        <label
                            className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10"
                            key={group.slug}
                        >
                            <input
                                checked={accessRoles.includes(group.slug)}
                                className="mt-0.5 size-4 accent-teal-700"
                                onChange={(event) =>
                                    toggleRole(group.slug, event.target.checked)
                                }
                                type="checkbox"
                            />
                            <span>
                                <span className="block font-medium">{group.label}</span>
                                {group.description ? (
                                    <span className="mt-1 block text-slate-600 dark:text-slate-300">
                                        {group.description}
                                    </span>
                                ) : null}
                            </span>
                        </label>
                    ))}
                </fieldset>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950"
                        disabled={saving}
                        type="submit"
                    >
                        {saving ? 'Saving…' : 'Save access'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function EditMapDetailsDialog({
    document,
    onClose,
    onUpdated,
}: {
    document: EditableMap;
    onClose: () => void;
    onUpdated: () => void;
}) {
    const { map } = document.editable_map;
    const [title, setTitle] = useState(map.title);
    const [description, setDescription] = useState(map.description);
    const [topicId, setTopicId] = useState(map.topic_id ?? '');
    const [mapAssetsLocked, setMapAssetsLocked] = useState(
        map.map_assets_locked,
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim()) {
            setError('Add a map title before saving.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/maps/{map_id}/details',
                {
                    body: {
                        description: optionalValue(description),
                        map_assets_locked: mapAssetsLocked,
                        title,
                        topic_id: optionalValue(topicId),
                        updated_at: map.updated_at,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    response.status === 400
                        ? 'Use a title and description within the shown limits, and choose a current learning topic.'
                        : response.status === 409
                          ? 'This map changed in another session. Close this dialog, reload the map, then apply your changes again.'
                          : 'The map details could not be saved. Refresh the World Builder and try again.',
                );
                return;
            }
            onUpdated();
        } catch {
            setError('The map details could not be saved. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="edit-map-details-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <h2 className="text-xl font-semibold" id="edit-map-details-title">
                    Edit map details
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Name this map, connect it to a learning topic, and decide whether its MapAsset surface is locked for editing.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-4">
                    <ActivityTextField
                        label="Title"
                        onChange={setTitle}
                        value={title}
                    />
                    <label className="grid gap-1 text-sm font-medium">
                        Learning topic
                        <select
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                            onChange={(event) => setTopicId(event.target.value)}
                            value={topicId}
                        >
                            <option value="">No learning topic</option>
                            {document.topic_options.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <ActivityTextField
                        label="Description"
                        onChange={setDescription}
                        textarea
                        value={description}
                    />
                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                        <input
                            checked={mapAssetsLocked}
                            className="mt-0.5 size-4 accent-teal-700"
                            onChange={(event) => setMapAssetsLocked(event.target.checked)}
                            type="checkbox"
                        />
                        <span>
                            <span className="block font-medium">Lock MapAsset surface</span>
                            <span className="mt-1 block text-slate-600 dark:text-slate-300">
                                Keep the map surface locked while you work on its activity tiles.
                            </span>
                        </span>
                    </label>
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950"
                        disabled={saving}
                        type="submit"
                    >
                        {saving ? 'Saving…' : 'Save details'}
                    </button>
                </div>
            </form>
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
    const [historyActivity, setHistoryActivity] = useState<Activity | null>(null);
    const [templateDialog, setTemplateDialog] = useState<{
        activity?: Activity;
        mode: 'library' | 'save' | 'update';
    } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [pendingStartRouteDeletion, setPendingStartRouteDeletion] =
        useState<ActivityStartRoute | null>(null);
    const [deletingStartRoute, setDeletingStartRoute] = useState(false);
    const [startRouteError, setStartRouteError] = useState<string | null>(null);
    const [selectedStartRoute, setSelectedStartRoute] =
        useState<ActivityStartRoute | null>(null);
    const initialNodes = useMemo<ActivityFlowNode[]>(() => {
        const start: SpecialNode = {
            id: '__start',
            type: 'special',
            data: { kind: 'start', label: 'Start' },
            position: graphPosition(graph.node.graph_layout, 'start', -260, 0),
        };
        const activities: ActivityNode[] = graph.activities.map(
            (activity, index) => ({
                id: activity.id,
                type: 'activity',
                data: {
                    activity,
                    onDelete: setPendingDelete,
                    onHistory: setHistoryActivity,
                    onSaveTemplate: (candidate) =>
                        setTemplateDialog({ activity: candidate, mode: 'save' }),
                    onUpdateTemplate: (candidate) =>
                        setTemplateDialog({ activity: candidate, mode: 'update' }),
                },
                position: {
                    x: activity.position.x ?? (index % 3) * 310,
                    y: activity.position.y ?? Math.floor(index / 3) * 220,
                },
            }),
        );
        const end: SpecialNode = {
            id: '__end',
            type: 'special',
            data: { kind: 'end', label: 'End' },
            position: graphPosition(graph.node.graph_layout, 'end', 720, 0),
        };

        return [start, ...activities, end];
    }, [graph]);
    const initialEdges = useMemo<Edge[]>(
        () => [
            ...(graph.node.start_routes.length > 0
                ? graph.node.start_routes.map((route) => ({
                      id: `__start-edge:${route.id}`,
                      source: '__start',
                      sourceHandle: 'start',
                      target: route.activity_id,
                      targetHandle: 'in',
                      label: route.label,
                      markerEnd: { type: MarkerType.ArrowClosed },
                  }))
                : graph.node.start_activity_id
                  ? [
                        {
                            id: '__start-edge:legacy',
                            source: '__start',
                            sourceHandle: 'start',
                            target: graph.node.start_activity_id,
                            targetHandle: 'in',
                            markerEnd: { type: MarkerType.ArrowClosed },
                        },
                    ]
                  : []),
            ...graph.transitions.map((transition) => ({
                id: transition.id,
                source: transition.from_activity_id,
                sourceHandle: transition.from_connector,
                target: transition.to_activity_id ?? '__end',
                targetHandle:
                    transition.to_activity_id === null
                        ? 'end'
                        : transition.to_connector,
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
        template?: { snapshot: { [key: string]: unknown }; title: string };
        type: SupportedActivityType;
    } | null>(null);
    const [selectedTransition, setSelectedTransition] =
        useState<ActivityTransition | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialEdges, initialNodes, setEdges, setNodes]);

    const savePosition = useCallback(
        async (node: ActivityFlowNode) => {
            setSavingActivityId(node.id);
            try {
                const token = await getCsrfToken();
                if (node.id === '__start' || node.id === '__end') {
                    const { response } = await apiClient.PATCH(
                        '/admin/world-builder/nodes/{node_id}/activity-graph-layout',
                        {
                            body: {
                                node: node.id === '__start' ? 'start' : 'end',
                                position: node.position,
                            },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { node_id: graph.node.id },
                            },
                        },
                    );
                    if (!response.ok) {
                        throw new Error('graph layout unavailable');
                    }
                    return;
                }
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
        },
        [graph.node.id],
    );

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

    const selectTransition = useCallback(
        (transitionId: string) => {
            const transition = graph.transitions.find(
                (candidate) => candidate.id === transitionId,
            );
            if (transition) {
                setSelectedTransition(transition);
            }
        },
        [graph.transitions],
    );

    const openStartRoute = useCallback(
        (activityId: string) => {
            const route = graph.node.start_routes.find(
                (candidate) => candidate.activity_id === activityId,
            );
            if (route) {
                setStartRouteError(null);
                setSelectedStartRoute(route);
            }
        },
        [graph.node.start_routes],
    );

    const deleteStartRoute = useCallback(async () => {
        if (!pendingStartRouteDeletion) {
            return;
        }
        setStartRouteError(null);
        setDeletingStartRoute(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/start-routes/{start_route_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_route_id: pendingStartRouteDeletion.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('start route unavailable');
            }
            setPendingStartRouteDeletion(null);
            onReload();
        } catch {
            setStartRouteError(
                'The learner start could not be deleted. Reload the graph and try again.',
            );
        } finally {
            setDeletingStartRoute(false);
        }
    }, [onReload, pendingStartRouteDeletion]);

    const connectActivities = useCallback(
        async (connection: Connection) => {
            if (!connection.source || !connection.target) {
                return;
            }
            setConnectionError(null);
            try {
                const token = await getCsrfToken();
                if (connection.source === '__start') {
                    if (connection.target === '__end') {
                        return;
                    }
                    const { response } = await apiClient.POST(
                        '/admin/world-builder/nodes/{node_id}/start-routes',
                        {
                            body: { activity_id: connection.target },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { node_id: graph.node.id },
                            },
                        },
                    );
                    if (!response.ok) {
                        throw new Error('start route unavailable');
                    }
                    onReload();
                    return;
                }
                if (connection.source.startsWith('__')) {
                    return;
                }
                const { response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/activity-transitions',
                    {
                        body: {
                            from_activity_id: connection.source,
                            from_connector:
                                connection.sourceHandle ?? 'completed',
                            to_activity_id:
                                connection.target === '__end'
                                    ? null
                                    : connection.target,
                            to_connector:
                                connection.target === '__end'
                                    ? 'end'
                                    : (connection.targetHandle ?? 'in'),
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: graph.node.id },
                        },
                    },
                );
                if (!response.ok) {
                    throw new Error('transition unavailable');
                }
                onReload();
            } catch {
                setConnectionError(
                    'The connection could not be saved. Check the graph and try again.',
                );
            }
        },
        [graph.node.id, onReload],
    );

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
                            data-wl-id="authoring.activity-templates.open"
                            onClick={() => setTemplateDialog({ mode: 'library' })}
                            type="button"
                        >
                            <BookmarkPlus className="size-3.5" />
                            Activity templates
                        </button>
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
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'item_obstacle' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Item obstacle
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'obstacle' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Obstacle
                        </button>
                    </div>
                </div>
                {connectionError ? (
                    <p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {connectionError}
                    </p>
                ) : null}
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
                    onEdgeClick={(_, edge) => {
                        if (edge.id.startsWith('__start-edge:')) {
                            openStartRoute(edge.target);
                            return;
                        }
                        selectTransition(edge.id);
                    }}
                    onConnect={(connection) =>
                        void connectActivities(connection)
                    }
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
                    sounds={document.sounds}
                    tools={document.tools}
                    nodeId={graph.node.id}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        setEditor(null);
                        onReload();
                    }}
                    template={editor.template}
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
            {selectedTransition ? (
                <TransitionEditorDialog
                    onClose={() => setSelectedTransition(null)}
                    onSaved={() => {
                        setSelectedTransition(null);
                        onReload();
                    }}
                    transition={selectedTransition}
                />
            ) : null}
            {selectedStartRoute ? (
                <StartRouteEditorDialog
                    activity={
                        graph.activities.find(
                            (activity) =>
                                activity.id === selectedStartRoute.activity_id,
                        ) ?? null
                    }
                    onClose={() => setSelectedStartRoute(null)}
                    onDelete={() => {
                        setSelectedStartRoute(null);
                        setPendingStartRouteDeletion(selectedStartRoute);
                    }}
                    onSaved={() => {
                        setSelectedStartRoute(null);
                        onReload();
                    }}
                    route={selectedStartRoute}
                    routeIndex={graph.node.start_routes.findIndex(
                        (route) => route.id === selectedStartRoute.id,
                    )}
                    routeTotal={graph.node.start_routes.length}
                />
            ) : null}
            {pendingStartRouteDeletion ? (
                <DeleteStartRouteDialog
                    error={startRouteError}
                    onCancel={() => {
                        if (!deletingStartRoute) {
                            setStartRouteError(null);
                            setPendingStartRouteDeletion(null);
                        }
                    }}
                    onConfirm={() => void deleteStartRoute()}
                    processing={deletingStartRoute}
                />
            ) : null}
            {historyActivity ? (
                <OriginalActivityHistoryDialog
                    activityId={historyActivity.id}
                    activityTitle={historyActivity.title}
                    onClose={() => setHistoryActivity(null)}
                    onRestored={() => {
                        setHistoryActivity(null);
                        onReload();
                    }}
                />
            ) : null}
            {templateDialog ? (
                <OriginalActivityTemplatesDialog
                    activity={templateDialog.activity}
                    mode={templateDialog.mode}
                    onClose={() => setTemplateDialog(null)}
                    onUseTemplate={(template) => {
                        if (!isSupportedActivityType(template.activity_type)) {
                            setConnectionError(
                                'This template uses an activity type that is not yet available in the Rust editor.',
                            );
                            return;
                        }
                        setTemplateDialog(null);
                        setEditor({
                            template,
                            type: template.activity_type,
                        });
                    }}
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
            <ActivityConnectorHandles
                connectors={activity.connectors.inputs}
                position={Position.Left}
                type="target"
            />
            <ActivityConnectorHandles
                connectors={activity.connectors.outputs}
                position={Position.Right}
                type="source"
            />
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
            {activity.connectors.outputs.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                    {activity.connectors.outputs.map((connector) => (
                        <span
                            className="rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800 dark:bg-teal-300/10 dark:text-teal-200"
                            key={connector.id}
                        >
                            {connector.label}
                        </span>
                    ))}
                </div>
            ) : null}
            <button
                className="mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10"
                data-wl-id="authoring.activity-history.open"
                onClick={(event) => {
                    event.stopPropagation();
                    data.onHistory(activity);
                }}
                type="button"
            >
                Activity history
            </button>
            {activity.activity_type !== 'npc_dialogue' ? (
                <div className="mt-1 flex flex-wrap gap-1">
                <button
                    aria-label={`Save ${activity.title} as a reusable template`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onSaveTemplate(activity);
                    }}
                    title="Save reusable template"
                    type="button"
                >
                    <BookmarkPlus className="size-3" />
                    Save template
                </button>
                <button
                    aria-label={`Update a saved template from ${activity.title}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onUpdateTemplate(activity);
                    }}
                    title="Update saved template"
                    type="button"
                >
                    <RefreshCw className="size-3" />
                    Update template
                </button>
                </div>
            ) : null}
        </div>
    );
}

function ActivityConnectorHandles({
    connectors,
    position,
    type,
}: {
    connectors: ActivityConnector[];
    position: Position;
    type: 'source' | 'target';
}) {
    return (
        <>
            {connectors.map((connector, index) => (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-teal-700 dark:!border-slate-950 dark:!bg-teal-300"
                    id={connector.id}
                    key={connector.id}
                    position={position}
                    style={{
                        top: `${((index + 1) / (connectors.length + 1)) * 100}%`,
                    }}
                    title={connector.label}
                    type={type}
                />
            ))}
        </>
    );
}

function StartRouteEditorDialog({
    activity,
    onClose,
    onDelete,
    onSaved,
    route,
    routeIndex,
    routeTotal,
}: {
    activity: Activity | null;
    onClose: () => void;
    onDelete: () => void;
    onSaved: () => void;
    route: ActivityStartRoute;
    routeIndex: number;
    routeTotal: number;
}) {
    const [form, setForm] = useState<StartRouteForm>(() =>
        startRouteForm(route),
    );
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const update = <Key extends keyof StartRouteForm>(
        key: Key,
        value: StartRouteForm[Key],
    ) => setForm((current) => ({ ...current, [key]: value }));

    const save = async () => {
        const colors = [
            form.buttonColorDark,
            form.buttonBorderColorDark,
            form.buttonColorLight,
            form.buttonBorderColorLight,
        ];
        if (colors.some((color) => color !== '' && !validHexColor(color))) {
            setError('Button colors must use six-digit hexadecimal values.');
            return;
        }
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/start-routes/{start_route_id}',
                {
                    body: {
                        button_border_color_dark: optionalValue(
                            form.buttonBorderColorDark,
                        ),
                        button_border_color_light: optionalValue(
                            form.buttonBorderColorLight,
                        ),
                        button_color_dark: optionalValue(form.buttonColorDark),
                        button_color_light: optionalValue(
                            form.buttonColorLight,
                        ),
                        description: optionalValue(form.description),
                        image_dark: optionalValue(form.imageDark),
                        image_light: optionalValue(form.imageLight),
                        label: optionalValue(form.label),
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_route_id: route.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('start route unavailable');
            }
            onSaved();
        } catch {
            setError(
                'The learner start could not be saved. Check the fields and try again.',
            );
        } finally {
            setProcessing(false);
        }
    };

    const reorder = async (direction: 'up' | 'down') => {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/admin/world-builder/start-routes/{start_route_id}/reorder',
                {
                    body: { direction },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_route_id: route.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('start route unavailable');
            }
            onSaved();
        } catch {
            setError('The learner start could not be reordered. Try again.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div
            aria-labelledby="start-route-editor-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2
                            className="text-xl font-semibold"
                            id="start-route-editor-title"
                        >
                            Route visuals
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Configure the learner-facing start for{' '}
                            {activity?.title ?? route.label}.
                        </p>
                    </div>
                    <button
                        aria-label="Close route form"
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        disabled={processing}
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
                <div className="mt-5 grid gap-5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-xs font-medium tracking-[0.16em] text-teal-700 uppercase dark:text-teal-300">
                            Starts activity
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                            {activity?.title ?? route.label}
                        </p>
                    </div>
                    {routeIndex >= 0 && routeTotal > 1 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                            <span>
                                Route order: {routeIndex + 1} of {routeTotal}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    className="rounded-md border border-slate-200 px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
                                    disabled={processing || routeIndex === 0}
                                    onClick={() => void reorder('up')}
                                    type="button"
                                >
                                    Move earlier
                                </button>
                                <button
                                    className="rounded-md border border-slate-200 px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
                                    disabled={
                                        processing ||
                                        routeIndex === routeTotal - 1
                                    }
                                    onClick={() => void reorder('down')}
                                    type="button"
                                >
                                    Move later
                                </button>
                            </div>
                        </div>
                    ) : null}
                    <label className="grid gap-2 text-sm font-medium">
                        Route name
                        <input
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            maxLength={120}
                            onChange={(event) =>
                                update('label', event.target.value)
                            }
                            value={form.label}
                        />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                        Route guidance
                        <textarea
                            className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            maxLength={600}
                            onChange={(event) =>
                                update('description', event.target.value)
                            }
                            value={form.description}
                        />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                        <RouteField
                            label="Dark route image"
                            onChange={(value) => update('imageDark', value)}
                            value={form.imageDark}
                        />
                        <RouteField
                            label="Light route image"
                            onChange={(value) => update('imageLight', value)}
                            value={form.imageLight}
                        />
                        <RouteField
                            label="Dark button color"
                            onChange={(value) =>
                                update('buttonColorDark', value)
                            }
                            value={form.buttonColorDark}
                        />
                        <RouteField
                            label="Dark border and frame color"
                            onChange={(value) =>
                                update('buttonBorderColorDark', value)
                            }
                            value={form.buttonBorderColorDark}
                        />
                        <RouteField
                            label="Light button color"
                            onChange={(value) =>
                                update('buttonColorLight', value)
                            }
                            value={form.buttonColorLight}
                        />
                        <RouteField
                            label="Light border and frame color"
                            onChange={(value) =>
                                update('buttonBorderColorLight', value)
                            }
                            value={form.buttonBorderColorLight}
                        />
                    </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-300/10"
                        disabled={processing}
                        onClick={onDelete}
                        type="button"
                    >
                        Delete route
                    </button>
                    <div className="flex gap-3">
                        <button
                            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10"
                            disabled={processing}
                            onClick={onClose}
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-300 dark:text-slate-950 dark:hover:bg-teal-200"
                            disabled={processing}
                            onClick={() => void save()}
                            type="button"
                        >
                            {processing ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function RouteField({
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
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                maxLength={2048}
                onChange={(event) => onChange(event.target.value)}
                value={value}
            />
        </label>
    );
}

function DeleteStartRouteDialog({
    error,
    onCancel,
    onConfirm,
    processing,
}: {
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
    processing: boolean;
}) {
    return (
        <div
            aria-labelledby="delete-start-route-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <h2
                    className="text-xl font-semibold"
                    id="delete-start-route-title"
                >
                    Delete route?
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    This removes the route button from the learner node panel.
                    The target activity stays untouched.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10"
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

function startRouteForm(route: ActivityStartRoute): StartRouteForm {
    return {
        buttonBorderColorDark: route.button_border_color_dark ?? '',
        buttonBorderColorLight: route.button_border_color_light ?? '',
        buttonColorDark: route.button_color_dark ?? '',
        buttonColorLight: route.button_color_light ?? '',
        description: route.description ?? '',
        imageDark: route.image_dark ?? '',
        imageLight: route.image_light ?? '',
        label: route.label,
    };
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

function TransitionEditorDialog({
    onClose,
    onSaved,
    transition,
}: {
    onClose: () => void;
    onSaved: () => void;
    transition: ActivityTransition;
}) {
    const [label, setLabel] = useState(transition.label ?? '');
    const [triggerValue, setTriggerValue] = useState(
        transition.trigger_value ?? '',
    );
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const save = async () => {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/activity-transitions/{transition_id}',
                {
                    body: {
                        label: optionalValue(label),
                        trigger_value:
                            transition.trigger === 'outcome'
                                ? optionalValue(triggerValue)
                                : null,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { transition_id: transition.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    'The connection could not be saved. Check the values and try again.',
                );
                return;
            }
            onSaved();
        } catch {
            setError(
                'The connection could not be saved. Check your connection and try again.',
            );
        } finally {
            setProcessing(false);
        }
    };

    const remove = async () => {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/activity-transitions/{transition_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { transition_id: transition.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    'The connection could not be deleted. Reload the graph and try again.',
                );
                return;
            }
            onSaved();
        } catch {
            setError(
                'The connection could not be deleted. Check your connection and try again.',
            );
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div
            aria-labelledby="transition-editor-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <h2
                    className="text-xl font-semibold"
                    id="transition-editor-title"
                >
                    Edit connection
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Give this path a short label for the activity graph. Leaving
                    it blank restores the default label.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-4">
                    <ActivityTextField
                        label="Connection label"
                        onChange={setLabel}
                        value={label}
                    />
                    {transition.trigger === 'outcome' ? (
                        <ActivityTextField
                            label="Answer outcome key"
                            onChange={setTriggerValue}
                            value={triggerValue}
                        />
                    ) : null}
                </div>
                <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-300/10"
                        disabled={processing}
                        onClick={() => void remove()}
                        type="button"
                    >
                        <Trash2 className="size-4" />
                        Delete connection
                    </button>
                    <div className="flex gap-3">
                        <button
                            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-white/10"
                            disabled={processing}
                            onClick={onClose}
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                            disabled={processing}
                            onClick={() => void save()}
                            type="button"
                        >
                            {processing ? 'Saving…' : 'Save'}
                        </button>
                    </div>
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
    sounds,
    template,
    type,
    tools,
}: {
    activity?: Activity;
    items: EditableItem[];
    nodeId: string;
    onClose: () => void;
    onSaved: () => void;
    sounds: EditableSound[];
    template?: { snapshot: { [key: string]: unknown }; title: string };
    type: SupportedActivityType;
    tools: EditableTool[];
}) {
    const [form, setForm] = useState(() =>
        template
            ? activityAuthorFormFromTemplate(type, template, items, tools, sounds)
            : activityAuthorForm(type, activity, items, tools, sounds),
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
                : type === 'tool_grant'
                  ? 'Tool grant'
                  : type === 'item_obstacle'
                    ? 'Item obstacle'
                    : 'Obstacle';

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
        const itemObstacle = itemObstacleRequest(form);
        if (type === 'item_obstacle' && !itemObstacle) {
            setError(
                'Use values within the shown source ranges and choose a sound for each enabled event.',
            );
            return;
        }
        const completeItemObstacle =
            itemObstacle ?? defaultItemObstacleRequest();
        const obstacle = obstacleRequest(form.obstacle);
        if (type === 'obstacle' && !obstacle) {
            setError(
                'Use valid colors and values within the shown source ranges before saving.',
            );
            return;
        }
        const completeObstacle = obstacle ?? defaultObstacleRequest();

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
            } else if (type === 'obstacle' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/obstacle',
                    {
                        body: {
                            ...common,
                            ...completeObstacle,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'obstacle') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/obstacle-activities',
                    {
                        body: { ...common, ...completeObstacle },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: nodeId },
                        },
                    },
                ));
            } else if (type === 'item_obstacle' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/item-obstacle',
                    {
                        body: {
                            ...common,
                            ...completeItemObstacle,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'item_obstacle') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/item-obstacle-activities',
                    {
                        body: { ...common, ...completeItemObstacle },
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
                                : template
                                  ? `Copy ${typeLabel} template`
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
                    ) : type === 'item_obstacle' ? (
                        <ItemObstacleFields
                            form={form}
                            items={items}
                            onChange={setForm}
                            sounds={sounds}
                        />
                    ) : type === 'obstacle' ? (
                        <ObstacleFields
                            form={form.obstacle}
                            onChange={(obstacle) =>
                                setForm((current) => ({ ...current, obstacle }))
                            }
                            tools={tools}
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

function ItemObstacleFields({
    form,
    items,
    onChange,
    sounds,
}: {
    form: ActivityAuthorForm;
    items: EditableItem[];
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
    sounds: EditableSound[];
}) {
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) =>
        onChange((current) => ({ ...current, [field]: value }));
    const updateSlot = (
        index: number,
        field: 'itemId' | 'x' | 'y' | 'width',
        value: string,
    ) =>
        onChange((current) => ({
            ...current,
            itemObstacleSlots: current.itemObstacleSlots.map(
                (slot, slotIndex) =>
                    slotIndex === index ? { ...slot, [field]: value } : slot,
            ),
        }));

    return (
        <>
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-medium">Required slots</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Each slot requires an owned item before learners can
                            continue.
                        </p>
                    </div>
                    <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
                        disabled={form.itemObstacleSlots.length >= 10}
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                itemObstacleSlots: [
                                    ...current.itemObstacleSlots,
                                    {
                                        itemId: '',
                                        width: '10',
                                        x: '50',
                                        y: '50',
                                    },
                                ],
                            }))
                        }
                        type="button"
                    >
                        <Plus className="size-3.5" />
                        Add slot
                    </button>
                </div>
                {form.itemObstacleSlots.map((slot, index) => (
                    <div
                        className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_repeat(3,5rem)_auto] dark:bg-white/5"
                        key={`${slot.itemId}-${index}`}
                    >
                        <select
                            aria-label={`Required item ${index + 1}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            onChange={(event) =>
                                updateSlot(index, 'itemId', event.target.value)
                            }
                            value={slot.itemId}
                        >
                            <option value="">Select item</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </select>
                        {(['x', 'y', 'width'] as const).map((field) => (
                            <input
                                aria-label={`${field} for required item ${index + 1}`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                                key={field}
                                max="100"
                                min={field === 'width' ? '1' : '0'}
                                onChange={(event) =>
                                    updateSlot(index, field, event.target.value)
                                }
                                type="number"
                                value={slot[field]}
                            />
                        ))}
                        <button
                            aria-label="Remove required item slot"
                            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-300/10 dark:hover:text-red-300"
                            onClick={() =>
                                onChange((current) => ({
                                    ...current,
                                    itemObstacleSlots:
                                        current.itemObstacleSlots.filter(
                                            (_, slotIndex) =>
                                                slotIndex !== index,
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
            <ToolGrantNumberField
                label="Failed try lockout (minutes)"
                max={10_080}
                min={0}
                onChange={(value) => update('itemObstacleLockMinutes', value)}
                suffix="min"
                value={form.itemObstacleLockMinutes}
            />
            <label className="flex items-center gap-3 text-sm font-medium">
                <input
                    checked={form.itemObstacleConsumeOnEachEntry}
                    onChange={(event) =>
                        update(
                            'itemObstacleConsumeOnEachEntry',
                            event.target.checked,
                        )
                    }
                    type="checkbox"
                />
                Consume items on every entry
            </label>
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Item obstacle scene</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        ['itemObstacleBackgroundDark', 'Dark background'],
                        ['itemObstacleBackgroundLight', 'Light background'],
                        [
                            'itemObstacleMetBackgroundDark',
                            'Dark met background',
                        ],
                        [
                            'itemObstacleMetBackgroundLight',
                            'Light met background',
                        ],
                        ['itemObstacleOverlayDark', 'Dark overlay image'],
                        ['itemObstacleOverlayLight', 'Light overlay image'],
                    ].map(([field, label]) => (
                        <ActivityTextField
                            key={field}
                            label={label}
                            onChange={(value) =>
                                update(field as keyof ActivityAuthorForm, value)
                            }
                            value={String(
                                form[field as keyof ActivityAuthorForm],
                            )}
                        />
                    ))}
                    <ToolGrantNumberField
                        label="Overlay x position"
                        max={100}
                        min={0}
                        onChange={(value) =>
                            update('itemObstacleOverlayX', value)
                        }
                        suffix="%"
                        value={form.itemObstacleOverlayX}
                    />
                    <ToolGrantNumberField
                        label="Overlay y position"
                        max={100}
                        min={0}
                        onChange={(value) =>
                            update('itemObstacleOverlayY', value)
                        }
                        suffix="%"
                        value={form.itemObstacleOverlayY}
                    />
                    <ToolGrantNumberField
                        label="Overlay width"
                        max={100}
                        min={1}
                        onChange={(value) =>
                            update('itemObstacleOverlayWidth', value)
                        }
                        suffix="%"
                        value={form.itemObstacleOverlayWidth}
                    />
                </div>
                {[
                    [
                        'itemObstacleBackgroundMirrored',
                        'Mirror background horizontally',
                    ],
                    [
                        'itemObstacleMetBackgroundMirrored',
                        'Mirror met background horizontally',
                    ],
                    [
                        'itemObstacleOverlayMirrored',
                        'Mirror overlay horizontally',
                    ],
                ].map(([field, label]) => (
                    <label
                        className="flex items-center gap-3 text-sm font-medium"
                        key={field}
                    >
                        <input
                            checked={Boolean(
                                form[field as keyof ActivityAuthorForm],
                            )}
                            onChange={(event) =>
                                update(
                                    field as keyof ActivityAuthorForm,
                                    event.target.checked,
                                )
                            }
                            type="checkbox"
                        />
                        {label}
                    </label>
                ))}
            </section>
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Item obstacle sounds</h3>
                {[
                    ['itemObstacleSoundNotMet', 'Conditions not met'],
                    ['itemObstacleSoundTransition', 'Transition to met'],
                    ['itemObstacleSoundMet', 'Conditions met'],
                ].map(([prefix, label]) => {
                    const enabledField =
                        `${prefix}Enabled` as keyof ActivityAuthorForm;
                    const idField = `${prefix}Id` as keyof ActivityAuthorForm;
                    return (
                        <div
                            className="grid gap-2 md:grid-cols-[auto_1fr]"
                            key={prefix}
                        >
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                    checked={Boolean(form[enabledField])}
                                    onChange={(event) =>
                                        update(
                                            enabledField,
                                            event.target.checked,
                                        )
                                    }
                                    type="checkbox"
                                />
                                {label}
                            </label>
                            <select
                                aria-label={`${label} sound`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                                disabled={!form[enabledField]}
                                onChange={(event) =>
                                    update(idField, event.target.value)
                                }
                                value={String(form[idField])}
                            >
                                <option value="">Select sound</option>
                                {sounds.map((sound) => (
                                    <option key={sound.id} value={sound.id}>
                                        {sound.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </section>
        </>
    );
}

function ObstacleFields({
    form,
    onChange,
    tools,
}: {
    form: ObstacleForm;
    onChange: (form: ObstacleForm) => void;
    tools: EditableTool[];
}) {
    const update = <Key extends keyof ObstacleForm>(
        key: Key,
        value: ObstacleForm[Key],
    ) => onChange({ ...form, [key]: value });
    const imageFields: Array<[keyof ObstacleForm, string]> = [
        ['backgroundDark', 'Dark background'],
        ['backgroundLight', 'Light background'],
        ['imageDark', 'Dark obstacle image'],
        ['imageLight', 'Light obstacle image'],
        ['revisitBackgroundDark', 'Dark cleared background'],
        ['revisitBackgroundLight', 'Light cleared background'],
        ['revisitImageDark', 'Dark cleared image'],
        ['revisitImageLight', 'Light cleared image'],
    ];
    return (
        <>
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Tools that work here</h3>
                <select
                    aria-label="Add a tool"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/40"
                    onChange={(event) => {
                        const id = event.target.value;
                        if (id && !form.allowedToolIds.includes(id))
                            update('allowedToolIds', [
                                ...form.allowedToolIds,
                                id,
                            ]);
                    }}
                    value=""
                >
                    <option value="">Add a tool</option>
                    {tools
                        .filter(
                            (tool) => !form.allowedToolIds.includes(tool.id),
                        )
                        .map((tool) => (
                            <option key={tool.id} value={tool.id}>
                                {tool.title}
                            </option>
                        ))}
                </select>
                <div className="flex flex-wrap gap-2">
                    {form.allowedToolIds.map((id) => {
                        const tool = tools.find(
                            (candidate) => candidate.id === id,
                        );
                        return tool ? (
                            <button
                                className="rounded-md bg-teal-100 px-2 py-1 text-sm text-teal-800 dark:bg-teal-300/10 dark:text-teal-200"
                                key={id}
                                onClick={() =>
                                    update(
                                        'allowedToolIds',
                                        form.allowedToolIds.filter(
                                            (value) => value !== id,
                                        ),
                                    )
                                }
                                type="button"
                            >
                                {tool.title} ×
                            </button>
                        ) : null;
                    })}
                </div>
                <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                        checked={form.persistAfterSolved}
                        onChange={(event) =>
                            update('persistAfterSolved', event.target.checked)
                        }
                        type="checkbox"
                    />
                    Stay cleared for learner
                </label>
            </section>
            <ActivityTextField
                className="md:col-span-2"
                label="Prompt bubble"
                onChange={(value) => update('promptText', value)}
                textarea
                value={form.promptText}
            />
            <ActivityTextField
                className="md:col-span-2"
                label="Success bubble"
                onChange={(value) => update('successText', value)}
                textarea
                value={form.successText}
            />
            <ActivityTextField
                className="md:col-span-2"
                label="Cleared revisit bubble"
                onChange={(value) => update('revisitText', value)}
                textarea
                value={form.revisitText}
            />
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Obstacle scenes</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    {imageFields.map(([field, label]) => (
                        <ActivityTextField
                            key={field}
                            label={label}
                            onChange={(value) => update(field, value)}
                            value={String(form[field])}
                        />
                    ))}
                </div>
                {(
                    [
                        [
                            'backgroundMirrored',
                            'Mirror background horizontally',
                        ],
                        ['imageMirrored', 'Mirror obstacle image horizontally'],
                        [
                            'revisitBackgroundMirrored',
                            'Mirror cleared background horizontally',
                        ],
                        [
                            'revisitImageMirrored',
                            'Mirror cleared image horizontally',
                        ],
                    ] as Array<[keyof ObstacleForm, string]>
                ).map(([field, label]) => (
                    <label
                        className="flex items-center gap-3 text-sm font-medium"
                        key={field}
                    >
                        <input
                            checked={Boolean(form[field])}
                            onChange={(event) =>
                                update(field, event.target.checked)
                            }
                            type="checkbox"
                        />
                        {label}
                    </label>
                ))}
            </section>
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Position and bubble</h3>
                <div className="grid gap-3 md:grid-cols-3">
                    <ToolGrantNumberField
                        label="Obstacle x position"
                        max={100}
                        min={0}
                        onChange={(value) => update('x', value)}
                        suffix="%"
                        value={form.x}
                    />
                    <ToolGrantNumberField
                        label="Obstacle y position"
                        max={100}
                        min={0}
                        onChange={(value) => update('y', value)}
                        suffix="%"
                        value={form.y}
                    />
                    <ToolGrantNumberField
                        label="Obstacle width"
                        max={100}
                        min={1}
                        onChange={(value) => update('width', value)}
                        suffix="%"
                        value={form.width}
                    />
                    <ToolGrantNumberField
                        label="Dark opacity"
                        max={100}
                        min={0}
                        onChange={(value) => update('bubbleOpacityDark', value)}
                        suffix="%"
                        value={form.bubbleOpacityDark}
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
                    <ToolGrantNumberField
                        label="Typing speed"
                        max={250}
                        min={1}
                        onChange={(value) => update('typingSpeed', value)}
                        suffix="ms"
                        value={form.typingSpeed}
                    />
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
                    <label className="grid gap-2 text-sm font-medium">
                        Success animation
                        <select
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/40"
                            onChange={(event) =>
                                update('successAnimation', event.target.value)
                            }
                            value={form.successAnimation}
                        >
                            <option value="zoom">Zoom</option>
                            <option value="shake">Shake</option>
                            <option value="rotate">Rotate</option>
                            <option value="none">None</option>
                        </select>
                    </label>
                </div>
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

type ActivityFormSource = Pick<
    Activity,
    'config' | 'introduction' | 'slug' | 'title'
>;

function activityAuthorFormFromTemplate(
    type: SupportedActivityType,
    template: { snapshot: { [key: string]: unknown }; title: string },
    items: EditableItem[],
    tools: EditableTool[],
    sounds: EditableSound[],
): ActivityAuthorForm {
    const snapshot = template.snapshot;
    const config =
        snapshot.config && typeof snapshot.config === 'object' && !Array.isArray(snapshot.config)
            ? snapshot.config as Record<string, unknown>
            : {};
    const title = typeof snapshot.title === 'string' && snapshot.title.trim()
        ? snapshot.title
        : template.title;
    return {
        ...activityAuthorForm(
            type,
            {
                config,
                introduction:
                    typeof snapshot.introduction === 'string'
                        ? snapshot.introduction
                        : null,
                slug: '',
                title,
            },
            items,
            tools,
            sounds,
        ),
        slug: '',
        title: `${title} (copy)`,
    };
}

function activityAuthorForm(
    type: SupportedActivityType,
    activity?: ActivityFormSource,
    items: EditableItem[] = [],
    tools: EditableTool[] = [],
    sounds: EditableSound[] = [],
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
        itemObstacleBackgroundDark: configString(config, 'backgroundDark'),
        itemObstacleBackgroundLight: configString(config, 'backgroundLight'),
        itemObstacleBackgroundMirrored: configBoolean(
            config,
            'backgroundMirrored',
        ),
        itemObstacleConsumeOnEachEntry: configBoolean(
            config,
            'consumeOnEachEntry',
        ),
        itemObstacleLockMinutes: String(configNumber(config, 'lockMinutes', 0)),
        itemObstacleMetBackgroundDark: configString(
            config,
            'metBackgroundDark',
        ),
        itemObstacleMetBackgroundLight: configString(
            config,
            'metBackgroundLight',
        ),
        itemObstacleMetBackgroundMirrored: configBoolean(
            config,
            'metBackgroundMirrored',
        ),
        itemObstacleOverlayDark: configString(config, 'overlayDark'),
        itemObstacleOverlayLight: configString(config, 'overlayLight'),
        itemObstacleOverlayMirrored: configBoolean(config, 'overlayMirrored'),
        itemObstacleOverlayWidth: String(
            configNumber(config, 'overlayWidth', 30),
        ),
        itemObstacleOverlayX: String(configNumber(config, 'overlayX', 50)),
        itemObstacleOverlayY: String(configNumber(config, 'overlayY', 50)),
        itemObstacleSlots: itemObstacleSlots(config, items),
        itemObstacleSoundMetEnabled: itemObstacleSoundEnabled(config, 'met'),
        itemObstacleSoundMetId: itemObstacleSoundId(config, 'met', sounds),
        itemObstacleSoundNotMetEnabled: itemObstacleSoundEnabled(
            config,
            'notMet',
        ),
        itemObstacleSoundNotMetId: itemObstacleSoundId(
            config,
            'notMet',
            sounds,
        ),
        itemObstacleSoundTransitionEnabled: itemObstacleSoundEnabled(
            config,
            'transition',
        ),
        itemObstacleSoundTransitionId: itemObstacleSoundId(
            config,
            'transition',
            sounds,
        ),
        items: itemGrantItems(config, items),
        nextStep:
            configString(config, 'nextStep') ||
            'Choose a useful next step, then continue when you are ready.',
        note: configString(config, 'note'),
        obstacle: obstacleForm(config, tools),
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

function obstacleForm(
    config: Record<string, unknown>,
    tools: EditableTool[],
): ObstacleForm {
    const allowed = config.allowedToolIds;
    const allowedToolIds = Array.isArray(allowed)
        ? allowed.flatMap((slug) => {
              const tool =
                  typeof slug === 'string'
                      ? tools.find((candidate) => candidate.slug === slug)
                      : undefined;
              return tool ? [tool.id] : [];
          })
        : [];
    return {
        allowedToolIds,
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
        imageDark: configString(config, 'obstacleImageDark'),
        imageLight: configString(config, 'obstacleImageLight'),
        imageMirrored: configBoolean(config, 'obstacleImageMirrored'),
        persistAfterSolved: configBoolean(config, 'persistAfterSolved', true),
        promptText: configString(config, 'promptText'),
        revisitBackgroundDark: configString(config, 'revisitBackgroundDark'),
        revisitBackgroundLight: configString(config, 'revisitBackgroundLight'),
        revisitBackgroundMirrored: configBoolean(
            config,
            'revisitBackgroundMirrored',
        ),
        revisitImageDark: configString(config, 'revisitImageDark'),
        revisitImageLight: configString(config, 'revisitImageLight'),
        revisitImageMirrored: configBoolean(config, 'revisitImageMirrored'),
        revisitText: configString(config, 'revisitText'),
        successAnimation: configStringOr(config, 'successAnimation', 'zoom'),
        successText: configString(config, 'successText'),
        typingSpeed: String(configNumber(config, 'typingSpeed', 24)),
        width: String(configNumber(config, 'obstacleWidth', 28)),
        x: String(configNumber(config, 'obstacleX', 50)),
        y: String(configNumber(config, 'obstacleY', 50)),
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

function configBoolean(
    config: Record<string, unknown>,
    key: string,
    fallback = false,
): boolean {
    return typeof config[key] === 'boolean' ? config[key] : fallback;
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

function itemObstacleRequest(form: ActivityAuthorForm): {
    background_dark: string | null;
    background_light: string | null;
    background_mirrored: boolean;
    consume_on_each_entry: boolean;
    lock_minutes: number;
    met_background_dark: string | null;
    met_background_light: string | null;
    met_background_mirrored: boolean;
    overlay_dark: string | null;
    overlay_light: string | null;
    overlay_mirrored: boolean;
    overlay_width: number;
    overlay_x: number;
    overlay_y: number;
    slots: Array<{ item_id: string; width: number; x: number; y: number }>;
    sound_met_enabled: boolean;
    sound_met_id: string | null;
    sound_not_met_enabled: boolean;
    sound_not_met_id: string | null;
    sound_transition_enabled: boolean;
    sound_transition_id: string | null;
} | null {
    const lockMinutes = Number(form.itemObstacleLockMinutes);
    const overlayWidth = Number(form.itemObstacleOverlayWidth);
    const overlayX = Number(form.itemObstacleOverlayX);
    const overlayY = Number(form.itemObstacleOverlayY);
    const slots = form.itemObstacleSlots
        .filter((slot) => slot.itemId !== '')
        .map((slot) => ({
            item_id: slot.itemId,
            width: Number(slot.width),
            x: Number(slot.x),
            y: Number(slot.y),
        }));
    const soundIds = [
        [form.itemObstacleSoundNotMetEnabled, form.itemObstacleSoundNotMetId],
        [form.itemObstacleSoundMetEnabled, form.itemObstacleSoundMetId],
        [
            form.itemObstacleSoundTransitionEnabled,
            form.itemObstacleSoundTransitionId,
        ],
    ];
    if (
        !Number.isInteger(lockMinutes) ||
        lockMinutes < 0 ||
        lockMinutes > 10_080 ||
        !within(overlayX, 0, 100) ||
        !within(overlayY, 0, 100) ||
        !within(overlayWidth, 1, 100) ||
        slots.length > 10 ||
        slots.some(
            (slot) =>
                !within(slot.x, 0, 100) ||
                !within(slot.y, 0, 100) ||
                !within(slot.width, 1, 100),
        ) ||
        soundIds.some(([enabled, id]) => enabled && !id)
    ) {
        return null;
    }
    return {
        background_dark: optionalValue(form.itemObstacleBackgroundDark),
        background_light: optionalValue(form.itemObstacleBackgroundLight),
        background_mirrored: form.itemObstacleBackgroundMirrored,
        consume_on_each_entry: form.itemObstacleConsumeOnEachEntry,
        lock_minutes: lockMinutes,
        met_background_dark: optionalValue(form.itemObstacleMetBackgroundDark),
        met_background_light: optionalValue(
            form.itemObstacleMetBackgroundLight,
        ),
        met_background_mirrored: form.itemObstacleMetBackgroundMirrored,
        overlay_dark: optionalValue(form.itemObstacleOverlayDark),
        overlay_light: optionalValue(form.itemObstacleOverlayLight),
        overlay_mirrored: form.itemObstacleOverlayMirrored,
        overlay_width: overlayWidth,
        overlay_x: overlayX,
        overlay_y: overlayY,
        slots,
        sound_met_enabled: form.itemObstacleSoundMetEnabled,
        sound_met_id: form.itemObstacleSoundMetEnabled
            ? optionalValue(form.itemObstacleSoundMetId)
            : null,
        sound_not_met_enabled: form.itemObstacleSoundNotMetEnabled,
        sound_not_met_id: form.itemObstacleSoundNotMetEnabled
            ? optionalValue(form.itemObstacleSoundNotMetId)
            : null,
        sound_transition_enabled: form.itemObstacleSoundTransitionEnabled,
        sound_transition_id: form.itemObstacleSoundTransitionEnabled
            ? optionalValue(form.itemObstacleSoundTransitionId)
            : null,
    };
}

function obstacleRequest(form: ObstacleForm): {
    allowed_tool_ids: string[];
    background_dark: string | null;
    background_light: string | null;
    background_mirrored: boolean;
    bubble_border_color_dark: string;
    bubble_border_color_light: string;
    bubble_color_dark: string;
    bubble_color_light: string;
    bubble_opacity_dark: number;
    bubble_opacity_light: number;
    obstacle_image_dark: string | null;
    obstacle_image_light: string | null;
    obstacle_image_mirrored: boolean;
    persist_after_solved: boolean;
    prompt_text: string | null;
    obstacle_x: number;
    obstacle_y: number;
    obstacle_width: number;
    revisit_background_dark: string | null;
    revisit_background_light: string | null;
    revisit_background_mirrored: boolean;
    revisit_image_dark: string | null;
    revisit_image_light: string | null;
    revisit_image_mirrored: boolean;
    revisit_text: string | null;
    success_animation: 'none' | 'zoom' | 'shake' | 'rotate';
    success_text: string | null;
    typing_speed: number;
} | null {
    const values = [
        Number(form.bubbleOpacityDark),
        Number(form.bubbleOpacityLight),
        Number(form.x),
        Number(form.y),
        Number(form.width),
        Number(form.typingSpeed),
    ];
    if (
        !validHexColor(form.bubbleBorderColorDark) ||
        !validHexColor(form.bubbleBorderColorLight) ||
        !validHexColor(form.bubbleColorDark) ||
        !validHexColor(form.bubbleColorLight) ||
        !within(values[0], 0, 100) ||
        !within(values[1], 0, 100) ||
        !within(values[2], 0, 100) ||
        !within(values[3], 0, 100) ||
        !within(values[4], 1, 100) ||
        !within(values[5], 1, 250) ||
        form.allowedToolIds.length > 100 ||
        !['none', 'zoom', 'shake', 'rotate'].includes(form.successAnimation)
    )
        return null;
    return {
        allowed_tool_ids: form.allowedToolIds,
        background_dark: optionalValue(form.backgroundDark),
        background_light: optionalValue(form.backgroundLight),
        background_mirrored: form.backgroundMirrored,
        bubble_border_color_dark: form.bubbleBorderColorDark,
        bubble_border_color_light: form.bubbleBorderColorLight,
        bubble_color_dark: form.bubbleColorDark,
        bubble_color_light: form.bubbleColorLight,
        bubble_opacity_dark: values[0],
        bubble_opacity_light: values[1],
        obstacle_image_dark: optionalValue(form.imageDark),
        obstacle_image_light: optionalValue(form.imageLight),
        obstacle_image_mirrored: form.imageMirrored,
        persist_after_solved: form.persistAfterSolved,
        prompt_text: optionalValue(form.promptText),
        obstacle_x: values[2],
        obstacle_y: values[3],
        obstacle_width: values[4],
        revisit_background_dark: optionalValue(form.revisitBackgroundDark),
        revisit_background_light: optionalValue(form.revisitBackgroundLight),
        revisit_background_mirrored: form.revisitBackgroundMirrored,
        revisit_image_dark: optionalValue(form.revisitImageDark),
        revisit_image_light: optionalValue(form.revisitImageLight),
        revisit_image_mirrored: form.revisitImageMirrored,
        revisit_text: optionalValue(form.revisitText),
        success_animation: form.successAnimation as
            | 'none'
            | 'zoom'
            | 'shake'
            | 'rotate',
        success_text: optionalValue(form.successText),
        typing_speed: values[5],
    };
}

function defaultObstacleRequest(): NonNullable<
    ReturnType<typeof obstacleRequest>
> {
    return obstacleRequest({
        allowedToolIds: [],
        backgroundDark: '',
        backgroundLight: '',
        backgroundMirrored: false,
        bubbleBorderColorDark: '#2dd4bf',
        bubbleBorderColorLight: '#0891b2',
        bubbleColorDark: '#0f172a',
        bubbleColorLight: '#ffffff',
        bubbleOpacityDark: '92',
        bubbleOpacityLight: '94',
        imageDark: '',
        imageLight: '',
        imageMirrored: false,
        persistAfterSolved: true,
        promptText: '',
        revisitBackgroundDark: '',
        revisitBackgroundLight: '',
        revisitBackgroundMirrored: false,
        revisitImageDark: '',
        revisitImageLight: '',
        revisitImageMirrored: false,
        revisitText: '',
        successAnimation: 'zoom',
        successText: '',
        typingSpeed: '24',
        width: '28',
        x: '50',
        y: '50',
    })!;
}

function defaultItemObstacleRequest(): NonNullable<
    ReturnType<typeof itemObstacleRequest>
> {
    return {
        background_dark: null,
        background_light: null,
        background_mirrored: false,
        consume_on_each_entry: false,
        lock_minutes: 0,
        met_background_dark: null,
        met_background_light: null,
        met_background_mirrored: false,
        overlay_dark: null,
        overlay_light: null,
        overlay_mirrored: false,
        overlay_width: 30,
        overlay_x: 50,
        overlay_y: 50,
        slots: [],
        sound_met_enabled: false,
        sound_met_id: null,
        sound_not_met_enabled: false,
        sound_not_met_id: null,
        sound_transition_enabled: false,
        sound_transition_id: null,
    };
}

function itemObstacleSlots(
    config: Record<string, unknown>,
    items: EditableItem[],
): ActivityAuthorForm['itemObstacleSlots'] {
    const slots = config.slots;
    if (!Array.isArray(slots)) {
        return [{ itemId: '', width: '10', x: '50', y: '50' }];
    }
    const resolved = slots.flatMap((slot) => {
        if (!slot || typeof slot !== 'object') {
            return [];
        }
        const itemSlug = 'itemId' in slot ? slot.itemId : null;
        const item =
            typeof itemSlug === 'string'
                ? items.find((candidate) => candidate.slug === itemSlug)
                : null;
        if (!item) {
            return [];
        }
        return [
            {
                itemId: item.id,
                width: String('width' in slot ? slot.width : 10),
                x: String('x' in slot ? slot.x : 50),
                y: String('y' in slot ? slot.y : 50),
            },
        ];
    });
    return resolved;
}

function itemObstacleSoundEnabled(
    config: Record<string, unknown>,
    key: 'met' | 'notMet' | 'transition',
): boolean {
    const sounds = config.sounds;
    if (!sounds || typeof sounds !== 'object' || !(key in sounds)) {
        return false;
    }
    const sound = (sounds as Record<string, unknown>)[key];
    return Boolean(
        sound &&
        typeof sound === 'object' &&
        'enabled' in sound &&
        sound.enabled,
    );
}

function itemObstacleSoundId(
    config: Record<string, unknown>,
    key: 'met' | 'notMet' | 'transition',
    sounds: EditableSound[],
): string {
    const configuredSounds = config.sounds;
    if (
        !configuredSounds ||
        typeof configuredSounds !== 'object' ||
        !(key in configuredSounds)
    ) {
        return '';
    }
    const sound = (configuredSounds as Record<string, unknown>)[key];
    if (
        !sound ||
        typeof sound !== 'object' ||
        !('soundId' in sound) ||
        typeof sound.soundId !== 'string'
    ) {
        return '';
    }
    return sounds.some((candidate) => candidate.id === sound.soundId)
        ? sound.soundId
        : '';
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
        type === 'tool_grant' ||
        type === 'item_obstacle' ||
        type === 'obstacle'
    );
}

function SpecialGraphNode({
    data,
}: {
    data: { kind: 'start' | 'end'; label: string };
}) {
    return (
        <div className="rounded-full border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 shadow dark:border-teal-300 dark:bg-teal-300/10 dark:text-teal-100">
            {data.kind === 'end' ? (
                <Handle id="end" position={Position.Left} type="target" />
            ) : null}
            {data.label}
            {data.kind === 'start' ? (
                <Handle id="start" position={Position.Right} type="source" />
            ) : null}
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
