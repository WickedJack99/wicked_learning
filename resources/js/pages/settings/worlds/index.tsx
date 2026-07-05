import { Head, Link, router } from '@inertiajs/react';
import {
    Background,
    Controls,
    MarkerType,
    MiniMap,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import {
    ArrowLeft,
    ArrowRight,
    GitBranch,
    Link2,
    Map as MapIcon,
    Pencil,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

type WorldSummary = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
};

type MapSummary = {
    description: string | null;
    id: number;
    nodeCount: number;
    slug: string;
    title: string;
};

type NodeSummary = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
};

type PortalLinkSummary = {
    description: string | null;
    id: number;
    label: string | null;
    sourceMapId: number;
    sourceNode: NodeSummary;
    targetMapId: number;
    targetNode: NodeSummary;
};

type PortalCandidate = NodeSummary & {
    mapId: number;
    mapTitle: string;
};

type WorldGraph = {
    maps: MapSummary[];
    portalCandidates: PortalCandidate[];
    portalLinks: PortalLinkSummary[];
    world: WorldSummary;
};

type CreateMapForm = {
    description: string;
    slug: string;
    title: string;
};

type CreatePortalForm = {
    description: string;
    label: string;
    source_learning_node_id: string;
    target_learning_node_id: string;
};

type MapNodeData = {
    map: MapSummary;
};

type MapGraphNode = Node<MapNodeData, 'mapNode'>;
type PortalEdge = Edge<PortalLinkSummary>;

