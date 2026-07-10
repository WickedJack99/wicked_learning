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
    MessageCircle,
    Plus,
    Play,
    Save,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { ConfigImageInput } from './activity-config-fields';

type DialogueConnector = {
    color: string;
    id: string;
    label: string;
    symbol: string;
};

type DialogueConfigValue =
    | Array<Record<string, boolean | number | string | null>>
    | boolean
    | number
    | string
    | null;

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
    type: 'answer' | 'end' | 'npc_interaction';
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
    world: {
        id: number;
        slug: string;
        title: string;
    };
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
    type: 'answer' | 'end' | 'npc_interaction';
};

type DialogueNodeData = {
    dialogueNode: DialogueNodeSummary;
    onDelete: (node: DialogueNodeSummary) => void;
    onEdit: (node: DialogueNodeSummary) => void;
};

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
        emptyDialogueForm('npc_interaction'),
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
        setForm(emptyDialogueForm('npc_interaction'));
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
        if (node.type !== 'dialogueNode') {
            return;
        }

        router.patch(
            `/settings/worlds/npc-dialogue-nodes/${node.data.dialogueNode.id}`,
            {
                graph_position_x: Math.round(node.position.x),
                graph_position_y: Math.round(node.position.y),
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
    if (node.type === 'answer') {
        return 'Answer';
    }

    if (node.type === 'end') {
        return 'End node';
    }

    return node.config.interactionMode === 'question'
        ? 'Question'
        : 'NPC interaction';
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
    title: string;
    tools: EditableTool[];
    uploadingImageKey: string | null;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Add an NPC interaction step or an End node that becomes
                        an activity-level exit connector.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <SettingsAccordionSection
                        defaultOpen
                        description="Choose what this dialogue graph node represents."
                        title="Core node"
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="dialogue-node-title">
                                    Title
                                </Label>
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
                                        <SelectItem value="npc_interaction">
                                            NPC interaction
                                        </SelectItem>
                                        <SelectItem value="answer">
                                            Answer
                                        </SelectItem>
                                        <SelectItem value="end">
                                            End node
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.type} />
                            </div>
                        </div>
                    </SettingsAccordionSection>

                    {form.type === 'answer' ? (
                        <AnswerNodeFields
                            errors={errors}
                            form={form}
                            onChange={onChange}
                        />
                    ) : form.type === 'end' ? (
                        <EndNodeFields
                            errors={errors}
                            form={form}
                            onChange={onChange}
                        />
                    ) : (
                        <NpcInteractionFields
                            errors={errors}
                            form={form}
                            imageUploadErrors={imageUploadErrors}
                            onChange={onChange}
                            onUpload={onUpload}
                            tools={tools}
                            uploadingImageKey={uploadingImageKey}
                        />
                    )}
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

function EndNodeFields({
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
            defaultOpen
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
                    value={stringConfig(form.config.connectorColor, '#0ea5e9')}
                />
            </div>
        </SettingsAccordionSection>
    );
}

function AnswerNodeFields({
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
            defaultOpen
            description="This answer appears below a connected question. Its outgoing edge decides what happens next."
            title="Answer"
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
                <textarea
                    className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                    id="answer-body"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            body: event.target.value,
                        }))
                    }
                    value={form.body}
                />
                <InputError message={errors.body} />
            </div>
        </SettingsAccordionSection>
    );
}

function NpcInteractionFields({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    tools,
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
    tools: EditableTool[];
    uploadingImageKey: string | null;
}) {
    return (
        <>
            <SettingsAccordionSection
                defaultOpen
                description="The first speech bubble text for this interaction node."
                title="Speech"
            >
                <div className="grid gap-2">
                    <Label htmlFor="interaction-mode">Interaction mode</Label>
                    <Select
                        onValueChange={(value) =>
                            setConfigValue(onChange, 'interactionMode', value)
                        }
                        value={stringConfig(
                            form.config.interactionMode,
                            'monologue',
                        )}
                    >
                        <SelectTrigger id="interaction-mode">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monologue">
                                NPC monologue
                            </SelectItem>
                            <SelectItem value="question">Question</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="dialogue-body">Speech bubble text</Label>
                    <textarea
                        className="min-h-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                        id="dialogue-body"
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                body: event.target.value,
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

            {form.config.interactionMode === 'question' ? (
                <SettingsAccordionSection
                    defaultOpen
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
                description="Optionally add a configured tool to the learner when this bubble is reached."
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

            <SettingsAccordionSection
                description="Theme-specific background and NPC images."
                title="Visual assets"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <ConfigImageInput
                        description="Displayed behind the interaction in dark mode."
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
                        description="Displayed behind the interaction in light mode."
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

function ConfigColorField({
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
    const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
                <Input
                    aria-label={`${label} picker`}
                    className="h-9 w-12 cursor-pointer p-1"
                    onChange={(event) => onChange(event.target.value)}
                    type="color"
                    value={pickerValue}
                />
                <Input
                    id={id}
                    onChange={(event) => onChange(event.target.value)}
                    value={value}
                />
            </div>
            <InputError message={error} />
        </div>
    );
}

function ConfigNumberField({
    label,
    max,
    min,
    onChange,
    step,
    suffix,
    value,
}: {
    label: string;
    max?: string;
    min?: string;
    onChange: (value: string) => void;
    step?: string;
    suffix?: string;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <Input
                    id={id}
                    max={max}
                    min={min}
                    onChange={(event) => onChange(event.target.value)}
                    step={step}
                    type="number"
                    value={value}
                />
                {suffix ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {suffix}
                    </span>
                ) : null}
            </div>
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
            position: { x: -220, y: 40 },
        },
        ...dialogueNodes,
    ];
}

function buildGraphEdges(payload: DialogueGraphPayload): DialogueGraphEdge[] {
    return payload.transitions.map((transition) => ({
        id: `dialogue-transition:${transition.id}`,
        source: transition.fromNodeId?.toString() ?? 'start',
        sourceHandle: transition.fromNodeId
            ? transition.fromConnector
            : 'start',
        target: transition.toNodeId.toString(),
        targetHandle: transition.toConnector,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: edgeStyle,
        data: transition,
    }));
}

function emptyDialogueForm(type: DialogueForm['type']): DialogueForm {
    if (type === 'answer') {
        return {
            body: '',
            config: {
                answerLabel: 'A',
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
                      bubbleBorderColorDark: '#2dd4bf',
                      bubbleBorderColorLight: '#0891b2',
                      bubbleColorDark: '#0f172a',
                      bubbleColorLight: '#ffffff',
                      bubbleOpacityDark: 92,
                      bubbleOpacityLight: 94,
                      fadeDurationSeconds: 0.4,
                      interactionMode: 'monologue',
                      npcImageDark: '',
                      npcImageLight: '',
                      npcX: 50,
                      npcY: 50,
                      questionOutputCount: 2,
                      slideDirection: 'left',
                      slideDurationSeconds: 0.6,
                      toolId: null,
                      typingSpeed: 28,
                  },
        title: type === 'end' ? 'End' : 'NPC interaction',
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

function dialogueOutputConnectors(
    node: DialogueNodeSummary,
): DialogueConnector[] {
    if (node.type !== 'npc_interaction') {
        return node.type === 'answer'
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

    if (node.config.interactionMode !== 'question') {
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
