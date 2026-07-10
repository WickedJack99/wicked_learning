import { Head, Link, router } from '@inertiajs/react';
import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Connection } from '@xyflow/react';
import { ArrowLeft, GitBranch, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { SettingsAccordionSection } from '@/components/settings-accordion-section';
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
import { useAppearance } from '@/hooks/use-appearance';
import { ConfigImageInput } from './activity-config-fields';
import { ActivityFormFields } from './activity-form-fields';
import { activityFormPayload } from './activity-form-payload';
import {
    activityFormFromActivity,
    emptyCreateForm,
} from './activity-form-state';
import {
    activityNodeTypes,
    buildGraphEdges,
    buildGraphNodes,
    routeActivityTitle,
} from './activity-graph-elements';
import type {
    ActivityForm,
    ActivityGraphEdge,
    ActivityGraphNode,
    ActivityGraphPayload,
    ActivityNodeData,
    ActivityStartRoute,
    ActivitySummary,
    EditableTool,
    StartRouteForm,
} from './edit-node-activity-types';

export default function EditNodeActivities({
    activityGraph,
    tools,
}: {
    activityGraph: ActivityGraphPayload;
    tools: EditableTool[];
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
    const [selectedStartRoute, setSelectedStartRoute] =
        useState<ActivityStartRoute | null>(null);
    const [startRouteForm, setStartRouteForm] = useState<StartRouteForm>({
        button_border_color_dark: '',
        button_border_color_light: '',
        button_color_dark: '',
        button_color_light: '',
        image_dark: '',
        image_light: '',
    });
    const [startRouteErrors, setStartRouteErrors] = useState<
        Record<string, string>
    >({});
    const [updatingStartRoute, setUpdatingStartRoute] = useState(false);
    const [pendingDeleteStartRoute, setPendingDeleteStartRoute] =
        useState<ActivityStartRoute | null>(null);
    const [deletingStartRoute, setDeletingStartRoute] = useState(false);
    const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
        null,
    );
    const [imageUploadErrors, setImageUploadErrors] = useState<
        Record<string, string>
    >({});

    const openEdit = useCallback(
        (activity: ActivitySummary) => {
            setEditingActivity(activity);
            setEditForm(activityFormFromActivity(activity, firstType));
            setEditErrors({});
            setImageUploadErrors({});
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
        setImageUploadErrors({});
        setCreateOpen(true);
    };

    const uploadPortalImage = async (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => {
        const formData = new FormData();
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        formData.append('image', file);
        setUploadingImageKey(key);
        setImageUploadErrors((current) => ({ ...current, [key]: '' }));

        try {
            const response = await fetch('/settings/worlds/node-images', {
                body: formData,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                },
                method: 'POST',
            });
            const payload = (await response.json()) as {
                errors?: Record<string, string[]>;
                message?: string;
                url?: string;
            };

            if (!response.ok || !payload.url) {
                setImageUploadErrors((current) => ({
                    ...current,
                    [key]:
                        payload.errors?.image?.[0] ??
                        payload.message ??
                        'The image could not be uploaded.',
                }));

                return;
            }

            onUploaded(payload.url);
        } catch {
            setImageUploadErrors((current) => ({
                ...current,
                [key]: 'The image could not be uploaded.',
            }));
        } finally {
            setUploadingImageKey(null);
        }
    };

    const createActivity = () => {
        setCreating(true);

        router.post(
            `/settings/worlds/nodes/${activityGraph.node.id}/activities`,
            activityFormPayload(form),
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
            activityFormPayload(editForm),
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

    const openStartRoute = (edge: ActivityGraphEdge) => {
        if (!edge.data || !('startRouteId' in edge.data)) {
            return;
        }

        const startRouteId =
            edge.data && 'startRouteId' in edge.data
                ? edge.data.startRouteId
                : null;

        const route =
            activityGraph.node.startRoutes.find(
                (candidate) => candidate.id === startRouteId,
            ) ?? null;

        if (!route) {
            return;
        }

        setSelectedStartRoute(route);
        setStartRouteForm({
            button_border_color_dark: route.buttonBorderColorDark ?? '',
            button_border_color_light: route.buttonBorderColorLight ?? '',
            button_color_dark: route.buttonColorDark ?? '',
            button_color_light: route.buttonColorLight ?? '',
            image_dark: route.imageDark ?? '',
            image_light: route.imageLight ?? '',
        });
        setStartRouteErrors({});
        setImageUploadErrors({});
    };

    const updateStartRoute = () => {
        if (!selectedStartRoute) {
            return;
        }

        setUpdatingStartRoute(true);

        router.patch(
            `/settings/worlds/activity-starts/${selectedStartRoute.id}`,
            startRouteForm,
            {
                preserveScroll: true,
                onError: (nextErrors) => setStartRouteErrors(nextErrors),
                onSuccess: () => {
                    setSelectedStartRoute(null);
                    setStartRouteErrors({});
                },
                onFinish: () => setUpdatingStartRoute(false),
            },
        );
    };

    const deleteStartRoute = () => {
        if (!pendingDeleteStartRoute) {
            return;
        }

        setDeletingStartRoute(true);

        router.delete(
            `/settings/worlds/activity-starts/${pendingDeleteStartRoute.id}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPendingDeleteStartRoute(null);
                    setSelectedStartRoute(null);
                },
                onFinish: () => setDeletingStartRoute(false),
            },
        );
    };

    const connectActivities = (connection: Connection) => {
        if (!connection.source || !connection.target) {
            return;
        }

        if (connection.source === 'start') {
            if (connection.target !== 'end') {
                router.post(
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
            const activityId =
                edge.data && 'start' in edge.data ? Number(edge.target) : null;

            router.delete(
                `/settings/worlds/nodes/${activityGraph.node.id}/activities/start`,
                {
                    data: {
                        activity_id: activityId,
                    },
                    preserveScroll: true,
                },
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
                            nodeTypes={activityNodeTypes}
                            nodes={nodes}
                            onConnect={connectActivities}
                            onEdgeClick={(_, edge) => {
                                const graphEdge = edge as ActivityGraphEdge;

                                if (graphEdge.id.startsWith('start:')) {
                                    openStartRoute(graphEdge);

                                    return;
                                }

                                removeEdge(graphEdge);
                            }}
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
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
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
                        <ActivityFormFields
                            activityTypes={activityGraph.activityTypes}
                            errors={errors}
                            form={form}
                            imageUploadErrors={imageUploadErrors}
                            onChange={setForm}
                            onUploadPortalImage={uploadPortalImage}
                            portalCandidates={activityGraph.portalCandidates}
                            selectedType={selectedType}
                            tools={tools}
                            uploadingImageKey={uploadingImageKey}
                        />

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
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
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
                        imageUploadErrors={imageUploadErrors}
                        onChange={setEditForm}
                        onUploadPortalImage={uploadPortalImage}
                        portalCandidates={activityGraph.portalCandidates}
                        selectedType={selectedEditType}
                        tools={tools}
                        uploadingImageKey={uploadingImageKey}
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
                open={Boolean(selectedStartRoute)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedStartRoute(null);
                    }
                }}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Route visuals</DialogTitle>
                        <DialogDescription>
                            Configure optional images for the route button shown
                            in the learner node panel.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedStartRoute ? (
                        <div className="grid gap-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                                <p className="text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200/70">
                                    Starts activity
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                                    {routeActivityTitle(
                                        activityGraph.activities,
                                        selectedStartRoute,
                                    )}
                                </p>
                            </div>

                            <SettingsAccordionSection
                                defaultOpen
                                description="Optional images shown as the route card background."
                                title="Route images"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ConfigImageInput
                                        description="Displayed below the route button in dark mode."
                                        error={
                                            startRouteErrors.image_dark ??
                                            imageUploadErrors.route_image_dark
                                        }
                                        id="route-image-dark"
                                        label="Dark route image"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                image_dark: value,
                                            }))
                                        }
                                        onUpload={(file) =>
                                            void uploadPortalImage(
                                                'route_image_dark',
                                                file,
                                                (url) =>
                                                    setStartRouteForm(
                                                        (current) => ({
                                                            ...current,
                                                            image_dark: url,
                                                        }),
                                                    ),
                                            )
                                        }
                                        uploading={
                                            uploadingImageKey ===
                                            'route_image_dark'
                                        }
                                        value={startRouteForm.image_dark}
                                    />
                                    <ConfigImageInput
                                        description="Displayed below the route button in light mode. If empty, light mode shows only the button."
                                        error={
                                            startRouteErrors.image_light ??
                                            imageUploadErrors.route_image_light
                                        }
                                        id="route-image-light"
                                        label="Light route image"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                image_light: value,
                                            }))
                                        }
                                        onUpload={(file) =>
                                            void uploadPortalImage(
                                                'route_image_light',
                                                file,
                                                (url) =>
                                                    setStartRouteForm(
                                                        (current) => ({
                                                            ...current,
                                                            image_light: url,
                                                        }),
                                                    ),
                                            )
                                        }
                                        uploading={
                                            uploadingImageKey ===
                                            'route_image_light'
                                        }
                                        value={startRouteForm.image_light}
                                    />
                                </div>
                            </SettingsAccordionSection>

                            <SettingsAccordionSection
                                description="Theme-specific colors for the button layered over a route image."
                                title="Overlay button"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_color_dark
                                        }
                                        fallback="#0f172a"
                                        id="route-button-color-dark"
                                        label="Dark button color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_color_dark: value,
                                            }))
                                        }
                                        value={startRouteForm.button_color_dark}
                                    />
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_border_color_dark
                                        }
                                        fallback="#334155"
                                        id="route-button-border-color-dark"
                                        label="Dark border and frame color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_border_color_dark: value,
                                            }))
                                        }
                                        value={
                                            startRouteForm.button_border_color_dark
                                        }
                                    />
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_color_light
                                        }
                                        fallback="#ffffff"
                                        id="route-button-color-light"
                                        label="Light button color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_color_light: value,
                                            }))
                                        }
                                        value={
                                            startRouteForm.button_color_light
                                        }
                                    />
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_border_color_light
                                        }
                                        fallback="#e2e8f0"
                                        id="route-button-border-color-light"
                                        label="Light border and frame color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_border_color_light:
                                                    value,
                                            }))
                                        }
                                        value={
                                            startRouteForm.button_border_color_light
                                        }
                                    />
                                </div>
                            </SettingsAccordionSection>
                        </div>
                    ) : null}

                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/10"
                            disabled={updatingStartRoute}
                            onClick={() =>
                                setPendingDeleteStartRoute(selectedStartRoute)
                            }
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                            Delete route
                        </Button>
                        <div className="flex justify-end gap-2">
                            <Button
                                disabled={updatingStartRoute}
                                onClick={() => setSelectedStartRoute(null)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={updatingStartRoute}
                                onClick={updateStartRoute}
                                type="button"
                            >
                                Save
                            </Button>
                        </div>
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

            <Dialog
                open={Boolean(pendingDeleteStartRoute)}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteStartRoute(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete route?</DialogTitle>
                        <DialogDescription>
                            This removes the route button from the learner node
                            panel. The target activity itself stays untouched.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            disabled={deletingStartRoute}
                            onClick={() => setPendingDeleteStartRoute(null)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                            disabled={deletingStartRoute}
                            onClick={deleteStartRoute}
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

function RouteColorInput({
    error,
    fallback,
    id,
    label,
    onChange,
    value,
}: {
    error?: string;
    fallback: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    const pickerValue = isHexColor(value) ? value : fallback;

    return (
        <div className="grid gap-2 rounded-md bg-slate-50 p-3 dark:bg-white/5">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex gap-2">
                <Input
                    aria-label={`${label} picker`}
                    className="h-10 w-12 shrink-0 cursor-pointer p-1"
                    id={id}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    type="color"
                    value={pickerValue}
                />
                <Input
                    className="font-mono text-sm"
                    onChange={(event) => onChange(event.currentTarget.value)}
                    placeholder={fallback}
                    value={value}
                />
                <Button
                    onClick={() => onChange('')}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    Clear
                </Button>
            </div>
            <InputError message={error} />
        </div>
    );
}

function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]'),
    );
}
