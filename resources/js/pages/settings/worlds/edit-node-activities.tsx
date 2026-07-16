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
import { ArrowLeft, ArrowRight, GitBranch, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColorField } from '@/components/color-input';
import { SettingsConfigurationDialog } from '@/components/settings-configuration-dialog';
import { SettingsConfigurationSection } from '@/components/settings-configuration-section';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { themedPreviewAsset } from './activity-scene-preview';
import type {
    ActivityForm,
    ActivityGraphEdge,
    ActivityGraphNode,
    ActivityGraphPayload,
    ActivityNodeData,
    ActivityStartRoute,
    ActivitySummary,
    EditableItem,
    EditableSound,
    EditableTool,
    StartRouteForm,
} from './edit-node-activity-types';
import { useNodeImageUpload } from './use-node-image-upload';

export default function EditNodeActivities({
    activityGraph,
    items,
    sounds,
    tools,
}: {
    activityGraph: ActivityGraphPayload;
    items: EditableItem[];
    sounds: EditableSound[];
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
    const {
        imageUploadErrors,
        resetImageUploadErrors,
        uploadNodeImage,
        uploadingImageKey,
    } = useNodeImageUpload();

    const openEdit = useCallback(
        (activity: ActivitySummary) => {
            setEditingActivity(activity);
            setEditForm(activityFormFromActivity(activity, firstType));
            setEditErrors({});
            resetImageUploadErrors();
            setEditOpen(true);
        },
        [firstType, resetImageUploadErrors],
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
        resetImageUploadErrors();
        setCreateOpen(true);
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
        resetImageUploadErrors();
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
        const position = {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
        };

        if (node.type === 'special') {
            router.patch(
                `/settings/worlds/nodes/${activityGraph.node.id}/activities/layout`,
                {
                    node: node.id,
                    position,
                },
                { preserveScroll: true },
            );

            return;
        }

        router.patch(
            `/settings/worlds/activities/${node.data.activity.id}`,
            {
                graph_position_x: position.x,
                graph_position_y: position.y,
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
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
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
                                <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] px-5 py-4 text-center shadow-lg backdrop-blur">
                                    <GitBranch className="mx-auto mb-2 size-7 text-[var(--settings-accent)]" />
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
                <SettingsConfigurationDialog className="overflow-y-auto">
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
                            editingActivityId={null}
                            errors={errors}
                            form={form}
                            imageUploadErrors={imageUploadErrors}
                            onChange={setForm}
                            onUploadPortalImage={uploadNodeImage}
                            portalCandidates={activityGraph.portalCandidates}
                            selectedType={selectedType}
                            items={items}
                            sounds={sounds}
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
                </SettingsConfigurationDialog>
            </Dialog>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <SettingsConfigurationDialog className="overflow-y-auto">
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
                        editingActivityId={editingActivity?.id ?? null}
                        errors={editErrors}
                        form={editForm}
                        imageUploadErrors={imageUploadErrors}
                        onChange={setEditForm}
                        onUploadPortalImage={uploadNodeImage}
                        portalCandidates={activityGraph.portalCandidates}
                        selectedType={selectedEditType}
                        items={items}
                        sounds={sounds}
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
                </SettingsConfigurationDialog>
            </Dialog>

            <Dialog
                open={Boolean(selectedStartRoute)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedStartRoute(null);
                    }
                }}
            >
                <SettingsConfigurationDialog className="overflow-y-auto">
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
                                <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                                    Starts activity
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                                    {routeActivityTitle(
                                        activityGraph.activities,
                                        selectedStartRoute,
                                    )}
                                </p>
                            </div>

                            <RouteVisualPreview
                                form={startRouteForm}
                                mode={resolvedAppearance}
                                title={routeActivityTitle(
                                    activityGraph.activities,
                                    selectedStartRoute,
                                )}
                            />

                            <SettingsConfigurationSection
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
                                            void uploadNodeImage(
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
                                            void uploadNodeImage(
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
                            </SettingsConfigurationSection>

                            <SettingsConfigurationSection
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
                            </SettingsConfigurationSection>
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
                </SettingsConfigurationDialog>
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

function RouteVisualPreview({
    form,
    mode,
    title,
}: {
    form: StartRouteForm;
    mode: 'dark' | 'light';
    title: string;
}) {
    const isLight = mode === 'light';
    const image = themedPreviewAsset(form.image_dark, form.image_light, mode);
    const buttonColor =
        (isLight ? form.button_color_light : form.button_color_dark) ||
        (isLight ? '#ffffff' : '#0f172a');
    const borderColor =
        (isLight
            ? form.button_border_color_light
            : form.button_border_color_dark) ||
        (isLight ? '#e2e8f0' : '#334155');

    return (
        <div className="grid gap-2">
            <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Route card preview
                </p>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Uses the current appearance mode.
                </p>
            </div>
            <button
                className="group grid overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5"
                style={{ borderColor }}
                type="button"
            >
                <span
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold"
                    style={{
                        backgroundColor: buttonColor,
                        borderColor,
                        color: isLight ? '#0f172a' : '#f8fafc',
                    }}
                >
                    {title}
                    <ArrowRight className="size-4" />
                </span>
                {image ? (
                    <img
                        alt=""
                        className="aspect-[3/1] w-full object-cover"
                        draggable={false}
                        src={image}
                    />
                ) : null}
            </button>
        </div>
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
    return (
        <ColorField
            className="rounded-md bg-slate-50 p-3 dark:bg-white/5"
            error={error}
            fallback={fallback}
            id={id}
            inputClassName="font-mono text-sm"
            label={label}
            onChange={onChange}
            pickerClassName="h-10"
            showClear
            value={value}
        />
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
