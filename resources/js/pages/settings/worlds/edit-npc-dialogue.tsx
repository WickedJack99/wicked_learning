import { Head, Link, router } from '@inertiajs/react';
import type { FormDataConvertible } from '@inertiajs/core';
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
    FileText,
    GitBranch,
    Info,
    MessageCircle,
    Palette,
    Plus,
    Play,
    Save,
    Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ColorField as ConfigColorField } from '@/components/color-input';
import InputError from '@/components/input-error';
import { NumberField as ConfigNumberField } from '@/components/number-field';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import {
    ConfigImageInput,
    MirrorImageCheckbox,
} from './activity-config-fields';
import {
    ActivityScenePreview,
    ScenePreviewBubble,
    ScenePreviewImage,
    themedPreviewAsset,
} from './activity-scene-preview';

type DialogueConnector = {
    color: string;
    id: string;
    label: string;
    symbol: string;
};

type DialogueConfigValue = FormDataConvertible;

type DialogueNodeSummary = {
    body: string | null;
    config: Record<string, DialogueConfigValue>;
    connector: DialogueConnector | null;
    id: number;
    position: {
        x: number | null;
        y: number | null;
    };
    title: string;
    type: DialogueNodeType;
};

type DialogueTransitionSummary = {
    fromConnector: string;
    fromNodeId: number | null;
    id: number;
    toConnector: string;
    toNodeId: number;
};

type DialogueGraphPayload = {
    activity: {
        graphLayout: {
            end?: { x: number; y: number };
            start?: { x: number; y: number };
        };
        id: number;
        introduction: string | null;
        slug: string;
        title: string;
    };
    dialogueNodes: DialogueNodeSummary[];
    map: {
        id: number;
        slug: string;
        title: string;
    };
    node: {
        id: number;
        slug: string;
        title: string;
    };
    transitions: DialogueTransitionSummary[];
    worldNodes: DialogueTargetNode[];
    world: {
        id: number;
        slug: string;
        title: string;
    };
};

type DialogueTargetNode = {
    id: number;
    mapTitle: string;
    title: string;
};

type AnswerEventsConfig = {
    hideNodeIds: number[];
    unlockNodeIds: number[];
};

type EditableTool = {
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    slug: string;
    title: string;
};

type DialogueForm = {
    body: string;
    config: Record<string, DialogueConfigValue>;
    title: string;
    type: DialogueNodeType;
};

type DialogueSceneAsset = {
    id: string;
    imageDark: string;
    imageLight: string;
    label: string;
    layer: DialogueSceneAssetLayer;
    mirrored: boolean;
    width: number;
    x: number;
    y: number;
};

type DialogueSceneAssetLayer = 'behind_npc' | 'front' | 'bubble' | 'overlay';

type DialogueNodeData = {
    dialogueNode: DialogueNodeSummary;
    onDelete: (node: DialogueNodeSummary) => void;
    onEdit: (node: DialogueNodeSummary) => void;
};

type DialogueNodeType = 'answer' | 'end' | 'npc_monologue' | 'npc_question';

type DialogueNodeKind = 'answer' | 'end' | 'monologue' | 'question';

type DialogueSettingsSection = 'basics' | 'content' | 'flow' | 'visuals';

type SpecialNodeData = {
    description: string;
    title: string;
};

type DialogueGraphNode =
    | Node<DialogueNodeData, 'dialogueNode'>
    | Node<SpecialNodeData, 'special'>;

type DialogueGraphEdge = Edge<
    DialogueTransitionSummary | { start: true; transitionId: number }
>;

const nodeTypes = {
    dialogueNode: DialogueNodeCard,
    special: StartNode,
};

const edgeStyle = {
    stroke: '#0e7490',
    strokeWidth: 2,
};