export default function AdminWorldIndex({
    worldGraph,
}: {
    worldGraph: WorldGraph;
}) {
    const { resolvedAppearance } = useAppearance();
    const initialNodes = useMemo(
        () => buildGraphNodes(worldGraph.maps),
        [worldGraph.maps],
    );
    const initialEdges = useMemo(
        () => buildGraphEdges(worldGraph.portalLinks),
        [worldGraph.portalLinks],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedMap, setSelectedMap] = useState<MapSummary | null>(null);
    const [selectedPortal, setSelectedPortal] =
        useState<PortalLinkSummary | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createErrors, setCreateErrors] = useState<Record<string, string>>(
        {},
    );
    const [createForm, setCreateForm] = useState<CreateMapForm>({
        description: '',
        slug: '',
        title: '',
    });
    const [portalOpen, setPortalOpen] = useState(false);
    const [linking, setLinking] = useState(false);
    const [portalErrors, setPortalErrors] = useState<Record<string, string>>(
        {},
    );
    const [portalForm, setPortalForm] = useState<CreatePortalForm>({
        description: '',
        label: '',
        source_learning_node_id: '',
        target_learning_node_id: '',
    });

    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
    useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

    const highlightEdge = (edgeId: string | null) => {
        setEdges((currentEdges) =>
            currentEdges.map((edge) => ({
                ...edge,
                animated: edge.id === edgeId,
                style: edgeStyle(edge.id === edgeId),
            })),
        );
    };

    const resetCreateForm = () => {
        setCreateErrors({});
        setCreateForm({
            description: '',
            slug: '',
            title: '',
        });
    };

    const createMap = () => {
        setCreating(true);

        router.post('/settings/worlds/maps', createForm, {
            preserveScroll: true,
            onError: (errors) => setCreateErrors(errors),
            onSuccess: () => {
                setCreateOpen(false);
                resetCreateForm();
            },
            onFinish: () => setCreating(false),
        });
    };

    const resetPortalForm = () => {
        setPortalErrors({});
        setPortalForm({
            description: '',
            label: '',
            source_learning_node_id: '',
            target_learning_node_id: '',
        });
    };

    const createPortalLink = () => {
        setLinking(true);

        router.post('/settings/worlds/portal-links', portalForm, {
            preserveScroll: true,
            onError: (errors) => setPortalErrors(errors),
            onSuccess: () => {
                setPortalOpen(false);
                resetPortalForm();
            },
            onFinish: () => setLinking(false),
        });
    };

    const deletePortalLink = (portal: PortalLinkSummary) => {
        router.delete(`/settings/worlds/portal-links/${portal.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedPortal(null);
            },
        });
    };

    return (
        <>
            <Head title="Edit World" />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="flex h-full flex-col px-4 pt-4 pb-24">
                    <header className="mb-3 flex shrink-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="mb-2 flex items-center gap-2">
                                <Button asChild size="sm" variant="ghost">
                                    <Link href="/settings">
                                        <ArrowLeft className="size-4" />
                                        Settings
                                    </Link>
                                </Button>
                            </div>
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                World editing
                            </p>
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                {worldGraph.world.title}
                            </h1>
                        </div>
                        <p className="hidden max-w-2xl text-sm leading-6 text-slate-600 md:block dark:text-slate-300">
                            {worldGraph.world.description}
                        </p>
                    </header>

                    <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="relative min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                            <ReactFlow
                                colorMode={resolvedAppearance}
                                edges={edges}
                                fitView
                                fitViewOptions={{ padding: 0.24 }}
                                nodeTypes={{ mapNode: MapGraphNode }}
                                nodes={nodes}
                                onEdgeClick={(_, edge) => {
                                    setSelectedPortal(edge.data ?? null);
                                    setSelectedMap(null);
                                }}
                                onEdgeMouseEnter={(_, edge) =>
                                    highlightEdge(edge.id)
                                }
                                onEdgeMouseLeave={() => highlightEdge(null)}
                                onEdgesChange={onEdgesChange}
                                onNodeClick={(_, node) => {
                                    setSelectedMap(node.data.map);
                                    setSelectedPortal(null);
                                }}
                                onNodesChange={onNodesChange}
                            >
                                <Background gap={24} />
                                <Controls />
                                <MiniMap pannable zoomable />
                            </ReactFlow>
                        </div>

                        <aside className="flex min-h-0 flex-col gap-4">
                            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#111820]">
                                {selectedPortal ? (
                                    <PortalDetails
                                        onDelete={deletePortalLink}
                                        portal={selectedPortal}
                                    />
                                ) : selectedMap ? (
                                    <MapDetails map={selectedMap} />
                                ) : (
                                    <EmptyDetails />
                                )}
                            </div>

                            <div className="shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 p-5 shadow-lg dark:border-teal-200/20 dark:bg-teal-300/10">
                                <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                    Prepare
                                </p>
                                <h2 className="mt-2 text-lg font-semibold">
                                    New world map
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    Create a standalone map now and connect it
                                    with portal tiles later.
                                </p>
                                <Button
                                    className="mt-4 w-full"
                                    onClick={() => {
                                        resetCreateForm();
                                        setCreateOpen(true);
                                    }}
                                    type="button"
                                >
                                    <MapIcon className="size-4" />
                                    Create world node
                                </Button>
                            </div>

                            <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-[#111820]">
                                <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                    Travel
                                </p>
                                <h2 className="mt-2 text-lg font-semibold">
                                    Portal link
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    Connect two tiles so a portal activity can
                                    move learners between maps or regions.
                                </p>
                                <Button
                                    className="mt-4 w-full"
                                    disabled={
                                        worldGraph.portalCandidates.length < 2
                                    }
                                    onClick={() => {
                                        resetPortalForm();
                                        setPortalOpen(true);
                                    }}
                                    type="button"
                                    variant="outline"
                                >
                                    <Link2 className="size-4" />
                                    Create portal link
                                </Button>
                            </div>
                        </aside>
                    </section>
                </div>
            </main>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Create world node</DialogTitle>
                        <DialogDescription>
                            Add a new map to this world graph. It can stay
                            unlinked until you create portal tiles for it.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            createMap();
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="map-title">Title</Label>
                            <Input
                                id="map-title"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                placeholder="Astronomy Garden"
                                value={createForm.title}
                            />
                            <InputError message={createErrors.title} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="map-slug">Slug</Label>
                            <Input
                                id="map-slug"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        slug: event.target.value,
                                    }))
                                }
                                placeholder="Generated from the title if empty"
                                value={createForm.slug}
                            />
                            <InputError message={createErrors.slug} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="map-description">Description</Label>
                            <textarea
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                                id="map-description"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                placeholder="What should admins know while preparing this map?"
                                value={createForm.description}
                            />
                            <InputError message={createErrors.description} />
                        </div>

                        <DialogFooter>
                            <Button
                                disabled={creating}
                                onClick={() => setCreateOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button disabled={creating} type="submit">
                                Create
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={portalOpen} onOpenChange={setPortalOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Create portal link</DialogTitle>
                        <DialogDescription>
                            Pick the portal tile where travel starts and the
                            sibling tile learners arrive at.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            createPortalLink();
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="portal-source">From tile</Label>
                            <Select
                                onValueChange={(value) =>
                                    setPortalForm((current) => ({
                                        ...current,
                                        source_learning_node_id: value,
                                    }))
                                }
                                value={portalForm.source_learning_node_id}
                            >
                                <SelectTrigger
                                    className="w-full"
                                    id="portal-source"
                                >
                                    <SelectValue placeholder="Choose source tile" />
                                </SelectTrigger>
                                <SelectContent>
                                    {worldGraph.portalCandidates.map(
                                        (candidate) => (
                                            <SelectItem
                                                key={candidate.id}
                                                value={candidate.id.toString()}
                                            >
                                                {candidate.mapTitle} /{' '}
                                                {candidate.title}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                            <InputError
                                message={portalErrors.source_learning_node_id}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="portal-target">To tile</Label>
                            <Select
                                onValueChange={(value) =>
                                    setPortalForm((current) => ({
                                        ...current,
                                        target_learning_node_id: value,
                                    }))
                                }
                                value={portalForm.target_learning_node_id}
                            >
                                <SelectTrigger
                                    className="w-full"
                                    id="portal-target"
                                >
                                    <SelectValue placeholder="Choose target tile" />
                                </SelectTrigger>
                                <SelectContent>
                                    {worldGraph.portalCandidates.map(
                                        (candidate) => (
                                            <SelectItem
                                                disabled={
                                                    portalForm.source_learning_node_id ===
                                                    candidate.id.toString()
                                                }
                                                key={candidate.id}
                                                value={candidate.id.toString()}
                                            >
                                                {candidate.mapTitle} /{' '}
                                                {candidate.title}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                            <InputError
                                message={portalErrors.target_learning_node_id}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="portal-label">Label</Label>
                            <Input
                                id="portal-label"
                                onChange={(event) =>
                                    setPortalForm((current) => ({
                                        ...current,
                                        label: event.target.value,
                                    }))
                                }
                                placeholder="Generated from both tiles if empty"
                                value={portalForm.label}
                            />
                            <InputError message={portalErrors.label} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="portal-description">
                                Description
                            </Label>
                            <textarea
                                className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                                id="portal-description"
                                onChange={(event) =>
                                    setPortalForm((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                placeholder="Optional admin note about this route."
                                value={portalForm.description}
                            />
                            <InputError message={portalErrors.description} />
                        </div>

                        <DialogFooter>
                            <Button
                                disabled={linking}
                                onClick={() => setPortalOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button disabled={linking} type="submit">
                                Create link
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function MapGraphNode({
    data,
    selected,
}: {
    data: MapNodeData;
    selected: boolean;
}) {
    const map = data.map;

    return (
        <div
            className={cn(
                'w-56 rounded-xl border bg-slate-50 p-4 text-left shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-cyan-600 ring-2 ring-cyan-600/20 dark:border-teal-200 dark:ring-teal-200/20',
            )}
        >
            <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                <MapIcon className="size-5" />
            </span>
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                {map.title}
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {map.nodeCount} tile{map.nodeCount === 1 ? '' : 's'}
            </span>
            <span className="mt-3 block rounded-md bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Tags: not assigned yet
            </span>
        </div>
    );
}

function MapDetails({ map }: { map: MapSummary }) {
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                Map
            </p>
            <h2 className="mt-2 text-xl font-semibold">{map.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {map.description ?? 'No description yet.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
                <Detail label="Slug" value={map.slug} />
                <Detail label="Tiles" value={map.nodeCount.toString()} />
            </dl>
            <Button asChild className="mt-6 w-full">
                <Link href={`/settings/worlds/maps/${map.id}/edit`}>
                    <Pencil className="size-4" />
                    Edit World
                </Link>
            </Button>
        </div>
    );
}

function PortalDetails({
    onDelete,
    portal,
}: {
    onDelete: (portal: PortalLinkSummary) => void;
    portal: PortalLinkSummary;
}) {
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                Portal link
            </p>
            <h2 className="mt-2 text-xl font-semibold">
                {portal.label ?? 'Unnamed portal'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {portal.description ?? 'No portal description yet.'}
            </p>
            <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <PortalEndpoint direction="From" node={portal.sourceNode} />
                <ArrowRight className="mx-auto size-4 text-slate-400" />
                <PortalEndpoint direction="To" node={portal.targetNode} />
            </div>
            <Button
                className="mt-5 w-full text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                onClick={() => onDelete(portal)}
                type="button"
                variant="outline"
            >
                <Trash2 className="size-4" />
                Delete portal link
            </Button>
        </div>
    );
}

function PortalEndpoint({
    direction,
    node,
}: {
    direction: string;
    node: NodeSummary;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase dark:text-slate-400">
                {direction}
            </p>
            <p className="mt-1 text-sm font-semibold">{node.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                {node.description ?? node.slug}
            </p>
        </div>
    );
}

function EmptyDetails() {
    return (
        <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
            <GitBranch className="mb-4 size-10 text-cyan-700 dark:text-teal-200" />
            <h2 className="text-lg font-semibold">Select a map or portal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click a world-map node to edit it, or click a portal edge to see
                the linked portal tiles.
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
            <dd className="mt-1 text-slate-950 dark:text-white">{value}</dd>
        </div>
    );
}

function buildGraphNodes(maps: MapSummary[]): MapGraphNode[] {
    if (maps.length === 0) {
        return [];
    }

    const radius = Math.max(220, maps.length * 86);

    return maps.map((map, index) => {
        const angle = (Math.PI * 2 * index) / maps.length - Math.PI / 2;

        return {
            id: map.id.toString(),
            type: 'mapNode',
            data: { map },
            position: {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            },
        };
    });
}

function buildGraphEdges(portalLinks: PortalLinkSummary[]): PortalEdge[] {
    return portalLinks.map((portal) => ({
        id: portal.id.toString(),
        source: portal.sourceMapId.toString(),
        target: portal.targetMapId.toString(),
        label: portal.label ?? 'Portal',
        data: portal,
        markerEnd: {
            type: MarkerType.ArrowClosed,
        },
        style: edgeStyle(false),
    }));
}

function edgeStyle(active: boolean): CSSProperties {
    return {
        stroke: active ? '#0e7490' : 'rgba(14, 116, 144, 0.42)',
        strokeWidth: active ? 4 : 2,
    };
}
