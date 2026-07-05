import { Head, Link, router } from '@inertiajs/react';
import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import {
    ArrowLeft,
    CircleStop,
    GitBranch,
    Pencil,
    Plus,
    Play,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
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

type Connector = {
    id: string;
    label: string;
};

type ActivityTypeDefinition = {
    description: string;
    key: string;
    label: string;
    portalModes?: Array<{ key: string; label: string }>;
};

type ActivitySummary = {
    config: Record<string, string | number | boolean | null>;
    connectors: {
        inputs: Connector[];
        outputs: Connector[];
    };
    id: number;
    introduction: string | null;
    position: {
        x: number | null;
        y: number | null;
    };
    slug: string;
    title: string;
    type: string;
};

type ActivityTransitionSummary = {
    fromActivityId: number;
    fromConnector: string;
    id: number;
    label: string | null;
    toActivityId: number | null;
    toConnector: string;
    trigger: string;
};

type ActivityGraphPayload = {
    activities: ActivitySummary[];
    activityTypes: ActivityTypeDefinition[];
    map: {
        id: number;
        slug: string;
        title: string;
    };
    node: {
        description: string | null;
        id: number;
        slug: string;
        startActivityId: number | null;
        title: string;
    };
    transitions: ActivityTransitionSummary[];
    world: {
        id: number;
        slug: string;
        title: string;
    };
};

type ActivityNodeData = {
    activity: ActivitySummary;
    onDelete: (activity: ActivitySummary) => void;
    onEdit: (activity: ActivitySummary) => void;
};

type SpecialNodeData = {
    description: string;
    kind: 'start' | 'end';
    title: string;
};

type ActivityGraphNode =
    | Node<ActivityNodeData, 'activity'>
    | Node<SpecialNodeData, 'special'>;

type ActivityGraphEdge = Edge<ActivityTransitionSummary | { start: true }>;

type CreateActivityForm = {
    introduction: string;
    portal_mode: 'input' | 'output';
    slug: string;
    title: string;
    type: string;
};

type ActivityForm = CreateActivityForm;

const nodeTypes = {
    activity: ActivityGraphNodeCard,
    special: SpecialGraphNode,
};

const edgeStyle: CSSProperties = {
    stroke: '#0e7490',
    strokeWidth: 2,
};

export default function EditNodeActivities({
    activityGraph,
}: {
    activityGraph: ActivityGraphPayload;
}) {
    const { resolvedAppearance } = useAppearance();
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const firstType = activityGraph.activityTypes[0]?.key ?? 'placeholder';
    const [form, setForm] = useState<ActivityForm>(() =>
        emptyCreateForm(firstType),
    );
    const [editOpen, setEditOpen] = useState(false);
    const [editingActivity, setEditingActivity] =
        useState<ActivitySummary | null>(null);
    const [editForm, setEditForm] = useState<ActivityForm>(() =>
        emptyCreateForm(firstType),
    );
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [updating, setUpdating] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<ActivitySummary | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);
    const [selectedActivity, setSelectedActivity] =
        useState<ActivitySummary | null>(null);

    const openEdit = useCallback(
        (activity: ActivitySummary) => {
            setEditingActivity(activity);
            setEditForm(activityFormFromActivity(activity, firstType));
            setEditErrors({});
            setEditOpen(true);
        },
        [firstType],
    );

    const requestDelete = useCallback((activity: ActivitySummary) => {
        setPendingDelete(activity);
    }, []);

    const initialNodes = useMemo(
        () => buildGraphNodes(activityGraph, openEdit, requestDelete),
        [activityGraph, openEdit, requestDelete],
    );
    const initialEdges = useMemo(
        () => buildGraphEdges(activityGraph),
        [activityGraph],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
    useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key !== 'Delete' ||
                !selectedActivity ||
                createOpen ||
                editOpen ||
                pendingDelete
            ) {
                return;
            }

            if (isEditableTarget(event.target)) {
                return;
            }

            event.preventDefault();
            setPendingDelete(selectedActivity);
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [createOpen, editOpen, pendingDelete, selectedActivity]);

    const selectedType = activityGraph.activityTypes.find(
        (type) => type.key === form.type,
    );
    const selectedEditType = activityGraph.activityTypes.find(
        (type) => type.key === editForm.type,
    );

    const openCreate = () => {
        setForm(emptyCreateForm(firstType));
        setErrors({});
        setCreateOpen(true);
    };

    const createActivity = () => {
        setCreating(true);

        router.post(
            `/settings/worlds/nodes/${activityGraph.node.id}/activities`,
            form,
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => setCreateOpen(false),
                onFinish: () => setCreating(false),
            },
        );
    };

    const updateActivity = () => {
        if (!editingActivity) {
            return;
        }

        setUpdating(true);

        router.patch(
            `/settings/worlds/activities/${editingActivity.id}`,
            editForm,
            {
                preserveScroll: true,
                onError: (nextErrors) => setEditErrors(nextErrors),
                onSuccess: () => {
                    setEditOpen(false);
                    setEditingActivity(null);
                },
                onFinish: () => setUpdating(false),
            },
        );
    };

    const deleteActivity = () => {
        if (!pendingDelete) {
            return;
        }

        setDeleting(true);

        router.delete(`/settings/worlds/activities/${pendingDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setPendingDelete(null);
                setSelectedActivity(null);
            },
            onFinish: () => setDeleting(false),
        });
    };

    const connectActivities = (connection: Connection) => {
        if (!connection.source || !connection.target) {
            return;
        }

        if (connection.source === 'start') {
            if (connection.target !== 'end') {
                router.patch(
                    `/settings/worlds/nodes/${activityGraph.node.id}/activities/start`,
                    {
                        activity_id: Number(connection.target),
                    },
                    { preserveScroll: true },
                );
            }

            return;
        }

        router.post(
            `/settings/worlds/nodes/${activityGraph.node.id}/activity-transitions`,
            {
                from_activity_id: Number(connection.source),
                to_activity_id:
                    connection.target === 'end'
                        ? null
                        : Number(connection.target),
                from_connector: connection.sourceHandle ?? 'completed',
                to_connector:
                    connection.target === 'end'
                        ? 'end'
                        : (connection.targetHandle ?? 'in'),
            },
            { preserveScroll: true },
        );
    };

    const removeEdge = (edge: ActivityGraphEdge) => {
        if (edge.id.startsWith('start:')) {
            router.delete(
                `/settings/worlds/nodes/${activityGraph.node.id}/activities/start`,
                { preserveScroll: true },
            );

            return;
        }

        const transitionId =
            edge.data && 'id' in edge.data ? edge.data.id : null;

        if (transitionId) {
            router.delete(
                `/settings/worlds/activity-transitions/${transitionId}`,
                { preserveScroll: true },
            );
        }
    };

    const savePosition = (node: ActivityGraphNode) => {
        if (node.type !== 'activity') {
            return;
        }

        router.patch(
            `/settings/worlds/activities/${node.data.activity.id}`,
            {
                graph_position_x: Math.round(node.position.x),
                graph_position_y: Math.round(node.position.y),
            },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={`Activities for ${activityGraph.node.title}`} />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="flex h-full flex-col px-4 pt-4 pb-24">
                    <header className="mb-3 flex shrink-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                            <Button
                                asChild
                                className="mb-2"
                                size="sm"
                                variant="ghost"
                            >
                                <Link
                                    href={`/settings/worlds/maps/${activityGraph.map.id}/edit`}
                                >
                                    <ArrowLeft className="size-4" />
                                    Edit map
                                </Link>
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                {activityGraph.map.title}
                            </p>
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                {activityGraph.node.title} activities
                            </h1>
                        </div>
                        <Button onClick={openCreate} type="button">
                            <Plus className="size-4" />
                            Add activity
                        </Button>
                    </header>

                    <section className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                        {activityGraph.activities.length === 0 ? (
                            <div className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center">
                                <div className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50/90 px-5 py-4 text-center shadow-lg backdrop-blur dark:border-teal-200/30 dark:bg-teal-300/10">
                                    <GitBranch className="mx-auto mb-2 size-7 text-cyan-700 dark:text-teal-200" />
                                    <p className="font-semibold">
                                        No activities yet
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        Add one, then connect Start to its
                                        input.
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        <ReactFlow
                            colorMode={resolvedAppearance}
                            edges={edges}
                            fitView
                            fitViewOptions={{ padding: 0.28 }}
                            nodeTypes={nodeTypes}
                            nodes={nodes}
                            onConnect={connectActivities}
                            onEdgeClick={(_, edge) =>
                                removeEdge(edge as ActivityGraphEdge)
                            }
                            onEdgesChange={onEdgesChange}
                            onNodeDragStop={(_, node) =>
                                savePosition(node as ActivityGraphNode)
                            }
                            onNodeClick={(_, node) => {
                                setSelectedActivity(
                                    node.type === 'activity'
                                        ? (node.data as ActivityNodeData)
                                              .activity
                                        : null,
                                );
                            }}
                            onNodesChange={onNodesChange}
                            onPaneClick={() => setSelectedActivity(null)}
                        >
                            <Background gap={24} />
                            <Controls />
                            <MiniMap pannable zoomable />
                        </ReactFlow>
                    </section>
                </div>
            </main>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add activity</DialogTitle>
                        <DialogDescription>
                            Create a generic activity node. Specialized editing
                            for dialogue stages, questions and portal targets
                            can build on this node later.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            createActivity();
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="activity-title">Title</Label>
                            <Input
                                id="activity-title"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                value={form.title}
                            />
                            <InputError message={errors.title} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="activity-type">Type</Label>
                            <Select
                                onValueChange={(value) =>
                                    setForm((current) => ({
                                        ...current,
                                        type: value,
                                    }))
                                }
                                value={form.type}
                            >
                                <SelectTrigger
                                    className="w-full"
                                    id="activity-type"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {activityGraph.activityTypes.map((type) => (
                                        <SelectItem
                                            key={type.key}
                                            value={type.key}
                                        >
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedType ? (
                                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    {selectedType.description}
                                </p>
                            ) : null}
                            <InputError message={errors.type} />
                        </div>

                        {form.type === 'portal' ? (
                            <div className="grid gap-2">
                                <Label htmlFor="portal-mode">
                                    Portal direction
                                </Label>
                                <Select
                                    onValueChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            portal_mode: value as
                                                | 'input'
                                                | 'output',
                                        }))
                                    }
                                    value={form.portal_mode}
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        id="portal-mode"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="input">
                                            Input portal
                                        </SelectItem>
                                        <SelectItem value="output">
                                            Output portal
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.portal_mode} />
                            </div>
                        ) : null}

                        <div className="grid gap-2">
                            <Label htmlFor="activity-slug">Slug</Label>
                            <Input
                                id="activity-slug"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        slug: event.target.value,
                                    }))
                                }
                                placeholder="Generated from the title if empty"
                                value={form.slug}
                            />
                            <InputError message={errors.slug} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="activity-introduction">
                                Introduction
                            </Label>
                            <textarea
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                                id="activity-introduction"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        introduction: event.target.value,
                                    }))
                                }
                                value={form.introduction}
                            />
                            <InputError message={errors.introduction} />
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

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit activity</DialogTitle>
                        <DialogDescription>
                            Update the generic activity fields. Detailed content
                            editors for questions, dialogue and portal targets
                            can extend this later.
                        </DialogDescription>
                    </DialogHeader>

                    <ActivityFormFields
                        activityTypes={activityGraph.activityTypes}
                        errors={editErrors}
                        form={editForm}
                        onChange={setEditForm}
                        selectedType={selectedEditType}
                    />

                    <DialogFooter>
                        <Button
                            disabled={updating}
                            onClick={() => setEditOpen(false)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={updating}
                            onClick={updateActivity}
                            type="button"
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(pendingDelete)}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDelete(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete activity?</DialogTitle>
                        <DialogDescription>
                            {pendingDelete
                                ? `This removes "${pendingDelete.title}" and its outgoing connections. This cannot be undone.`
                                : 'This activity will be removed.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            disabled={deleting}
                            onClick={() => setPendingDelete(null)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                            disabled={deleting}
                            onClick={deleteActivity}
                            type="button"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ActivityGraphNodeCard({
    data,
    selected,
}: {
    data: ActivityNodeData;
    selected: boolean;
}) {
    const activity = data.activity;

    return (
        <div
            className={cn(
                'relative w-64 rounded-xl border bg-slate-50 p-4 shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-cyan-600 ring-2 ring-cyan-600/20 dark:border-teal-200 dark:ring-teal-200/20',
            )}
        >
            <ConnectorHandles
                connectors={activity.connectors.inputs}
                position={Position.Left}
                type="target"
            />
            <ConnectorHandles
                connectors={activity.connectors.outputs}
                position={Position.Right}
                type="source"
            />

            <p className="text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200/70">
                {activity.type}
            </p>
            <h2 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {activity.title}
            </h2>
            {activity.introduction ? (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {activity.introduction}
                </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1">
                {activity.connectors.outputs.map((connector) => (
                    <span
                        className="rounded-md bg-cyan-100 px-2 py-1 text-[11px] font-medium text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200"
                        key={connector.id}
                    >
                        {connector.label}
                    </span>
                ))}
            </div>
            <div className="nodrag nopan mt-4 flex items-center gap-2">
                <Button
                    className="h-8 px-3 text-xs"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onEdit(activity);
                    }}
                    type="button"
                    variant="outline"
                >
                    <Pencil className="size-3.5" />
                    Edit
                </Button>
                <Button
                    aria-label={`Delete ${activity.title}`}
                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-300"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onDelete(activity);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function SpecialGraphNode({
    data,
}: {
    data: SpecialNodeData;
    selected: boolean;
}) {
    return (
        <div className="relative grid w-40 place-items-center rounded-xl border border-slate-200 bg-white p-4 text-center shadow-lg dark:border-white/10 dark:bg-slate-950">
            {data.kind === 'start' ? (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                    id="start"
                    position={Position.Right}
                    type="source"
                />
            ) : (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                    id="end"
                    position={Position.Left}
                    type="target"
                />
            )}
            <span className="mb-2 grid size-9 place-items-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                {data.kind === 'start' ? (
                    <Play className="size-4" />
                ) : (
                    <CircleStop className="size-4" />
                )}
            </span>
            <p className="text-sm font-semibold">{data.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {data.description}
            </p>
        </div>
    );
}

function ConnectorHandles({
    connectors,
    position,
    type,
}: {
    connectors: Connector[];
    position: Position;
    type: 'source' | 'target';
}) {
    return (
        <>
            {connectors.map((connector, index) => (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
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

function buildGraphNodes(
    payload: ActivityGraphPayload,
    onEdit: (activity: ActivitySummary) => void,
    onDelete: (activity: ActivitySummary) => void,
): ActivityGraphNode[] {
    const activities = payload.activities.map((activity, index) => ({
        id: activity.id.toString(),
        type: 'activity' as const,
        data: { activity, onDelete, onEdit },
        position:
            activity.position.x !== null
                ? {
                      x: activity.position.x,
                      y: activity.position.y ?? 0,
                  }
                : {
                      x: 80 + index * 300,
                      y: (index % 2) * 180,
                  },
    }));

    const endX = Math.max(520, activities.length * 300 + 160);

    return [
        {
            id: 'start',
            type: 'special',
            data: {
                description: 'Connect this to the first activity.',
                kind: 'start',
                title: 'Start',
            },
            position: { x: -220, y: 40 },
        },
        ...activities,
        {
            id: 'end',
            type: 'special',
            data: {
                description: 'Activities connect here when a path finishes.',
                kind: 'end',
                title: 'End',
            },
            position: { x: endX, y: 40 },
        },
    ];
}

function buildGraphEdges(payload: ActivityGraphPayload): ActivityGraphEdge[] {
    const edges: ActivityGraphEdge[] = [];

    if (payload.node.startActivityId) {
        edges.push({
            id: `start:${payload.node.startActivityId}`,
            source: 'start',
            sourceHandle: 'start',
            target: payload.node.startActivityId.toString(),
            targetHandle: 'in',
            label: 'Start',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: edgeStyle,
            data: { start: true },
        });
    }

    payload.transitions.forEach((transition) => {
        edges.push({
            id: `transition:${transition.id}`,
            source: transition.fromActivityId.toString(),
            sourceHandle: transition.fromConnector,
            target: transition.toActivityId?.toString() ?? 'end',
            targetHandle: transition.toActivityId
                ? transition.toConnector
                : 'end',
            label: transition.label ?? transition.trigger,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: edgeStyle,
            data: transition,
        });
    });

    return edges;
}

function emptyCreateForm(type: string): CreateActivityForm {
    return {
        introduction: '',
        portal_mode: 'output',
        slug: '',
        title: '',
        type,
    };
}

function activityFormFromActivity(
    activity: ActivitySummary,
    fallbackType: string,
): ActivityForm {
    const portalMode = activity.config.portalMode;

    return {
        introduction: activity.introduction ?? '',
        portal_mode: portalMode === 'input' ? 'input' : 'output',
        slug: activity.slug,
        title: activity.title,
        type: activity.type || fallbackType,
    };
}

function ActivityFormFields({
    activityTypes,
    errors,
    form,
    onChange,
    selectedType,
}: {
    activityTypes: ActivityTypeDefinition[];
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    selectedType: ActivityTypeDefinition | undefined;
}) {
    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="activity-title">Title</Label>
                <Input
                    id="activity-title"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            title: event.target.value,
                        }))
                    }
                    value={form.title}
                />
                <InputError message={errors.title} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="activity-type">Type</Label>
                <Select
                    onValueChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            type: value,
                        }))
                    }
                    value={form.type}
                >
                    <SelectTrigger className="w-full" id="activity-type">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {activityTypes.map((type) => (
                            <SelectItem key={type.key} value={type.key}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedType ? (
                    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {selectedType.description}
                    </p>
                ) : null}
                <InputError message={errors.type} />
            </div>

            {form.type === 'portal' ? (
                <div className="grid gap-2">
                    <Label htmlFor="portal-mode">Portal direction</Label>
                    <Select
                        onValueChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                portal_mode: value as 'input' | 'output',
                            }))
                        }
                        value={form.portal_mode}
                    >
                        <SelectTrigger className="w-full" id="portal-mode">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="input">Input portal</SelectItem>
                            <SelectItem value="output">
                                Output portal
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.portal_mode} />
                </div>
            ) : null}

            <div className="grid gap-2">
                <Label htmlFor="activity-slug">Slug</Label>
                <Input
                    id="activity-slug"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            slug: event.target.value,
                        }))
                    }
                    placeholder="Generated from the title if empty"
                    value={form.slug}
                />
                <InputError message={errors.slug} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="activity-introduction">Introduction</Label>
                <textarea
                    className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                    id="activity-introduction"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            introduction: event.target.value,
                        }))
                    }
                    value={form.introduction}
                />
                <InputError message={errors.introduction} />
            </div>
        </div>
    );
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]'),
    );
}
