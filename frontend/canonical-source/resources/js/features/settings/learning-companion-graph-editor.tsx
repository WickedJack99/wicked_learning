import {
    Background,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import {
    Bot,
    CircleStop,
    MessageCircle,
    Pencil,
    Play,
    Plus,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type CompanionDialogueNodeType =
    | 'ai'
    | 'choice'
    | 'end'
    | 'message';

export type CompanionDialogueChoice = {
    action?: string;
    key: string;
    label: string;
    next?: string | null;
};

export type CompanionDialogueNode = {
    capabilities?: string[];
    choices?: CompanionDialogueChoice[];
    id: string;
    instruction?: string;
    message?: string;
    next?: string | null;
    position?: { x: number; y: number };
    prompt?: string;
    response_mode?: 'choice' | 'message';
    title?: string;
    type: CompanionDialogueNodeType;
};

export type CompanionDialogueGraph = {
    nodes: CompanionDialogueNode[];
    start: string;
    version: number;
};

type CompanionGraphNodeData = {
    dialogueNode: CompanionDialogueNode;
    onDelete: (node: CompanionDialogueNode) => void;
    onEdit: (node: CompanionDialogueNode) => void;
};

type CompanionStartNodeData = {
    title: string;
};

type CompanionFlowNode =
    | Node<CompanionGraphNodeData, 'companion'>
    | Node<CompanionStartNodeData, 'start'>;

type CompanionEdgeData =
    | { kind: 'choice'; choiceIndex: number; sourceNodeId: string }
    | { kind: 'next'; sourceNodeId: string }
    | { kind: 'start' };

type CompanionFlowEdge = Edge<CompanionEdgeData>;

type CompanionNodeForm = {
    capabilities: string[];
    choices: CompanionDialogueChoice[];
    id: string;
    instruction: string;
    message: string;
    next: string | null;
    prompt: string;
    responseMode: 'choice' | 'message';
    title: string;
    type: CompanionDialogueNodeType;
};

const AI_CAPABILITIES = [
    ['current-context', 'Current context'],
    ['navigation-alternatives', 'Navigation alternatives'],
    ['route-context', 'Route context'],
    ['nearby-places', 'Nearby places'],
    ['topic-context', 'Topic context'],
    ['revisit-options', 'Revisit options'],
] as const;

const NAVIGATION_ACTIONS = [
    ['current-map', 'Current map'],
    ['learning-desk', 'Learning desk'],
    ['topics', 'Topics'],
    ['continue-exploring', 'Continue exploring'],
] as const;

const companionNodeTypes = {
    companion: CompanionDialogueNodeCard,
    start: CompanionStartNode,
};

const edgeStyle = {
    stroke: 'var(--settings-accent)',
    strokeWidth: 2,
};

export function normalizeCompanionDialogueGraph(
    graph: Record<string, unknown>,
): CompanionDialogueGraph {
    const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const nodes = rawNodes.flatMap((value): CompanionDialogueNode[] => {
        if (!isRecord(value) || typeof value.id !== 'string') {
            return [];
        }

        const type = isCompanionNodeType(value.type)
            ? value.type
            : 'message';
        const position = isRecord(value.position)
            && typeof value.position.x === 'number'
            && typeof value.position.y === 'number'
            ? { x: value.position.x, y: value.position.y }
            : undefined;
        const choices = Array.isArray(value.choices)
            ? value.choices.flatMap((choice): CompanionDialogueChoice[] => {
                  if (!isRecord(choice) || typeof choice.key !== 'string') {
                      return [];
                  }

                  return [
                      {
                          action:
                              typeof choice.action === 'string'
                                  ? choice.action
                                  : undefined,
                          key: choice.key,
                          label:
                              typeof choice.label === 'string'
                                  ? choice.label
                                  : choice.key,
                          next:
                              typeof choice.next === 'string'
                                  ? choice.next
                                  : null,
                      },
                  ];
              })
            : undefined;

        return [
            {
                capabilities: Array.isArray(value.capabilities)
                    ? value.capabilities.filter(
                          (capability): capability is string =>
                              typeof capability === 'string',
                      )
                    : undefined,
                choices,
                id: value.id,
                instruction:
                    typeof value.instruction === 'string'
                        ? value.instruction
                        : undefined,
                message:
                    typeof value.message === 'string'
                        ? value.message
                        : undefined,
                next: typeof value.next === 'string' ? value.next : null,
                position,
                prompt:
                    typeof value.prompt === 'string' ? value.prompt : undefined,
                response_mode:
                    value.response_mode === 'choice' ? 'choice' : 'message',
                title: typeof value.title === 'string' ? value.title : undefined,
                type,
            },
        ];
    });
    const firstNodeId = nodes[0]?.id ?? 'welcome';

    return {
        nodes,
        start: typeof graph.start === 'string' ? graph.start : firstNodeId,
        version: typeof graph.version === 'number' ? graph.version : 1,
    };
}

export function CompanionGraphEditor({
    graph,
    onChange,
}: {
    graph: CompanionDialogueGraph;
    onChange: (graph: CompanionDialogueGraph) => void;
}) {
    const t = usePlatformTranslation();
    const { resolvedAppearance } = useAppearance();
    const [editingNode, setEditingNode] =
        useState<CompanionDialogueNode | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<CompanionNodeForm>(() =>
        emptyNodeForm('message'),
    );
    const [pendingEdge, setPendingEdge] =
        useState<CompanionFlowEdge | null>(null);
    const [editorError, setEditorError] = useState('');
    const openEdit = useCallback((node: CompanionDialogueNode) => {
        setForm(formFromNode(node));
        setEditorError('');
        setEditingNode(node);
        setCreating(false);
    }, []);
    const deleteNode = useCallback(
        (node: CompanionDialogueNode) => {
            if (graph.nodes.length <= 1) {
                setEditorError(
                    t(
                        'settings.companion.dialogues.keep_node',
                        'A graph must keep at least one dialogue node.',
                    ),
                );

                return;
            }

            const nextNodes = graph.nodes.filter(
                (candidate) => candidate.id !== node.id,
            );
            const nextStart =
                graph.start === node.id ? (nextNodes[0]?.id ?? '') : graph.start;

            onChange({
                ...graph,
                nodes: clearNodeReferences(nextNodes, node.id),
                start: nextStart,
            });
        },
        [graph, onChange, t],
    );
    const initialNodes = useMemo(
        () => buildCompanionNodes(graph, openEdit, deleteNode),
        [deleteNode, graph, openEdit],
    );
    const initialEdges = useMemo(() => buildCompanionEdges(graph), [graph]);
    const nodeTypes = useMemo(() => companionNodeTypes, []);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
    useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

    const openCreate = () => {
        setForm(emptyNodeForm('message'));
        setEditorError('');
        setCreating(true);
    };

    const saveNode = () => {
        if (!form.id.trim() || !form.title.trim()) {
            setEditorError(
                t(
                    'settings.companion.dialogues.node_required',
                    'Every dialogue node needs an id and title.',
                ),
            );

            return;
        }

        const existing = graph.nodes.find((node) => node.id === form.id);

        if (
            (!existing || existing.id !== editingNode?.id) &&
            graph.nodes.some((node) => node.id === form.id)
        ) {
            setEditorError(
                t(
                    'settings.companion.dialogues.node_id_unique',
                    'Node ids must be unique within a graph.',
                ),
            );

            return;
        }

        const node: CompanionDialogueNode = {
            capabilities: form.capabilities.length
                ? form.capabilities
                : undefined,
            choices:
                form.type === 'choice'
                    ? form.choices.map((choice) => ({
                          action: choice.action || undefined,
                          key: choice.key.trim(),
                          label: choice.label.trim(),
                          next: choice.next ?? null,
                      }))
                    : undefined,
            id: form.id.trim(),
            instruction:
                form.type === 'ai' ? form.instruction.trim() : undefined,
            message:
                ['message', 'end'].includes(form.type)
                    ? form.message.trim()
                    : undefined,
            next:
                ['message', 'ai'].includes(form.type)
                    ? form.next
                    : null,
            position:
                existing?.position ?? {
                    x: 120 + graph.nodes.length * 40,
                    y: 80 + (graph.nodes.length % 3) * 180,
                },
            prompt: form.type === 'choice' ? form.prompt.trim() : undefined,
            response_mode:
                form.type === 'ai' ? form.responseMode : undefined,
            title: form.title.trim(),
            type: form.type,
        };
        const nodes = creating
            ? [...graph.nodes, node]
            : graph.nodes.map((candidate) =>
                  candidate.id === editingNode?.id ? node : candidate,
              );

        if (!creating && editingNode && editingNode.id !== node.id) {
            onChange({
                ...graph,
                nodes: renameNodeReferences(nodes, editingNode.id, node.id),
                start: graph.start === editingNode.id ? node.id : graph.start,
            });
        } else {
            onChange({ ...graph, nodes });
        }

        setCreating(false);
        setEditingNode(null);
    };

    const connect = (connection: Connection) => {
        if (
            !connection.source ||
            !connection.target ||
            connection.target === 'start' ||
            connection.source === connection.target
        ) {
            return;
        }

        if (connection.source === 'start') {
            onChange({ ...graph, start: connection.target });

            return;
        }

        const sourceNode = graph.nodes.find(
            (node) => node.id === connection.source,
        );

        if (!sourceNode) {
            return;
        }

        const nextNodes = graph.nodes.map((node) => {
            if (node.id !== sourceNode.id) {
                return node;
            }

            if (sourceNode.type === 'choice') {
                const choiceIndex = parseChoiceHandle(connection.sourceHandle);

                if (choiceIndex === null || !node.choices?.[choiceIndex]) {
                    return node;
                }

                return {
                    ...node,
                    choices: node.choices.map((choice, index) =>
                        index === choiceIndex
                            ? { ...choice, action: undefined, next: connection.target }
                            : choice,
                    ),
                };
            }

            return { ...node, next: connection.target };
        });

        onChange({ ...graph, nodes: nextNodes });
    };

    const removeEdge = () => {
        const edgeData = pendingEdge?.data;

        if (!pendingEdge || !edgeData || edgeData.kind === 'start') {
            setPendingEdge(null);

            return;
        }

        const sourceNode = graph.nodes.find(
            (node) => node.id === edgeData.sourceNodeId,
        );

        if (!sourceNode) {
            setPendingEdge(null);

            return;
        }

        const nodes = graph.nodes.map((node) => {
            if (node.id !== sourceNode.id) {
                return node;
            }

            if (edgeData.kind === 'choice') {
                return {
                    ...node,
                    choices: node.choices?.map((choice, index) =>
                        index === edgeData.choiceIndex
                            ? { ...choice, next: null }
                            : choice,
                    ),
                };
            }

            return { ...node, next: null };
        });

        onChange({ ...graph, nodes });
        setPendingEdge(null);
    };

    const updatePosition = (node: CompanionFlowNode) => {
        if (node.type !== 'companion') {
            return;
        }

        onChange({
            ...graph,
            nodes: graph.nodes.map((candidate) =>
                candidate.id === node.data.dialogueNode.id
                    ? {
                          ...candidate,
                          position: {
                              x: Math.round(node.position.x),
                              y: Math.round(node.position.y),
                          },
                      }
                    : candidate,
            ),
        });
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div>
                    <p className="text-sm font-semibold">
                        {t(
                            'settings.companion.dialogues.flow_title',
                            'Conversation flow',
                        )}
                    </p>
                    <p className="truncate text-xs text-[var(--settings-muted-text)]">
                        {t(
                            'settings.companion.dialogues.flow_description',
                            'Connect handles to shape the companion conversation. Click an edge to remove it.',
                        )}
                    </p>
                </div>
                <Button onClick={openCreate} size="sm" type="button" variant="secondary">
                    <Plus className="size-4" />
                    {t('settings.companion.dialogues.add_node', 'Add node')}
                </Button>
            </div>
            {editorError ? (
                <p className="shrink-0 rounded-md border border-red-400/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                    {editorError}
                </p>
            ) : null}
            <div className="relative min-h-[8rem] flex-1 overflow-hidden rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-input-background)]">
                <ReactFlow
                    colorMode={resolvedAppearance}
                    edges={edges}
                    fitView
                    fitViewOptions={{ padding: 0.08 }}
                    maxZoom={1.5}
                    minZoom={0.72}
                    nodeTypes={nodeTypes}
                    nodes={nodes}
                    onConnect={connect}
                    onEdgeClick={(_, edge) =>
                        setPendingEdge(edge as CompanionFlowEdge)
                    }
                    onEdgesChange={onEdgesChange}
                    onNodeDragStop={(_, node) =>
                        updatePosition(node as CompanionFlowNode)
                    }
                    onNodesChange={onNodesChange}
                >
                    <Background gap={24} />
                    <Controls />
                </ReactFlow>
            </div>

            <CompanionNodeDialog
                editing={Boolean(editingNode)}
                form={form}
                onChange={setForm}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreating(false);
                        setEditingNode(null);
                    }
                }}
                onSave={saveNode}
                open={creating || Boolean(editingNode)}
            />
            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingEdge(null);
                    }
                }}
                open={Boolean(pendingEdge)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'settings.companion.dialogues.remove_connection_title',
                                'Remove connection?',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'settings.companion.dialogues.remove_connection_description',
                                'The source node will keep its content, but it will no longer lead to the connected node.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            onClick={() => setPendingEdge(null)}
                            type="button"
                            variant="outline"
                        >
                            {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button
                            onClick={removeEdge}
                            type="button"
                            variant="destructive"
                        >
                            <Trash2 className="size-4" />
                            {t(
                                'settings.companion.dialogues.remove_connection',
                                'Remove connection',
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CompanionNodeDialog({
    editing,
    form,
    onChange,
    onOpenChange,
    onSave,
    open,
}: {
    editing: boolean;
    form: CompanionNodeForm;
    onChange: (form: CompanionNodeForm) => void;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    open: boolean;
}) {
    const t = usePlatformTranslation();
    const update = <K extends keyof CompanionNodeForm>(
        key: K,
        value: CompanionNodeForm[K],
    ) => onChange({ ...form, [key]: value });

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-h-[calc(100svh-3rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {editing
                            ? t(
                                  'settings.companion.dialogues.edit_node',
                                  'Edit dialogue node',
                              )
                            : t(
                                  'settings.companion.dialogues.add_node_title',
                                  'Add dialogue node',
                              )}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'settings.companion.dialogues.node_description',
                            'Define the node content here, then connect it visually on the graph.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr]">
                        <div className="grid gap-2">
                            <Label htmlFor="companion-node-id">
                                {t('settings.companion.dialogues.node_id', 'Node id')}
                            </Label>
                            <Input
                                id="companion-node-id"
                                maxLength={80}
                                onChange={(event) =>
                                    update('id', event.target.value)
                                }
                                value={form.id}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="companion-node-title">
                                {t('settings.companion.dialogues.node_title', 'Node title')}
                            </Label>
                            <Input
                                id="companion-node-title"
                                maxLength={120}
                                onChange={(event) =>
                                    update('title', event.target.value)
                                }
                                value={form.title}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="companion-node-type">
                            {t('settings.companion.dialogues.node_type', 'Node type')}
                        </Label>
                        <select
                            className="h-10 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                            id="companion-node-type"
                            onChange={(event) =>
                                update(
                                    'type',
                                    event.target.value as CompanionDialogueNodeType,
                                )
                            }
                            value={form.type}
                        >
                            <option value="message">Message</option>
                            <option value="choice">Choice</option>
                            <option value="ai">AI response</option>
                            <option value="end">End</option>
                        </select>
                    </div>

                    {['message', 'end'].includes(form.type) ? (
                        <div className="grid gap-2">
                            <Label htmlFor="companion-node-message">
                                {t('settings.companion.dialogues.message', 'Message')}
                            </Label>
                            <textarea
                                className="min-h-28 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                                id="companion-node-message"
                                maxLength={2000}
                                onChange={(event) =>
                                    update('message', event.target.value)
                                }
                                value={form.message}
                            />
                        </div>
                    ) : null}

                    {form.type === 'choice' ? (
                        <div className="grid gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="companion-node-prompt">
                                    {t('settings.companion.dialogues.prompt', 'Prompt')}
                                </Label>
                                <Input
                                    id="companion-node-prompt"
                                    maxLength={1000}
                                    onChange={(event) =>
                                        update('prompt', event.target.value)
                                    }
                                    value={form.prompt}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium">
                                        {t(
                                            'settings.companion.dialogues.choices',
                                            'Choices',
                                        )}
                                    </p>
                                    <p className="text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.companion.dialogues.choices_description',
                                            'Connect each choice handle to a node, or choose a safe navigation action.',
                                        )}
                                    </p>
                                </div>
                                <Button
                                    onClick={() =>
                                        update('choices', [
                                            ...form.choices,
                                            {
                                                action: 'learning-desk',
                                                key: `choice-${form.choices.length + 1}`,
                                                label: 'New choice',
                                                next: null,
                                            },
                                        ])
                                    }
                                    size="sm"
                                    type="button"
                                    variant="secondary"
                                >
                                    <Plus className="size-4" />
                                    {t('settings.companion.dialogues.add_choice', 'Add choice')}
                                </Button>
                            </div>
                            {form.choices.map((choice, index) => (
                                <div
                                    className="grid gap-2 rounded-md border border-[var(--settings-border-color)] p-3 sm:grid-cols-[8rem_1fr_auto]"
                                    key={`${choice.key}-${index}`}
                                >
                                    <Input
                                        aria-label={`Choice ${index + 1} key`}
                                        maxLength={80}
                                        onChange={(event) =>
                                            update(
                                                'choices',
                                                updateChoice(form.choices, index, {
                                                    key: event.target.value,
                                                }),
                                            )
                                        }
                                        value={choice.key}
                                    />
                                    <Input
                                        aria-label={`Choice ${index + 1} label`}
                                        maxLength={240}
                                        onChange={(event) =>
                                            update(
                                                'choices',
                                                updateChoice(form.choices, index, {
                                                    label: event.target.value,
                                                }),
                                            )
                                        }
                                        value={choice.label}
                                    />
                                    <Button
                                        aria-label={`Remove choice ${index + 1}`}
                                        onClick={() =>
                                            update(
                                                'choices',
                                                form.choices.filter(
                                                    (_, choiceIndex) => choiceIndex !== index,
                                                ),
                                            )
                                        }
                                        size="icon"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                    <select
                                        aria-label={`Choice ${index + 1} action`}
                                        className="h-9 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-2 text-xs sm:col-span-2"
                                        onChange={(event) =>
                                            update(
                                                'choices',
                                                updateChoice(form.choices, index, {
                                                    action: event.target.value,
                                                    next: event.target.value ? null : choice.next,
                                                }),
                                            )
                                        }
                                        value={choice.action ?? ''}
                                    >
                                        <option value="">Connect to a graph node</option>
                                        {NAVIGATION_ACTIONS.map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-[var(--settings-muted-text)] sm:col-span-3">
                                        {choice.next
                                            ? `Connected to ${choice.next}`
                                            : choice.action
                                              ? `Uses ${choice.action}`
                                              : 'Connect this choice on the canvas before saving.'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {form.type === 'ai' ? (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="companion-node-instruction">
                                    {t(
                                        'settings.companion.dialogues.instruction',
                                        'AI instruction',
                                    )}
                                </Label>
                                <textarea
                                    className="min-h-24 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                                    id="companion-node-instruction"
                                    maxLength={1000}
                                    onChange={(event) =>
                                        update('instruction', event.target.value)
                                    }
                                    value={form.instruction}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="companion-node-response-mode">
                                    {t(
                                        'settings.companion.dialogues.response_mode',
                                        'Response mode',
                                    )}
                                </Label>
                                <select
                                    className="h-10 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                                    id="companion-node-response-mode"
                                    onChange={(event) =>
                                        update(
                                            'responseMode',
                                            event.target.value as 'choice' | 'message',
                                        )
                                    }
                                    value={form.responseMode}
                                >
                                    <option value="message">Message</option>
                                    <option value="choice">Choice</option>
                                </select>
                            </div>
                            <fieldset className="grid gap-2">
                                <legend className="text-sm font-medium">
                                    {t(
                                        'settings.companion.dialogues.capabilities',
                                        'Allowed context',
                                    )}
                                </legend>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {AI_CAPABILITIES.map(([value, label]) => (
                                        <label
                                            className="flex items-center gap-2 text-xs text-[var(--settings-muted-text)]"
                                            key={value}
                                        >
                                            <input
                                                checked={form.capabilities.includes(value)}
                                                className="size-4 accent-[var(--settings-accent)]"
                                                onChange={(event) =>
                                                    update(
                                                        'capabilities',
                                                        event.target.checked
                                                            ? [...form.capabilities, value]
                                                            : form.capabilities.filter(
                                                                  (capability) =>
                                                                      capability !== value,
                                                              ),
                                                    )
                                                }
                                                type="checkbox"
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        </>
                    ) : null}
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={onSave} type="button">
                        <Pencil className="size-4" />
                        {t('common.save', 'Save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CompanionDialogueNodeCard({
    data,
}: {
    data: CompanionGraphNodeData;
}) {
    const node = data.dialogueNode;
    const outputs = node.type === 'choice'
        ? (node.choices ?? []).map((choice, index) => ({
              id: `choice:${index}`,
              label: choice.label,
          }))
        : node.type === 'end'
          ? []
          : [{ id: 'next', label: 'Next' }];

    return (
        <div className="relative w-64 rounded-xl border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-3 shadow-lg">
            <Handle
                className="!size-3 !border-2 !border-white !bg-[var(--settings-accent)]"
                id="in"
                position={Position.Left}
                type="target"
            />
            {outputs.map((output, index) => (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-[var(--settings-accent)]"
                    id={output.id}
                    key={output.id}
                    position={Position.Right}
                    style={{
                        top: `${((index + 1) / (outputs.length + 1)) * 100}%`,
                    }}
                    title={output.label}
                    type="source"
                />
            ))}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                        {nodeTypeLabel(node.type)}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold">
                        {node.title || node.id}
                    </p>
                </div>
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                    {node.type === 'ai' ? (
                        <Bot className="size-4" />
                    ) : node.type === 'choice' ? (
                        <MessageCircle className="size-4" />
                    ) : node.type === 'end' ? (
                        <CircleStop className="size-4" />
                    ) : (
                        <MessageCircle className="size-4" />
                    )}
                </span>
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--settings-muted-text)]">
                {node.message || node.prompt || node.instruction || 'No content yet.'}
            </p>
            {node.type === 'choice' ? (
                <div className="mt-2 grid gap-1">
                    {(node.choices ?? []).map((choice, index) => (
                        <span
                            className="rounded border border-[var(--settings-border-color)] px-2 py-1 text-xs text-[var(--settings-muted-text)]"
                            key={`${choice.key}-${index}`}
                        >
                            {choice.label || choice.key}
                        </span>
                    ))}
                </div>
            ) : null}
            <div
                className="nodrag nopan mt-3 flex gap-1"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <Button
                    aria-label={`Edit ${node.title || node.id}`}
                    className="h-8 flex-1 px-2 text-xs"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onEdit(node);
                    }}
                    type="button"
                    variant="secondary"
                >
                    <Pencil className="size-3.5" />
                    Edit
                </Button>
                <Button
                    aria-label={`Delete ${node.title || node.id}`}
                    className="h-8 w-8 px-0"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onDelete(node);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <Trash2 className="size-3.5" />
                </Button>
            </div>
        </div>
    );
}

function CompanionStartNode({ data }: { data: CompanionStartNodeData }) {
    return (
        <div className="relative grid w-40 place-items-center rounded-xl border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4 text-center shadow-lg">
            <Handle
                className="!size-3 !border-2 !border-white !bg-[var(--settings-accent)]"
                id="start"
                position={Position.Right}
                type="source"
            />
            <span className="mb-2 grid size-9 place-items-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                <Play className="size-4" />
            </span>
            <p className="text-sm font-semibold">{data.title}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                Connect this to the first companion message.
            </p>
        </div>
    );
}

function buildCompanionNodes(
    graph: CompanionDialogueGraph,
    onEdit: (node: CompanionDialogueNode) => void,
    onDelete: (node: CompanionDialogueNode) => void,
): CompanionFlowNode[] {
    const nodes = graph.nodes.map((node, index) => ({
        ariaLabel: `${nodeTypeLabel(node.type)}: ${node.title || node.id}`,
        data: {
            dialogueNode: node,
            onDelete,
            onEdit,
        },
        id: node.id,
        position:
            node.position ?? {
                x: 160 + (index % 3) * 300,
                y: 40 + Math.floor(index / 3) * 220,
            },
        type: 'companion' as const,
    }));

    const startTarget = graph.nodes.find((node) => node.id === graph.start);
    const startPosition = startTarget?.position ?? { x: 160, y: 40 };

    return [
        {
            ariaLabel: 'Start node. Connect this to the first dialogue node.',
            data: { title: 'Start' },
            id: 'start',
            position: { x: startPosition.x - 300, y: startPosition.y },
            type: 'start' as const,
        },
        ...nodes,
    ];
}

function buildCompanionEdges(graph: CompanionDialogueGraph): CompanionFlowEdge[] {
    const edges: CompanionFlowEdge[] = [];
    const startTarget = graph.nodes.find((node) => node.id === graph.start);

    if (startTarget) {
        edges.push({
            ariaLabel: `Start to ${startTarget.title || startTarget.id}`,
            data: { kind: 'start' },
            id: `start:${startTarget.id}`,
            markerEnd: { type: MarkerType.ArrowClosed },
            source: 'start',
            sourceHandle: 'start',
            style: edgeStyle,
            target: startTarget.id,
            targetHandle: 'in',
        });
    }

    graph.nodes.forEach((node) => {
        if (node.type === 'choice') {
            (node.choices ?? []).forEach((choice, choiceIndex) => {
                const target = graph.nodes.find((candidate) => candidate.id === choice.next);

                if (!target) {
                    return;
                }

                edges.push({
                    ariaLabel: `${node.title || node.id}: ${choice.label} to ${target.title || target.id}`,
                    data: { choiceIndex, kind: 'choice', sourceNodeId: node.id },
                    id: `choice:${node.id}:${choiceIndex}`,
                    label: choice.label,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    source: node.id,
                    sourceHandle: `choice:${choiceIndex}`,
                    style: edgeStyle,
                    target: target.id,
                    targetHandle: 'in',
                });
            });

            return;
        }

        const target = graph.nodes.find((candidate) => candidate.id === node.next);

        if (target) {
            edges.push({
                ariaLabel: `${node.title || node.id} to ${target.title || target.id}`,
                data: { kind: 'next', sourceNodeId: node.id },
                id: `next:${node.id}`,
                label: 'Next',
                markerEnd: { type: MarkerType.ArrowClosed },
                source: node.id,
                sourceHandle: 'next',
                style: edgeStyle,
                target: target.id,
                targetHandle: 'in',
            });
        }
    });

    return edges;
}

function emptyNodeForm(type: CompanionDialogueNodeType): CompanionNodeForm {
    return {
        capabilities: [],
        choices:
            type === 'choice'
                ? [
                      {
                          action: 'learning-desk',
                          key: 'continue',
                          label: 'Continue to the learning desk',
                          next: null,
                      },
                  ]
                : [],
        id: `node-${Date.now()}`,
        instruction: '',
        message: '',
        next: null,
        prompt: '',
        responseMode: 'message',
        title: nodeTypeLabel(type),
        type,
    };
}

function formFromNode(node: CompanionDialogueNode): CompanionNodeForm {
    return {
        capabilities: node.capabilities ?? [],
        choices: node.choices ?? [],
        id: node.id,
        instruction: node.instruction ?? '',
        message: node.message ?? '',
        next: node.next ?? null,
        prompt: node.prompt ?? '',
        responseMode: node.response_mode ?? 'message',
        title: node.title ?? node.id,
        type: node.type,
    };
}

function updateChoice(
    choices: CompanionDialogueChoice[],
    index: number,
    update: Partial<CompanionDialogueChoice>,
): CompanionDialogueChoice[] {
    return choices.map((choice, choiceIndex) =>
        choiceIndex === index ? { ...choice, ...update } : choice,
    );
}

function clearNodeReferences(
    nodes: CompanionDialogueNode[],
    removedId: string,
): CompanionDialogueNode[] {
    return nodes.map((node) => ({
        ...node,
        choices: node.choices?.map((choice) =>
            choice.next === removedId ? { ...choice, next: null } : choice,
        ),
        next: node.next === removedId ? null : node.next,
    }));
}

function renameNodeReferences(
    nodes: CompanionDialogueNode[],
    previousId: string,
    nextId: string,
): CompanionDialogueNode[] {
    return nodes.map((node) => ({
        ...node,
        choices: node.choices?.map((choice) =>
            choice.next === previousId
                ? { ...choice, next: nextId }
                : choice,
        ),
        next: node.next === previousId ? nextId : node.next,
    }));
}

function parseChoiceHandle(handle: string | null | undefined): number | null {
    if (!handle?.startsWith('choice:')) {
        return null;
    }

    const index = Number(handle.slice('choice:'.length));

    return Number.isInteger(index) && index >= 0 ? index : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isCompanionNodeType(value: unknown): value is CompanionDialogueNodeType {
    return ['ai', 'choice', 'end', 'message'].includes(value as string);
}

function nodeTypeLabel(type: CompanionDialogueNodeType): string {
    return {
        ai: 'AI response',
        choice: 'Choice',
        end: 'End',
        message: 'Message',
    }[type];
}