export default function EditNpcDialogue({
    dialogueGraph,
    tools,
}: {
    dialogueGraph: DialogueGraphPayload;
    tools: EditableTool[];
}) {
    const { resolvedAppearance } = useAppearance();
    const [addOpen, setAddOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [form, setForm] = useState<DialogueForm>(() =>
        emptyDialogueForm('npc_monologue'),
    );
    const [editingNode, setEditingNode] = useState<DialogueNodeSummary | null>(
        null,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [pendingDelete, setPendingDelete] =
        useState<DialogueNodeSummary | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
        null,
    );
    const [imageUploadErrors, setImageUploadErrors] = useState<
        Record<string, string>
    >({});

    const openEdit = useCallback((node: DialogueNodeSummary) => {
        setEditingNode(node);
        setForm(formFromNode(node));
        setErrors({});
        setImageUploadErrors({});
        setEditOpen(true);
    }, []);

    const requestDelete = useCallback((node: DialogueNodeSummary) => {
        setPendingDelete(node);
    }, []);

    const initialNodes = useMemo(
        () => buildGraphNodes(dialogueGraph, openEdit, requestDelete),
        [dialogueGraph, openEdit, requestDelete],
    );
    const initialEdges = useMemo(
        () => buildGraphEdges(dialogueGraph),
        [dialogueGraph],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
    useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

    const openCreate = () => {
        setForm(emptyDialogueForm('npc_monologue'));
        setErrors({});
        setImageUploadErrors({});
        setAddOpen(true);
    };

    const createNode = () => {
        setProcessing(true);

        router.post(
            `/settings/worlds/activities/${dialogueGraph.activity.id}/npc-dialogue/nodes`,
            form,
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => setAddOpen(false),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const updateNode = () => {
        if (!editingNode) {
            return;
        }

        setProcessing(true);

        router.patch(
            `/settings/worlds/npc-dialogue-nodes/${editingNode.id}`,
            {
                body: form.body,
                config: form.config,
                title: form.title,
                type: form.type,
            },
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => {
                    setEditOpen(false);
                    setEditingNode(null);
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const deleteNode = () => {
        if (!pendingDelete) {
            return;
        }

        setDeleting(true);

        router.delete(
            `/settings/worlds/npc-dialogue-nodes/${pendingDelete.id}`,
            {
                preserveScroll: true,
                onSuccess: () => setPendingDelete(null),
                onFinish: () => setDeleting(false),
            },
        );
    };

    const connectNodes = (connection: Connection) => {
        if (
            !connection.source ||
            !connection.target ||
            connection.target === 'start'
        ) {
            return;
        }

        router.post(
            `/settings/worlds/activities/${dialogueGraph.activity.id}/npc-dialogue/transitions`,
            {
                from_connector: connection.sourceHandle ?? 'out',
                from_dialogue_node_id:
                    connection.source === 'start'
                        ? null
                        : Number(connection.source),
                to_connector: connection.targetHandle ?? 'in',
                to_dialogue_node_id: Number(connection.target),
            },
            { preserveScroll: true },
        );
    };

    const removeEdge = (edge: DialogueGraphEdge) => {
        const transitionId =
            edge.data && 'id' in edge.data ? edge.data.id : null;

        if (!transitionId) {
            return;
        }

        router.delete(
            `/settings/worlds/npc-dialogue-transitions/${transitionId}`,
            {
                preserveScroll: true,
            },
        );
    };

    const savePosition = (node: DialogueGraphNode) => {
        const position = {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
        };

        if (node.type === 'special') {
            router.patch(
                `/settings/worlds/activities/${dialogueGraph.activity.id}/graph-layout`,
                {
                    node: node.id,
                    position,
                },
                { preserveScroll: true },
            );

            return;
        }

        router.patch(
            `/settings/worlds/npc-dialogue-nodes/${node.data.dialogueNode.id}`,
            {
                graph_position_x: position.x,
                graph_position_y: position.y,
            },
            { preserveScroll: true },
        );
    };

    const uploadImage = async (
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
        } finally {
            setUploadingImageKey(null);
        }
    };

    return (
        <>
            <Head title={`NPC dialogue for ${dialogueGraph.activity.title}`} />
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
                                    href={`/settings/worlds/nodes/${dialogueGraph.node.id}/activities`}
                                >
                                    <ArrowLeft className="size-4" />
                                    Activity graph
                                </Link>
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                {dialogueGraph.node.title}
                            </p>
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                {dialogueGraph.activity.title} dialogue
                            </h1>
                        </div>
                        <Button onClick={openCreate} type="button">
                            <Plus className="size-4" />
                            Add node
                        </Button>
                    </header>

                    <section className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                        <ReactFlow
                            colorMode={resolvedAppearance}
                            edges={edges}
                            fitView
                            fitViewOptions={{ padding: 0.28 }}
                            nodeTypes={nodeTypes}
                            nodes={nodes}
                            onConnect={connectNodes}
                            onEdgeClick={(_, edge) =>
                                removeEdge(edge as DialogueGraphEdge)
                            }
                            onEdgesChange={onEdgesChange}
                            onNodeDragStop={(_, node) =>
                                savePosition(node as DialogueGraphNode)
                            }
                            onNodesChange={onNodesChange}
                        >
                            <Background gap={24} />
                            <Controls />
                            <MiniMap pannable zoomable />
                        </ReactFlow>
                    </section>
                </div>
            </main>

            <DialogueNodeDialog
                errors={errors}
                form={form}
                imageUploadErrors={imageUploadErrors}
                onChange={setForm}
                onOpenChange={setAddOpen}
                onSave={createNode}
                onUpload={uploadImage}
                open={addOpen}
                processing={processing}
                targetNodes={dialogueGraph.worldNodes}
                title="Add dialogue node"
                tools={tools}
                uploadingImageKey={uploadingImageKey}
            />

            <DialogueNodeDialog
                errors={errors}
                form={form}
                imageUploadErrors={imageUploadErrors}
                onChange={setForm}
                onOpenChange={setEditOpen}
                onSave={updateNode}
                onUpload={uploadImage}
                open={editOpen}
                processing={processing}
                targetNodes={dialogueGraph.worldNodes}
                title="Edit dialogue node"
                tools={tools}
                uploadingImageKey={uploadingImageKey}
            />

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
                        <DialogTitle>Delete dialogue node?</DialogTitle>
                        <DialogDescription>
                            This removes the node and its dialogue graph
                            connections.
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
                            onClick={deleteNode}
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

function DialogueNodeCard({
    data,
    selected,
}: {
    data: DialogueNodeData;
    selected: boolean;
}) {
    const node = data.dialogueNode;
    const color = node.connector?.color;
    const outputConnectors = dialogueOutputConnectors(node);

    return (
        <div
            className={cn(
                'relative w-72 rounded-xl border bg-slate-50 p-4 shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-cyan-600 ring-2 ring-cyan-600/20 dark:border-teal-200 dark:ring-teal-200/20',
            )}
        >
            <Handle
                className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                id="in"
                position={Position.Left}
                type="target"
            />
            {outputConnectors.map((connector, index) => (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                    id={connector.id}
                    key={connector.id}
                    position={Position.Right}
                    style={{
                        top: `${outputHandleTop(index, outputConnectors.length)}%`,
                    }}
                    type="source"
                />
            ))}

            <p className="text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200/70">
                {dialogueNodeTypeLabel(node)}
            </p>
            <h2 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {node.title}
            </h2>
            {node.type === 'end' && node.connector ? (
                <p
                    className="mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold"
                    style={{
                        backgroundColor: `${color}22`,
                        color,
                    }}
                >
                    {node.connector.symbol} output
                </p>
            ) : node.type === 'answer' ? (
                <>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {node.body || 'No answer text yet.'}
                    </p>
                    <p
                        className={cn(
                            'mt-3 inline-flex rounded-md px-2 py-1 text-xs font-semibold',
                            node.config.isCorrect
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
                        )}
                    >
                        {node.config.isCorrect
                            ? 'Correct answer'
                            : 'Alternative answer'}
                    </p>
                </>
            ) : (
                <>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {node.body || 'No dialogue text yet.'}
                    </p>
                    {outputConnectors.length > 1 ? (
                        <div className="mt-3 grid gap-1.5">
                            {outputConnectors.map((connector) => (
                                <p
                                    className="truncate rounded-md bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800 dark:bg-teal-200/10 dark:text-teal-100"
                                    key={connector.id}
                                >
                                    {connector.label}
                                </p>
                            ))}
                        </div>
                    ) : null}
                </>
            )}
            <div className="nodrag nopan mt-4 flex items-center gap-2">
                <Button
                    className="h-8 px-3 text-xs"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onEdit(node);
                    }}
                    type="button"
                    variant="outline"
                >
                    <MessageCircle className="size-3.5" />
                    Edit
                </Button>
                <Button
                    aria-label={`Delete ${node.title}`}
                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-300"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onDelete(node);
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

function dialogueNodeTypeLabel(node: DialogueNodeSummary): string {
    const kind = dialogueNodeKind(node);

    if (kind === 'answer') {
        return 'Answer';
    }

    if (kind === 'end') {
        return 'End node';
    }

    return kind === 'question' ? 'Question' : 'NPC monologue';
}

function StartNode({ data }: { data: SpecialNodeData; selected: boolean }) {
    return (
        <div className="relative grid w-44 place-items-center rounded-xl border border-slate-200 bg-white p-4 text-center shadow-lg dark:border-white/10 dark:bg-slate-950">
            <Handle
                className="!size-3 !border-2 !border-white !bg-cyan-600 dark:!bg-teal-300"
                id="start"
                position={Position.Right}
                type="source"
            />
            <span className="mb-2 grid size-9 place-items-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                <Play className="size-4" />
            </span>
            <p className="text-sm font-semibold">{data.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {data.description}
            </p>
        </div>
    );
}

function DialogueNodeDialog({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onOpenChange,
    onSave,
    onUpload,
    open,
    processing,
    targetNodes,
    title,
    tools,
    uploadingImageKey,
}: {
    errors: Record<string, string>;
    form: DialogueForm;
    imageUploadErrors: Record<string, string>;
    onChange: Dispatch<SetStateAction<DialogueForm>>;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    open: boolean;
    processing: boolean;
    targetNodes: DialogueTargetNode[];
    title: string;
    tools: EditableTool[];
    uploadingImageKey: string | null;
}) {
    const [activeSection, setActiveSection] =
        useState<DialogueSettingsSection>('basics');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Add a monologue, question, answer or end node to this
                        dialogue graph.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <DialogueSettingsSwitcher
                        activeSection={activeSection}
                        onChange={setActiveSection}
                    />

                    {activeSection === 'basics' ? (
                        <DialogueBasicsFields
                            errors={errors}
                            form={form}
                            onChange={onChange}
                        />
                    ) : null}

                    {activeSection === 'content' ? (
                        <DialogueContentFields
                            errors={errors}
                            form={form}
                            onChange={onChange}
                        />
                    ) : null}

                    {activeSection === 'flow' ? (
                        <DialogueFlowFields
                            errors={errors}
                            form={form}
                            onChange={onChange}
                            targetNodes={targetNodes}
                            tools={tools}
                        />
                    ) : null}

                    {activeSection === 'visuals' ? (
                        <DialogueVisualFields
                            errors={errors}
                            form={form}
                            imageUploadErrors={imageUploadErrors}
                            onChange={onChange}
                            onUpload={onUpload}
                            uploadingImageKey={uploadingImageKey}
                        />
                    ) : null}
                </div>

                <DialogFooter>
                    <Button
                        disabled={processing}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={processing}
                        onClick={onSave}
                        type="button"
                    >
                        <Save className="size-4" />
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DialogueBasicsFields({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: DialogueForm;
    onChange: Dispatch<SetStateAction<DialogueForm>>;
}) {
    return (
        <SettingsAccordionSection
            description="Choose what this dialogue graph node represents."
            title="Core node"
        >
            <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="dialogue-node-title">Title</Label>
                    <Input
                        id="dialogue-node-title"
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
                    <Label htmlFor="dialogue-node-type">Type</Label>
                    <Select
                        onValueChange={(value) =>
                            onChange(
                                emptyDialogueForm(
                                    value as DialogueForm['type'],
                                ),
                            )
                        }
                        value={form.type}
                    >
                        <SelectTrigger id="dialogue-node-type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="npc_monologue">
                                NPC monologue
                            </SelectItem>
                            <SelectItem value="npc_question">
                                Question
                            </SelectItem>
                            <SelectItem value="answer">Answer</SelectItem>
                            <SelectItem value="end">End node</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.type} />
                </div>
            </div>
        </SettingsAccordionSection>
    );
}

function DialogueContentFields({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: DialogueForm;
    onChange: Dispatch<SetStateAction<DialogueForm>>;
}) {
    const kind = formKind(form);

    if (kind === 'end') {
        return (
            <DialogueEmptySection
                description="End nodes only shape where the activity can leave this dialogue graph."
                title="No content settings"
            />
        );
    }

    if (kind === 'answer') {
        return (
            <SettingsAccordionSection
                description="This answer appears below a connected question. Its outgoing edge decides what happens next."
                title="Answer content"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <ConfigTextField
                        error={errors['config.answerLabel']}
                        label="Answer label"
                        onChange={(value) =>
                            setConfigValue(onChange, 'answerLabel', value)
                        }
                        value={stringConfig(form.config.answerLabel, 'A')}
                    />
                    <label className="flex h-9 items-center gap-2 self-end text-sm">
                        <input
                            checked={Boolean(form.config.isCorrect)}
                            className="size-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 dark:border-white/20 dark:bg-slate-950 dark:text-teal-200 dark:focus:ring-teal-200"
                            onChange={(event) =>
                                setConfigValue(
                                    onChange,
                                    'isCorrect',
                                    event.target.checked,
                                )
                            }
                            type="checkbox"
                        />
                        Correct answer
                    </label>
                </div>
                <div className="mt-4 grid gap-2">
                    <Label htmlFor="answer-body">Answer text</Label>
                    <DialogueTextArea
                        id="answer-body"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                body: value,
                            }))
                        }
                        value={form.body}
                    />
                    <InputError message={errors.body} />
                </div>
            </SettingsAccordionSection>
        );
    }

    return (
        <SettingsAccordionSection
            description={
                kind === 'question'
                    ? 'The question text shown before the learner chooses one connected answer.'
                    : 'The speech bubble text shown for this monologue.'
            }
            title={kind === 'question' ? 'Question text' : 'Speech'}
        >
            <div className="grid gap-2">
                <Label htmlFor="dialogue-body">
                    {kind === 'question'
                        ? 'Question bubble text'
                        : 'Speech bubble text'}
                </Label>
                <DialogueTextArea
                    id="dialogue-body"
                    onChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            body: value,
                        }))
                    }
                    value={form.body}
                />
                <InputError message={errors.body} />
            </div>
            <ConfigNumberField
                label="Typing speed"
                max="250"
                min="1"
                onChange={(value) =>
                    setConfigValue(onChange, 'typingSpeed', Number(value))
                }
                suffix="ms per character"
                value={stringConfig(form.config.typingSpeed, '28')}
            />
        </SettingsAccordionSection>
    );
}

function DialogueFlowFields({
    errors,
    form,
    onChange,
    targetNodes,
    tools,
}: {
    errors: Record<string, string>;
    form: DialogueForm;
    onChange: Dispatch<SetStateAction<DialogueForm>>;
    targetNodes: DialogueTargetNode[];
    tools: EditableTool[];
}) {
    const kind = formKind(form);

    if (kind === 'end') {
        return (
            <SettingsAccordionSection
                description="These values identify the matching activity-level exit connector."
                title="Exit connector"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <ConfigTextField
                        error={errors['config.connectorSymbol']}
                        label="Letter or number"
                        onChange={(value) =>
                            setConfigValue(onChange, 'connectorSymbol', value)
                        }
                        value={stringConfig(form.config.connectorSymbol, 'A')}
                    />
                    <ConfigColorField
                        error={errors['config.connectorColor']}
                        label="Connector color"
                        onChange={(value) =>
                            setConfigValue(onChange, 'connectorColor', value)
                        }
                        value={stringConfig(
                            form.config.connectorColor,
                            '#0ea5e9',
                        )}
                    />
                </div>
            </SettingsAccordionSection>
        );
    }

    if (kind === 'answer') {
        return (
            <SettingsAccordionSection
                description="Optional learner-specific world events applied when this answer is chosen."
                title="Answer events"
            >
                <div className="grid gap-4">
                    <AnswerNodeEventPicker
                        description="Selected nodes become hidden for the learner who chose this answer."
                        eventKey="hideNodeIds"
                        form={form}
                        label="Hide nodes"
                        onChange={onChange}
                        targetNodes={targetNodes}
                    />
                    <AnswerNodeEventPicker
                        description="Selected locked nodes become available for the learner who chose this answer."
                        eventKey="unlockNodeIds"
                        form={form}
                        label="Unlock nodes"
                        onChange={onChange}
                        targetNodes={targetNodes}
                    />
                </div>
            </SettingsAccordionSection>
        );
    }

    return (
        <>
            {kind === 'question' ? (
                <SettingsAccordionSection
                    description="Create one Answer node per exit and connect each output to the matching answer. Connection order controls display order."
                    title="Question outputs"
                >
                    <ConfigNumberField
                        label="Answer output count"
                        max="12"
                        min="1"
                        onChange={(value) =>
                            setConfigValue(
                                onChange,
                                'questionOutputCount',
                                Number(value),
                            )
                        }
                        value={stringConfig(
                            form.config.questionOutputCount,
                            '2',
                        )}
                    />
                </SettingsAccordionSection>
            ) : null}

            <SettingsAccordionSection
                description="Optionally add a configured tool to the learner when this dialogue node is reached."
                title="Tool grant"
            >
                <div className="grid gap-2">
                    <Label htmlFor="npc-tool-grant">Tool to give</Label>
                    <Select
                        onValueChange={(value) =>
                            setConfigValue(
                                onChange,
                                'toolId',
                                value === 'none' ? null : Number(value),
                            )
                        }
                        value={
                            form.config.toolId
                                ? String(form.config.toolId)
                                : 'none'
                        }
                    >
                        <SelectTrigger id="npc-tool-grant">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No tool</SelectItem>
                            {tools.map((tool) => (
                                <SelectItem
                                    key={tool.id}
                                    value={tool.id.toString()}
                                >
                                    {tool.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors['config.toolId']} />
                </div>
            </SettingsAccordionSection>
        </>
    );
}

function AnswerNodeEventPicker({
    description,
    eventKey,
    form,
    label,
    onChange,
    targetNodes,
}: {
    description: string;
    eventKey: 'hideNodeIds' | 'unlockNodeIds';
    form: DialogueForm;
    label: string;
    onChange: Dispatch<SetStateAction<DialogueForm>>;
    targetNodes: DialogueTargetNode[];
}) {
    const selectedNodeIds = answerEventNodeIds(form.config.events, eventKey);

    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <div>
                <Label>{label}</Label>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </div>
            <Select
                onValueChange={(value) =>
                    addAnswerEventNode(onChange, eventKey, value)
                }
            >
                <SelectTrigger>
                    <SelectValue placeholder="Add node" />
                </SelectTrigger>
                <SelectContent>
                    {targetNodes.map((node) => (
                        <SelectItem
                            disabled={selectedNodeIds.includes(node.id)}
                            key={node.id}
                            value={node.id.toString()}
                        >
                            {node.title} - {node.mapTitle}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
                {selectedNodeIds.length === 0 ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        No nodes selected.
                    </span>
                ) : null}
                {selectedNodeIds.map((nodeId) => {
                    const node = targetNodes.find(
                        (candidate) => candidate.id === nodeId,
                    );

                    return (
                        <button
                            className="rounded-full border border-cyan-500/25 bg-cyan-50 px-3 py-1 text-xs text-cyan-800 transition hover:border-cyan-600 dark:border-teal-200/20 dark:bg-teal-200/10 dark:text-teal-100"
                            key={nodeId}
                            onClick={() =>
                                removeAnswerEventNode(
                                    onChange,
                                    eventKey,
                                    nodeId,
                                )
                            }
                            type="button"
                        >
                            {node
                                ? `${node.title} - ${node.mapTitle}`
                                : `Node ${nodeId}`}
                            {' x'}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function DialogueVisualFields({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    uploadingImageKey,
}: {
    errors: Record<string, string>;
    form: DialogueForm;
    imageUploadErrors: Record<string, string>;
    onChange: Dispatch<SetStateAction<DialogueForm>>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const kind = formKind(form);
    const { resolvedAppearance } = useAppearance();
    const isLight = resolvedAppearance === 'light';
    const backgroundImage = themedPreviewAsset(
        form.config.backgroundDark,
        form.config.backgroundLight,
        resolvedAppearance,
    );
    const npcImage = themedPreviewAsset(
        form.config.npcImageDark,
        form.config.npcImageLight,
        resolvedAppearance,
    );
    const sceneAssets = dialogueSceneAssets(form.config.sceneAssets);
    const bubbleColor = stringConfig(
        isLight ? form.config.bubbleColorLight : form.config.bubbleColorDark,
        isLight ? '#ffffff' : '#0f172a',
    );
    const bubbleBorderColor = stringConfig(
        isLight
            ? form.config.bubbleBorderColorLight
            : form.config.bubbleBorderColorDark,
        isLight ? '#0891b2' : '#2dd4bf',
    );
    const bubbleOpacity = stringConfig(
        isLight
            ? form.config.bubbleOpacityLight
            : form.config.bubbleOpacityDark,
        isLight ? '94' : '92',
    );

    if (kind === 'answer' || kind === 'end') {
        return (
            <DialogueEmptySection
                description="This node type has no scene visuals of its own."
                title="No visual settings"
            />
        );
    }

    return (
        <>
            <ActivityScenePreview
                backgroundImage={backgroundImage}
                backgroundMirrored={booleanConfig(
                    form.config.backgroundMirrored,
                    false,
                )}
                description="Uses this node's current theme images, placement and bubble style."
                title="Dialogue scene preview"
            >
                <DialogueSceneAssetPreviewLayers
                    assets={sceneAssets}
                    mode={resolvedAppearance}
                    phase="behind_npc"
                />
                <ScenePreviewImage
                    imageUrl={npcImage}
                    label="NPC image"
                    mirrored={booleanConfig(
                        form.config.npcImageMirrored,
                        false,
                    )}
                    width={26}
                    x={stringConfig(form.config.npcX, '50')}
                    y={stringConfig(form.config.npcY, '48')}
                />
                <DialogueSceneAssetPreviewLayers
                    assets={sceneAssets}
                    mode={resolvedAppearance}
                    phase="front"
                />
                <div className="absolute inset-x-3 bottom-3">
                    <DialogueSceneAssetPreviewLayers
                        assets={sceneAssets}
                        mode={resolvedAppearance}
                        phase="bubble"
                    />
                    <ScenePreviewBubble
                        borderColor={bubbleBorderColor}
                        color={bubbleColor}
                        label={kind === 'question' ? 'Question' : 'NPC'}
                        opacity={bubbleOpacity}
                        text={form.body ?? form.title}
                    />
                </div>
                <DialogueSceneAssetPreviewLayers
                    assets={sceneAssets}
                    mode={resolvedAppearance}
                    phase="overlay"
                />
            </ActivityScenePreview>

            <SettingsAccordionSection
                description="Theme-specific background and NPC images."
                title="Visual assets"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <ConfigImageInput
                        description="Displayed behind the dialogue in dark mode."
                        error={
                            imageUploadErrors.backgroundDark ??
                            errors['config.backgroundDark']
                        }
                        id="npc-background-dark"
                        label="Dark background"
                        onChange={(value) =>
                            setConfigValue(onChange, 'backgroundDark', value)
                        }
                        onUpload={(file) =>
                            onUpload('backgroundDark', file, (url) =>
                                setConfigValue(onChange, 'backgroundDark', url),
                            )
                        }
                        uploading={uploadingImageKey === 'backgroundDark'}
                        value={stringConfig(form.config.backgroundDark)}
                    />
                    <ConfigImageInput
                        description="Displayed behind the dialogue in light mode."
                        error={
                            imageUploadErrors.backgroundLight ??
                            errors['config.backgroundLight']
                        }
                        id="npc-background-light"
                        label="Light background"
                        onChange={(value) =>
                            setConfigValue(onChange, 'backgroundLight', value)
                        }
                        onUpload={(file) =>
                            onUpload('backgroundLight', file, (url) =>
                                setConfigValue(
                                    onChange,
                                    'backgroundLight',
                                    url,
                                ),
                            )
                        }
                        uploading={uploadingImageKey === 'backgroundLight'}
                        value={stringConfig(form.config.backgroundLight)}
                    />
                    <ConfigImageInput
                        description="NPC image shown in dark mode."
                        error={
                            imageUploadErrors.npcImageDark ??
                            errors['config.npcImageDark']
                        }
                        id="npc-image-dark"
                        label="Dark NPC image"
                        onChange={(value) =>
                            setConfigValue(onChange, 'npcImageDark', value)
                        }
                        onUpload={(file) =>
                            onUpload('npcImageDark', file, (url) =>
                                setConfigValue(onChange, 'npcImageDark', url),
                            )
                        }
                        uploading={uploadingImageKey === 'npcImageDark'}
                        value={stringConfig(form.config.npcImageDark)}
                    />
                    <ConfigImageInput
                        description="NPC image shown in light mode."
                        error={
                            imageUploadErrors.npcImageLight ??
                            errors['config.npcImageLight']
                        }
                        id="npc-image-light"
                        label="Light NPC image"
                        onChange={(value) =>
                            setConfigValue(onChange, 'npcImageLight', value)
                        }
                        onUpload={(file) =>
                            onUpload('npcImageLight', file, (url) =>
                                setConfigValue(onChange, 'npcImageLight', url),
                            )
                        }
                        uploading={uploadingImageKey === 'npcImageLight'}
                        value={stringConfig(form.config.npcImageLight)}
                    />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <MirrorImageCheckbox
                        checked={booleanConfig(
                            form.config.backgroundMirrored,
                            false,
                        )}
                        label="Mirror background horizontally"
                        onChange={(checked) =>
                            setConfigValue(
                                onChange,
                                'backgroundMirrored',
                                checked,
                            )
                        }
                    />
                    <MirrorImageCheckbox
                        checked={booleanConfig(
                            form.config.npcImageMirrored,
                            false,
                        )}
                        label="Mirror NPC image horizontally"
                        onChange={(checked) =>
                            setConfigValue(
                                onChange,
                                'npcImageMirrored',
                                checked,
                            )
                        }
                    />
                </div>
            </SettingsAccordionSection>

            <SettingsAccordionSection
                description="Optional layered images for props, masks, foreground details or custom bubble frames."
                title="Additional scene assets"
            >
                <div className="grid gap-4">
                    {sceneAssets.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                            No extra assets yet. Add one to layer props, scenery
                            pieces or bubble decorations into this dialogue
                            scene.
                        </p>
                    ) : null}

                    {sceneAssets.map((asset, index) => (
                        <DialogueSceneAssetEditor
                            asset={asset}
                            errors={errors}
                            imageUploadErrors={imageUploadErrors}
                            index={index}
                            key={asset.id}
                            onChange={(updatedAsset) =>
                                setConfigValue(
                                    onChange,
                                    'sceneAssets',
                                    sceneAssets.map((candidate) =>
                                        candidate.id === asset.id
                                            ? updatedAsset
                                            : candidate,
                                    ),
                                )
                            }
                            onRemove={() =>
                                setConfigValue(
                                    onChange,
                                    'sceneAssets',
                                    sceneAssets.filter(
                                        (candidate) =>
                                            candidate.id !== asset.id,
                                    ),
                                )
                            }
                            onUpload={onUpload}
                            uploadingImageKey={uploadingImageKey}
                        />
                    ))}

                    <Button
                        className="justify-self-start"
                        onClick={() =>
                            setConfigValue(onChange, 'sceneAssets', [
                                ...sceneAssets,
                                createDialogueSceneAsset(sceneAssets.length),
                            ])
                        }
                        type="button"
                        variant="secondary"
                    >
                        <Plus className="size-4" />
                        Add asset
                    </Button>
                </div>
            </SettingsAccordionSection>

            <SettingsAccordionSection
                description="Where the NPC appears and how it enters the scene."
                title="NPC motion"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="slide-direction">Slide direction</Label>
                        <Select
                            onValueChange={(value) =>
                                setConfigValue(
                                    onChange,
                                    'slideDirection',
                                    value,
                                )
                            }
                            value={stringConfig(
                                form.config.slideDirection,
                                'left',
                            )}
                        >
                            <SelectTrigger id="slide-direction">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="bottom">Bottom</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <ConfigNumberField
                        label="Slide duration"
                        min="0"
                        onChange={(value) =>
                            setConfigValue(
                                onChange,
                                'slideDurationSeconds',
                                Number(value),
                            )
                        }
                        step="0.1"
                        suffix="seconds"
                        value={stringConfig(
                            form.config.slideDurationSeconds,
                            '0.6',
                        )}
                    />
                    <ConfigNumberField
                        label="Fade duration"
                        min="0"
                        onChange={(value) =>
                            setConfigValue(
                                onChange,
                                'fadeDurationSeconds',
                                Number(value),
                            )
                        }
                        step="0.1"
                        suffix="seconds"
                        value={stringConfig(
                            form.config.fadeDurationSeconds,
                            '0.4',
                        )}
                    />
                    <ConfigNumberField
                        label="NPC X position"
                        max="100"
                        min="0"
                        onChange={(value) =>
                            setConfigValue(onChange, 'npcX', Number(value))
                        }
                        suffix="%"
                        value={stringConfig(form.config.npcX, '50')}
                    />
                    <ConfigNumberField
                        label="NPC Y position"
                        max="100"
                        min="0"
                        onChange={(value) =>
                            setConfigValue(onChange, 'npcY', Number(value))
                        }
                        suffix="%"
                        value={stringConfig(form.config.npcY, '50')}
                    />
                </div>
            </SettingsAccordionSection>

            <SettingsAccordionSection
                description="Theme-specific speech bubble colors and transparency."
                title="Speech bubble style"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <ConfigColorField
                        label="Dark bubble color"
                        onChange={(value) =>
                            setConfigValue(onChange, 'bubbleColorDark', value)
                        }
                        value={stringConfig(
                            form.config.bubbleColorDark,
                            '#0f172a',
                        )}
                    />
                    <ConfigColorField
                        label="Dark bubble border"
                        onChange={(value) =>
                            setConfigValue(
                                onChange,
                                'bubbleBorderColorDark',
                                value,
                            )
                        }
                        value={stringConfig(
                            form.config.bubbleBorderColorDark,
                            '#2dd4bf',
                        )}
                    />
                    <ConfigNumberField
                        label="Dark bubble opacity"
                        max="100"
                        min="0"
                        onChange={(value) =>
                            setConfigValue(
                                onChange,
                                'bubbleOpacityDark',
                                Number(value),
                            )
                        }
                        suffix="%"
                        value={stringConfig(
                            form.config.bubbleOpacityDark,
                            '92',
                        )}
                    />
                    <ConfigColorField
                        label="Light bubble color"
                        onChange={(value) =>
                            setConfigValue(onChange, 'bubbleColorLight', value)
                        }
                        value={stringConfig(
                            form.config.bubbleColorLight,
                            '#ffffff',
                        )}
                    />
                    <ConfigColorField
                        label="Light bubble border"
                        onChange={(value) =>
                            setConfigValue(
                                onChange,
                                'bubbleBorderColorLight',
                                value,
                            )
                        }
                        value={stringConfig(
                            form.config.bubbleBorderColorLight,
                            '#0891b2',
                        )}
                    />
                    <ConfigNumberField
                        label="Light bubble opacity"
                        max="100"
                        min="0"
                        onChange={(value) =>
                            setConfigValue(
                                onChange,
                                'bubbleOpacityLight',
                                Number(value),
                            )
                        }
                        suffix="%"
                        value={stringConfig(
                            form.config.bubbleOpacityLight,
                            '94',
                        )}
                    />
                </div>
            </SettingsAccordionSection>
        </>
    );
}

function DialogueSceneAssetEditor({
    asset,
    errors,
    imageUploadErrors,
    index,
    onChange,
    onRemove,
    onUpload,
    uploadingImageKey,
}: {
    asset: DialogueSceneAsset;
    errors: Record<string, string>;
    imageUploadErrors: Record<string, string>;
    index: number;
    onChange: (asset: DialogueSceneAsset) => void;
    onRemove: () => void;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const darkUploadKey = `sceneAssets.${asset.id}.imageDark`;
    const lightUploadKey = `sceneAssets.${asset.id}.imageLight`;

    return (
        <div className="grid gap-4 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        Asset {index + 1}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Layer an additional visual into this one dialogue scene.
                    </p>
                </div>
                <Button
                    aria-label={`Remove asset ${index + 1}`}
                    onClick={onRemove}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <Trash2 className="size-4" />
                    Remove
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`scene-asset-label-${asset.id}`}>
                        Label
                    </Label>
                    <Input
                        id={`scene-asset-label-${asset.id}`}
                        onChange={(event) =>
                            onChange({
                                ...asset,
                                label: event.currentTarget.value,
                            })
                        }
                        value={asset.label}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`scene-asset-layer-${asset.id}`}>
                        Layer
                    </Label>
                    <Select
                        onValueChange={(value) =>
                            onChange({
                                ...asset,
                                layer: value as DialogueSceneAssetLayer,
                            })
                        }
                        value={asset.layer}
                    >
                        <SelectTrigger id={`scene-asset-layer-${asset.id}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="behind_npc">
                                Behind NPC
                            </SelectItem>
                            <SelectItem value="front">
                                In front of NPC
                            </SelectItem>
                            <SelectItem value="bubble">
                                Around speech bubble
                            </SelectItem>
                            <SelectItem value="overlay">
                                Above everything
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <ConfigImageInput
                    description="Displayed for this asset in dark mode."
                    error={
                        imageUploadErrors[darkUploadKey] ??
                        errors[`config.sceneAssets.${index}.imageDark`]
                    }
                    id={`scene-asset-dark-${asset.id}`}
                    label="Dark image"
                    onChange={(value) =>
                        onChange({ ...asset, imageDark: value })
                    }
                    onUpload={(file) =>
                        onUpload(darkUploadKey, file, (url) =>
                            onChange({ ...asset, imageDark: url }),
                        )
                    }
                    uploading={uploadingImageKey === darkUploadKey}
                    value={asset.imageDark}
                />
                <ConfigImageInput
                    description="Optional light-mode override. If empty, the dark image is reused."
                    error={
                        imageUploadErrors[lightUploadKey] ??
                        errors[`config.sceneAssets.${index}.imageLight`]
                    }
                    id={`scene-asset-light-${asset.id}`}
                    label="Light image"
                    onChange={(value) =>
                        onChange({ ...asset, imageLight: value })
                    }
                    onUpload={(file) =>
                        onUpload(lightUploadKey, file, (url) =>
                            onChange({ ...asset, imageLight: url }),
                        )
                    }
                    uploading={uploadingImageKey === lightUploadKey}
                    value={asset.imageLight}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <ConfigNumberField
                    label="X position"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        onChange({ ...asset, x: numericConfig(value, 50) })
                    }
                    suffix="%"
                    value={asset.x.toString()}
                />
                <ConfigNumberField
                    label="Y position"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        onChange({ ...asset, y: numericConfig(value, 50) })
                    }
                    suffix="%"
                    value={asset.y.toString()}
                />
                <ConfigNumberField
                    label="Width"
                    max="100"
                    min="1"
                    onChange={(value) =>
                        onChange({
                            ...asset,
                            width: numericConfig(value, 24),
                        })
                    }
                    suffix="%"
                    value={asset.width.toString()}
                />
                <MirrorImageCheckbox
                    checked={asset.mirrored}
                    label="Mirror horizontally"
                    onChange={(checked) =>
                        onChange({ ...asset, mirrored: checked })
                    }
                />
            </div>
        </div>
    );
}

function DialogueSceneAssetPreviewLayers({
    assets,
    mode,
    phase,
}: {
    assets: DialogueSceneAsset[];
    mode: 'dark' | 'light';
    phase: DialogueSceneAssetLayer;
}) {
    return (
        <>
            {assets
                .filter((asset) => asset.layer === phase)
                .map((asset) => (
                    <ScenePreviewImage
                        imageUrl={themedPreviewAsset(
                            asset.imageDark,
                            asset.imageLight,
                            mode,
                        )}
                        key={asset.id}
                        label={asset.label || 'Scene asset'}
                        mirrored={asset.mirrored}
                        width={asset.width}
                        x={asset.x}
                        y={asset.y}
                        zIndex={dialogueSceneAssetZIndex(asset.layer)}
                    />
                ))}
        </>
    );
}

const dialogueSettingsSections: {
    description: string;
    icon: LucideIcon;
    key: DialogueSettingsSection;
    label: string;
}[] = [
    {
        description: 'Title and visible graph node type.',
        icon: Info,
        key: 'basics',
        label: 'Basics',
    },
    {
        description: 'Speech, question or answer text.',
        icon: FileText,
        key: 'content',
        label: 'Content',
    },
    {
        description: 'Connectors, answer exits and tool grants.',
        icon: GitBranch,
        key: 'flow',
        label: 'Flow',
    },
    {
        description: 'Images, motion and bubble styling.',
        icon: Palette,
        key: 'visuals',
        label: 'Visuals',
    },
];

function DialogueSettingsSwitcher({
    activeSection,
    onChange,
}: {
    activeSection: DialogueSettingsSection;
    onChange: (section: DialogueSettingsSection) => void;
}) {
    return (
        <div
            aria-label="Dialogue node settings sections"
            className="mx-auto flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white/88 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/82"
            role="tablist"
        >
            {dialogueSettingsSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;

                return (
                    <button
                        aria-label={section.label}
                        aria-selected={isActive}
                        className={
                            isActive
                                ? 'grid size-10 place-items-center rounded-xl bg-cyan-600 text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:bg-teal-300 dark:text-slate-950 dark:focus-visible:ring-teal-200'
                                : 'grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-teal-200'
                        }
                        key={section.key}
                        onClick={() => onChange(section.key)}
                        title={`${section.label} - ${section.description}`}
                        type="button"
                    >
                        <Icon className="size-4" />
                    </button>
                );
            })}
        </div>
    );
}

function DialogueEmptySection({
    description,
    title,
}: {
    description: string;
    title: string;
}) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
                {title}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
            </p>
        </div>
    );
}

function DialogueTextArea({
    id,
    onChange,
    value,
}: {
    id: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <textarea
            className="min-h-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
            id={id}
            onChange={(event) => onChange(event.target.value)}
            value={value}
        />
    );
}

function ConfigTextField({
    error,
    label,
    onChange,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.target.value)}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function buildGraphNodes(
    payload: DialogueGraphPayload,
    onEdit: (node: DialogueNodeSummary) => void,
    onDelete: (node: DialogueNodeSummary) => void,
): DialogueGraphNode[] {
    const dialogueNodes = payload.dialogueNodes.map((dialogueNode, index) => ({
        id: dialogueNode.id.toString(),
        type: 'dialogueNode' as const,
        data: { dialogueNode, onDelete, onEdit },
        position:
            dialogueNode.position.x !== null
                ? {
                      x: dialogueNode.position.x,
                      y: dialogueNode.position.y ?? 0,
                  }
                : {
                      x: 120 + index * 320,
                      y: (index % 2) * 180,
                  },
    }));

    return [
        {
            id: 'start',
            type: 'special',
            data: {
                description: 'Connect this to the first interaction node.',
                title: 'Start',
            },
            position: payload.activity.graphLayout.start ?? { x: -220, y: 40 },
        },
        ...dialogueNodes,
    ];
}

function buildGraphEdges(payload: DialogueGraphPayload): DialogueGraphEdge[] {
    const nodeById = new Map(
        payload.dialogueNodes.map((node) => [node.id, node]),
    );

    return payload.transitions.map((transition) => ({
        id: `dialogue-transition:${transition.id}`,
        source: transition.fromNodeId?.toString() ?? 'start',
        sourceHandle: transition.fromNodeId
            ? validSourceHandle(
                  nodeById.get(transition.fromNodeId),
                  transition.fromConnector,
              )
            : 'start',
        target: transition.toNodeId.toString(),
        targetHandle: transition.toConnector,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: edgeStyle,
        data: transition,
    }));
}

function validSourceHandle(
    node: DialogueNodeSummary | undefined,
    connector: string,
): string {
    if (!node) {
        return connector;
    }

    const connectorIds = dialogueOutputConnectors(node).map(
        (output) => output.id,
    );

    return connectorIds.includes(connector)
        ? connector
        : (connectorIds[0] ?? connector);
}

function dialogueSceneAssets(value: unknown): DialogueSceneAsset[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isRecord).map((asset, index) => ({
        id: stringConfig(asset.id, `asset-${index + 1}`),
        imageDark: stringConfig(asset.imageDark),
        imageLight: stringConfig(asset.imageLight),
        label: stringConfig(asset.label, `Asset ${index + 1}`),
        layer: dialogueSceneAssetLayer(asset.layer),
        mirrored: booleanConfig(asset.mirrored, false),
        width: clampNumber(numericConfig(asset.width, 24), 1, 100),
        x: clampNumber(numericConfig(asset.x, 50), 0, 100),
        y: clampNumber(numericConfig(asset.y, 50), 0, 100),
    }));
}

function createDialogueSceneAsset(index: number): DialogueSceneAsset {
    return {
        id: `asset-${Date.now()}-${index + 1}`,
        imageDark: '',
        imageLight: '',
        label: `Asset ${index + 1}`,
        layer: 'front',
        mirrored: false,
        width: 24,
        x: 50,
        y: 50,
    };
}

function dialogueSceneAssetLayer(value: unknown): DialogueSceneAssetLayer {
    if (
        value === 'behind_npc' ||
        value === 'front' ||
        value === 'bubble' ||
        value === 'overlay'
    ) {
        return value;
    }

    return 'front';
}

function dialogueSceneAssetZIndex(layer: DialogueSceneAssetLayer): number {
    if (layer === 'behind_npc') {
        return 8;
    }

    if (layer === 'front') {
        return 18;
    }

    if (layer === 'bubble') {
        return 22;
    }

    return 30;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function emptyDialogueForm(type: DialogueForm['type']): DialogueForm {
    if (type === 'answer') {
        return {
            body: '',
            config: {
                answerLabel: 'A',
                events: {
                    hideNodeIds: [],
                    unlockNodeIds: [],
                },
                isCorrect: false,
            },
            title: 'Answer',
            type,
        };
    }

    return {
        body: '',
        config:
            type === 'end'
                ? {
                      connectorColor: '#0ea5e9',
                      connectorSymbol: 'A',
                  }
                : {
                      backgroundDark: '',
                      backgroundLight: '',
                      backgroundMirrored: false,
                      sceneAssets: [],
                      bubbleBorderColorDark: '#2dd4bf',
                      bubbleBorderColorLight: '#0891b2',
                      bubbleColorDark: '#0f172a',
                      bubbleColorLight: '#ffffff',
                      bubbleOpacityDark: 92,
                      bubbleOpacityLight: 94,
                      fadeDurationSeconds: 0.4,
                      npcImageDark: '',
                      npcImageLight: '',
                      npcImageMirrored: false,
                      npcX: 50,
                      npcY: 50,
                      questionOutputCount: 2,
                      slideDirection: 'left',
                      slideDurationSeconds: 0.6,
                      toolId: null,
                      typingSpeed: 28,
                  },
        title:
            type === 'end'
                ? 'End'
                : type === 'npc_question'
                  ? 'Question'
                  : 'NPC monologue',
        type,
    };
}

function formFromNode(node: DialogueNodeSummary): DialogueForm {
    return {
        body: node.body ?? '',
        config: node.config,
        title: node.title,
        type: node.type,
    };
}

function formKind(form: DialogueForm): DialogueNodeKind {
    if (form.type === 'answer' || form.type === 'end') {
        return form.type;
    }

    return form.type === 'npc_question' ? 'question' : 'monologue';
}

function dialogueNodeKind(node: DialogueNodeSummary): DialogueNodeKind {
    if (node.type === 'answer' || node.type === 'end') {
        return node.type;
    }

    return node.type === 'npc_question' ? 'question' : 'monologue';
}

function setConfigValue(
    setForm: Dispatch<SetStateAction<DialogueForm>>,
    key: string,
    value: DialogueConfigValue,
) {
    setForm((current) => ({
        ...current,
        config: {
            ...current.config,
            [key]: value,
        },
    }));
}

function addAnswerEventNode(
    setForm: Dispatch<SetStateAction<DialogueForm>>,
    eventKey: 'hideNodeIds' | 'unlockNodeIds',
    value: string,
) {
    const nodeId = Number(value);

    if (!Number.isFinite(nodeId) || nodeId <= 0) {
        return;
    }

    setForm((current) => {
        const events = answerEventsConfig(current.config.events);
        const nextNodeIds = Array.from(
            new Set([...answerEventNodeIds(events, eventKey), nodeId]),
        );

        return {
            ...current,
            config: {
                ...current.config,
                events: {
                    ...events,
                    [eventKey]: nextNodeIds,
                },
            },
        };
    });
}

function removeAnswerEventNode(
    setForm: Dispatch<SetStateAction<DialogueForm>>,
    eventKey: 'hideNodeIds' | 'unlockNodeIds',
    nodeId: number,
) {
    setForm((current) => {
        const events = answerEventsConfig(current.config.events);

        return {
            ...current,
            config: {
                ...current.config,
                events: {
                    ...events,
                    [eventKey]: answerEventNodeIds(events, eventKey).filter(
                        (candidateId) => candidateId !== nodeId,
                    ),
                },
            },
        };
    });
}

function answerEventsConfig(value: unknown): AnswerEventsConfig {
    return {
        hideNodeIds: answerEventNodeIds(value, 'hideNodeIds'),
        unlockNodeIds: answerEventNodeIds(value, 'unlockNodeIds'),
    };
}

function answerEventNodeIds(
    eventsValue: unknown,
    eventKey: 'hideNodeIds' | 'unlockNodeIds',
): number[] {
    const events = isRecord(eventsValue) ? eventsValue : {};
    const value = events[eventKey];

    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((nodeId) => numericConfig(nodeId, 0))
        .filter((nodeId) => nodeId > 0);
}

function dialogueOutputConnectors(
    node: DialogueNodeSummary,
): DialogueConnector[] {
    const kind = dialogueNodeKind(node);

    if (kind !== 'monologue' && kind !== 'question') {
        return kind === 'answer'
            ? [
                  {
                      color: '#0ea5e9',
                      id: 'out',
                      label: 'Continue',
                      symbol: '>',
                  },
              ]
            : [];
    }

    if (kind !== 'question') {
        return [
            {
                color: '#0ea5e9',
                id: 'out',
                label: 'Continue',
                symbol: '>',
            },
        ];
    }

    const outputCount = numericConfig(node.config.questionOutputCount, 2);

    return Array.from({ length: Math.max(1, outputCount) }, (_, index) => ({
        color: '#0ea5e9',
        id: `answer-${index + 1}`,
        label: `Answer ${index + 1}`,
        symbol: String.fromCharCode(65 + index),
    }));
}

function outputHandleTop(index: number, count: number): number {
    if (count <= 1) {
        return 50;
    }

    const start = 34;
    const end = 74;

    return start + ((end - start) / (count - 1)) * index;
}

function stringConfig(value: unknown, fallback = ''): string {
    if (typeof value === 'number') {
        return value.toString();
    }

    return typeof value === 'string' ? value : fallback;
}

function numericConfig(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

function booleanConfig(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    }

    return fallback;
}
