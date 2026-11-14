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
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { usePlatformTranslation } from './original-platform-translation';
import { MediaPicker } from './original-world-builder';

type DialogueGraph = components['schemas']['AdminNpcDialogueGraph'];
type DialogueNode = components['schemas']['AdminNpcDialogueNode'];
type DialogueType = DialogueNode['node_type'];
type EditableTool = components['schemas']['AdminEditableTool'];
type Config = Record<string, unknown>;
type EditorNode = Node<{ node?: DialogueNode; kind: 'start' }, 'dialogue' | 'start'>;

const nodeTypes = { dialogue: DialogueCard, start: StartCard };

/**
 * Source-adapted from the Laravel NPC dialogue graph workspace: dialogue
 * cards live in their own React Flow canvas rather than being flattened into
 * the surrounding activity graph.
 */
export function OriginalNpcDialogueEditor({
    activityId,
    nodeId,
    tools,
    onClose,
}: {
    activityId?: string;
    nodeId: string;
    tools: EditableTool[];
    onClose: () => void;
}) {
    const t = usePlatformTranslation();
    const [createdActivityId, setCreatedActivityId] = useState(activityId);
    const [graph, setGraph] = useState<DialogueGraph | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('NPC dialogue');
    const [newSlug, setNewSlug] = useState('');
    const [newIntroduction, setNewIntroduction] = useState('');
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        if (!createdActivityId) return;
        const { data, response } = await apiClient.GET(
            '/admin/world-builder/activities/{activity_id}/npc-dialogue',
            { params: { path: { activity_id: createdActivityId } } },
        );
        if (!response.ok || !data) throw new Error('dialogue unavailable');
        setGraph(data);
    }, [createdActivityId]);

    useEffect(() => {
        if (!createdActivityId) return;
        setGraph(null);
        setError(null);
        void load().catch(() =>
            setError(
                t(
                    'settings.world_builder.npc_dialogue.load_error',
                    'The dialogue graph could not be loaded.',
                ),
            ),
        );
    }, [createdActivityId, load, t]);

    async function create(): Promise<void> {
        if (!newTitle.trim() || creating) return;
        setCreating(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/nodes/{node_id}/npc-dialogue-activities',
                {
                    body: {
                        title: newTitle.trim(),
                        slug: optional(newSlug),
                        introduction: optional(newIntroduction),
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { node_id: nodeId },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('create dialogue');
            setCreatedActivityId(data.activity_id);
        } catch {
            setError(
                t(
                    'settings.world_builder.npc_dialogue.create_error',
                    'The dialogue could not be created. Check the title and try again.',
                ),
            );
        } finally {
            setCreating(false);
        }
    }

    if (!createdActivityId) {
        return (
            <section
                className="mx-auto max-w-xl p-6"
                data-wl-id="authoring.npc-dialogue.create"
            >
                <button
                    className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
                    onClick={onClose}
                    type="button"
                >
                    <ArrowLeft className="size-4" />
                    {t(
                        'settings.world_builder.npc_dialogue.back_to_graph',
                        'Activity graph',
                    )}
                </button>
                <h2 className="mt-5 text-xl font-semibold">
                    {t(
                        'settings.world_builder.npc_dialogue.new_title',
                        'New NPC dialogue',
                    )}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {t(
                        'settings.world_builder.npc_dialogue.new_description',
                        'Create the dedicated graph first, then add and connect its dialogue cards.',
                    )}
                </p>
                <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                    <TextField
                        label={t('settings.world_builder.npc_dialogue.title_label', 'Title')}
                        onChange={setNewTitle}
                        value={newTitle}
                    />
                    <TextField
                        label={t(
                            'settings.world_builder.npc_dialogue.slug_label',
                            'Slug (optional)',
                        )}
                        onChange={setNewSlug}
                        value={newSlug}
                    />
                    <TextField
                        label={t(
                            'settings.world_builder.npc_dialogue.introduction_label',
                            'Introduction (optional)',
                        )}
                        multiline
                        onChange={setNewIntroduction}
                        value={newIntroduction}
                    />
                    {error ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
                    <div className="flex justify-end gap-2">
                        <button
                            className="rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10"
                            onClick={onClose}
                            type="button"
                        >
                            {t('settings.world_builder.npc_dialogue.cancel', 'Cancel')}
                        </button>
                        <button
                            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950"
                            disabled={creating || !newTitle.trim()}
                            onClick={() => void create()}
                            type="button"
                        >
                            {creating
                                ? t(
                                      'settings.world_builder.npc_dialogue.creating',
                                      'Creating…',
                                  )
                                : t(
                                      'settings.world_builder.npc_dialogue.create',
                                      'Create dialogue',
                                  )}
                        </button>
                    </div>
                </div>
            </section>
        );
    }
    if (!graph) {
        return (
            <p className="p-6 text-sm text-slate-600 dark:text-slate-300">
                {error ??
                    t(
                        'settings.world_builder.npc_dialogue.loading',
                        'Loading NPC dialogue…',
                    )}
            </p>
        );
    }
    return <DialogueCanvas graph={graph} onClose={onClose} onReload={() => void load()} tools={tools} />;
}

function DialogueCanvas({ graph, onClose, onReload, tools }: { graph: DialogueGraph; onClose: () => void; onReload: () => void; tools: EditableTool[] }) {
    const t = usePlatformTranslation();
    const [draft, setDraft] = useState<DialogueNode | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<DialogueNode | null>(null);
    const initialNodes = useMemo<EditorNode[]>(() => [
        { id: 'start', type: 'start', data: { kind: 'start' }, position: graphPosition(graph.activity.graph_layout, -220, 40) },
        ...graph.dialogue_nodes.map((node, index) => ({ id: node.id, type: 'dialogue' as const, data: { kind: 'start' as const, node }, position: node.position.x === null ? { x: 110 + index * 310, y: (index % 2) * 190 } : { x: node.position.x, y: node.position.y ?? 0 } })),
    ], [graph]);
    const initialEdges = useMemo<Edge[]>(() => graph.transitions.map((transition) => ({ id: transition.id, source: transition.from_node_id ?? 'start', sourceHandle: transition.from_node_id ? transition.from_connector : 'start', target: transition.to_node_id, targetHandle: transition.to_connector, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#0f766e', strokeWidth: 2 } })), [graph]);
    const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    useEffect(() => { setNodes(initialNodes); setEdges(initialEdges); }, [initialEdges, initialNodes, setEdges, setNodes]);

    const saveNode = useCallback(async (node: DialogueNode, isNew: boolean) => {
        setSaving(true); setError(null);
        try {
            const token = await getCsrfToken();
            const body = nodeRequest(node);
            const result = isNew
                ? await apiClient.POST('/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes', { body, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: graph.activity.id } } })
                : await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes/{dialogue_node_id}', { body, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: graph.activity.id, dialogue_node_id: node.id } } });
            if (!result.response.ok) throw new Error('save node');
            setDraft(null); setAddOpen(false); onReload();
        } catch { setError(t('settings.world_builder.npc_dialogue.save_node_error', 'The dialogue node could not be saved. Check its settings and try again.')); }
        finally { setSaving(false); }
    }, [graph.activity.id, onReload, t]);

    async function connect(connection: Connection): Promise<void> {
        if (!connection.source || !connection.target || connection.target === 'start') return;
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/admin/world-builder/activities/{activity_id}/npc-dialogue/transitions', {
                body: { from_node_id: connection.source === 'start' ? null : connection.source, to_node_id: connection.target, from_connector: connection.sourceHandle ?? (connection.source === 'start' ? 'out' : 'out'), to_connector: connection.targetHandle ?? 'in' },
                params: { header: { 'X-CSRF-Token': token }, path: { activity_id: graph.activity.id } },
            });
            if (!response.ok) throw new Error('connect');
            onReload();
        } catch { setError(t('settings.world_builder.npc_dialogue.connector_error', 'That connector is unavailable. Each dialogue output can have only one connection.')); }
    }
    async function deleteTransition(id: string): Promise<void> {
        try { const token = await getCsrfToken(); const { response } = await apiClient.DELETE('/admin/world-builder/activities/{activity_id}/npc-dialogue/transitions/{transition_id}', { params: { header: { 'X-CSRF-Token': token }, path: { activity_id: graph.activity.id, transition_id: id } } }); if (!response.ok) throw new Error('delete'); onReload(); } catch { setError(t('settings.world_builder.npc_dialogue.delete_connection_error', 'The connection could not be removed.')); }
    }
    async function deleteNode(): Promise<void> {
        if (!pendingDelete) return;
        setSaving(true);
        try { const token = await getCsrfToken(); const { response } = await apiClient.DELETE('/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes/{dialogue_node_id}', { params: { header: { 'X-CSRF-Token': token }, path: { activity_id: graph.activity.id, dialogue_node_id: pendingDelete.id } } }); if (!response.ok) throw new Error('delete'); setPendingDelete(null); onReload(); } catch { setError(t('settings.world_builder.npc_dialogue.delete_node_error', 'The dialogue node could not be deleted.')); } finally { setSaving(false); }
    }
    async function savePosition(node: EditorNode): Promise<void> {
        try {
            const token = await getCsrfToken();
            if (node.id === 'start') {
                await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/npc-dialogue/graph-layout', { body: { x: Math.round(node.position.x), y: Math.round(node.position.y) }, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: graph.activity.id } } });
            } else if (node.data.node) {
                const changed = { ...node.data.node, position: { x: Math.round(node.position.x), y: Math.round(node.position.y) } };
                await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes/{dialogue_node_id}', { body: nodeRequest(changed), params: { header: { 'X-CSRF-Token': token }, path: { activity_id: graph.activity.id, dialogue_node_id: changed.id } } });
            }
        } catch { setError(t('settings.world_builder.npc_dialogue.position_error', 'The graph position could not be saved.')); }
    }

    return <div className="h-[34rem]" data-wl-id="authoring.npc-dialogue.canvas">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10"><button className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300" onClick={onClose} type="button"><ArrowLeft className="size-4" />{t('settings.world_builder.npc_dialogue.back_to_graph', 'Activity graph')}</button><div><p className="text-xs font-medium tracking-[0.14em] text-teal-700 uppercase dark:text-teal-300">{t('settings.world_builder.npc_dialogue.canvas_label', 'NPC dialogue')}</p><h2 className="text-sm font-semibold">{graph.activity.title}</h2></div><button className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white dark:bg-teal-500 dark:text-slate-950" onClick={() => { setDraft(emptyNode()); setAddOpen(true); }} type="button"><Plus className="size-4" />{t('settings.world_builder.npc_dialogue.add_node', 'Add node')}</button></div>
        {error ? <p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">{error}</p> : null}
        <ReactFlow edges={edges} fitView minZoom={0.12} nodeTypes={nodeTypes} nodes={nodes} onConnect={(connection) => void connect(connection)} onEdgeClick={(_, edge) => void deleteTransition(edge.id)} onEdgesChange={onEdgesChange} onNodeClick={(_, node) => node.data.node && setDraft(node.data.node)} onNodeDragStop={(_, node) => void savePosition(node as EditorNode)} onNodesChange={onNodesChange} proOptions={{ hideAttribution: true }}><Background gap={20} /><Controls /></ReactFlow>
        {(addOpen || draft) ? <NodeDialog graph={graph} node={draft ?? emptyNode()} onClose={() => { setDraft(null); setAddOpen(false); }} onDelete={(node) => { setDraft(null); setAddOpen(false); setPendingDelete(node); }} onSave={(node) => void saveNode(node, addOpen)} saving={saving} tools={tools} /> : null}
        {pendingDelete ? <ConfirmDelete saving={saving} title={pendingDelete.title} onCancel={() => setPendingDelete(null)} onConfirm={() => void deleteNode()} /> : null}
    </div>;
}

function DialogueCard({ data }: { data: { node?: DialogueNode } }) {
    const t = usePlatformTranslation();
    const node = data.node;
    if (!node) return null;
    const outputs = outputConnectors(node, t);
    return <div className="w-72 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-lg dark:border-white/10 dark:bg-slate-950"><Handle className="!size-3 !bg-teal-700" id="in" position={Position.Left} type="target" />{outputs.map((output, index) => <Handle className="!size-3 !bg-teal-700" id={output.id} key={output.id} position={Position.Right} style={{ top: `${((index + 1) / (outputs.length + 1)) * 100}%` }} type="source" />)}<p className="text-xs font-medium tracking-[0.15em] text-teal-700 uppercase dark:text-teal-300">{labelFor(node.node_type, t)}</p><h3 className="mt-2 text-sm font-semibold">{node.title}</h3>{node.node_type === 'end' ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('settings.world_builder.npc_dialogue.end_activity_output', ':connector activity output', { connector: stringConfig(node.config, 'connectorSymbol', 'A') })}</p> : <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{node.body || t('settings.world_builder.npc_dialogue.no_dialogue_text', 'No dialogue text yet.')}</p>}{outputs.length > 1 ? <div className="mt-3 flex flex-wrap gap-1">{outputs.map((output) => <span className="rounded bg-teal-100 px-2 py-1 text-xs text-teal-800 dark:bg-teal-300/10 dark:text-teal-200" key={output.id}>{output.label}</span>)}</div> : null}</div>;
}

function StartCard() { const t = usePlatformTranslation(); return <div className="w-44 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-lg dark:border-white/10 dark:bg-slate-950"><Handle className="!size-3 !bg-teal-700" id="start" position={Position.Right} type="source" /><p className="font-semibold">{t('settings.world_builder.npc_dialogue.start', 'Start')}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('settings.world_builder.npc_dialogue.start_description', 'Connect to the first dialogue node.')}</p></div>; }

function NodeDialog({ graph, node, onClose, onDelete, onSave, saving, tools }: { graph: DialogueGraph; node: DialogueNode; onClose: () => void; onDelete: (node: DialogueNode) => void; onSave: (node: DialogueNode) => void; saving: boolean; tools: EditableTool[] }) {
    const t = usePlatformTranslation();
    const [draft, setDraft] = useState(node);
    const config = draft.config as Config;
    const update = (field: keyof DialogueNode, value: unknown) => setDraft((current) => ({ ...current, [field]: value }));
    const setConfig = (key: string, value: unknown) => setDraft((current) => ({ ...current, config: { ...(current.config as Config), [key]: value } }));
    const isAnswer = draft.node_type === 'answer'; const isEnd = draft.node_type === 'end'; const isReflection = draft.node_type === 'reflection'; const isQuestion = draft.node_type === 'npc_question';
    return <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"><section className="max-h-[90%] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-950"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{node.id ? t('settings.world_builder.npc_dialogue.edit_node', 'Edit dialogue node') : t('settings.world_builder.npc_dialogue.add_node_title', 'Add dialogue node')}</h2><p className="text-sm text-slate-600 dark:text-slate-300">{t('settings.world_builder.npc_dialogue.node_description', 'Source-shaped content, flow and scene settings.')}</p></div>{node.id ? <button className="text-sm text-red-700 dark:text-red-300" onClick={() => onDelete(node)} type="button"><Trash2 className="inline size-4" /> {t('settings.world_builder.npc_dialogue.delete_from_graph', 'Delete from graph')}</button> : null}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><SelectField label={t('settings.world_builder.npc_dialogue.node_type_label', 'Node type')} onChange={(value) => update('node_type', value as DialogueType)} options={[['npc_monologue',t('settings.world_builder.npc_dialogue.node_type_monologue', 'NPC monologue')],['npc_question',t('settings.world_builder.npc_dialogue.node_type_question', 'Question')],['reflection',t('settings.world_builder.npc_dialogue.node_type_reflection', 'Reflection')],['answer',t('settings.world_builder.npc_dialogue.node_type_answer', 'Answer')],['end',t('settings.world_builder.npc_dialogue.node_type_end', 'End node')]]} value={draft.node_type} /><TextField label={t('settings.world_builder.npc_dialogue.title_label', 'Title')} onChange={(value) => update('title', value)} value={draft.title} />{!isEnd ? <TextField label={isAnswer ? t('settings.world_builder.npc_dialogue.answer_text', 'Answer text') : isReflection ? t('settings.world_builder.npc_dialogue.reflection_question', 'Reflection question') : isQuestion ? t('settings.world_builder.npc_dialogue.question_text', 'Question text') : t('settings.world_builder.npc_dialogue.speech_bubble_text', 'Speech bubble text')} multiline onChange={(value) => update('body', value)} value={draft.body ?? ''} /> : null}{isAnswer ? <><TextField label={t('settings.world_builder.npc_dialogue.answer_label', 'Answer label')} onChange={(value) => setConfig('answerLabel', value)} value={stringConfig(config, 'answerLabel', 'A')} /><CheckField checked={booleanConfig(config, 'isCorrect')} label={t('settings.world_builder.npc_dialogue.correct_answer', 'Correct answer')} onChange={(value) => setConfig('isCorrect', value)} /></> : null}{isEnd ? <><TextField label={t('settings.world_builder.npc_dialogue.connector_symbol', 'Connector symbol')} onChange={(value) => setConfig('connectorSymbol', value)} value={stringConfig(config, 'connectorSymbol', 'A')} /><TextField label={t('settings.world_builder.npc_dialogue.connector_color', 'Connector color')} onChange={(value) => setConfig('connectorColor', value)} value={stringConfig(config, 'connectorColor', '#0ea5e9')} /></> : null}{isQuestion ? <NumberField label={t('settings.world_builder.npc_dialogue.answer_output_count', 'Answer output count')} max={12} min={1} onChange={(value) => setConfig('questionOutputCount', value)} value={numberConfig(config, 'questionOutputCount', 2)} /> : null}{!isAnswer && !isEnd && !isReflection ? <SelectField label={t('settings.world_builder.npc_dialogue.tool_grant', 'Tool grant')} onChange={(value) => setConfig('toolId', value || null)} options={[['',t('settings.world_builder.npc_dialogue.no_tool', 'No tool')], ...tools.map((tool) => [tool.slug, tool.title] as [string,string])]} value={stringConfig(config, 'toolId', '')} /> : null}{isReflection ? <><TextField label={t('settings.world_builder.npc_dialogue.journal_topic', 'Journal topic')} onChange={(value) => setConfig('journalTopic', value)} value={stringConfig(config, 'journalTopic', '')} /><TextField label={t('settings.world_builder.npc_dialogue.journal_subtopic', 'Journal subtopic')} onChange={(value) => setConfig('journalSubtopic', value)} value={stringConfig(config, 'journalSubtopic', '')} /></> : null}</div>{isAnswer ? <AnswerEventsEditor config={config} onChange={setConfig} worldNodes={graph.world_nodes} /> : null}{!isAnswer && !isEnd ? <SceneFields config={config} onChange={setConfig} soundSets={graph.typing_sound_sets} /> : null}<div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10"><button className="rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button">{t('settings.world_builder.npc_dialogue.cancel', 'Cancel')}</button><button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={saving || !draft.title.trim()} onClick={() => onSave(draft)} type="button"><Save className="size-4" />{saving ? t('settings.world_builder.npc_dialogue.saving', 'Saving…') : t('settings.world_builder.npc_dialogue.save_node', 'Save node')}</button></div></section></div>;
}

function SceneFields({ config, onChange, soundSets }: { config: Config; onChange: (key: string, value: unknown) => void; soundSets: DialogueGraph['typing_sound_sets'] }) {
    const t = usePlatformTranslation();
    const [pickerKey, setPickerKey] = useState<string | null>(null);
    const label = (key: string, fallback: string) => t(`settings.world_builder.npc_dialogue.scene.${key}`, fallback);
    return <div className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10"><h3 className="font-semibold">{label('title', 'Scene presentation')}</h3><div className="mt-3 grid gap-4 md:grid-cols-2"><ImageField label={label('background_dark', 'Dark background image')} onChange={(value) => onChange('backgroundDark', value)} onPick={() => setPickerKey('backgroundDark')} value={stringConfig(config, 'backgroundDark', '')} /><ImageField label={label('background_light', 'Light background image')} onChange={(value) => onChange('backgroundLight', value)} onPick={() => setPickerKey('backgroundLight')} value={stringConfig(config, 'backgroundLight', '')} /><ImageField label={label('npc_dark', 'Dark NPC image')} onChange={(value) => onChange('npcImageDark', value)} onPick={() => setPickerKey('npcImageDark')} value={stringConfig(config, 'npcImageDark', '')} /><ImageField label={label('npc_light', 'Light NPC image')} onChange={(value) => onChange('npcImageLight', value)} onPick={() => setPickerKey('npcImageLight')} value={stringConfig(config, 'npcImageLight', '')} /><SelectField label={label('slide_direction', 'Slide direction')} onChange={(value) => onChange('slideDirection', value)} options={[['left',label('left', 'Left')],['right',label('right', 'Right')],['top',label('top', 'Top')],['bottom',label('bottom', 'Bottom')],['none',label('none', 'None')]]} value={stringConfig(config, 'slideDirection', 'left')} /><NumberField label={label('slide_duration', 'Slide duration (seconds)')} max={30} min={0} onChange={(value) => onChange('slideDurationSeconds', value)} value={numberConfig(config, 'slideDurationSeconds', 0.6)} /><NumberField label={label('fade_duration', 'Fade duration (seconds)')} max={30} min={0} onChange={(value) => onChange('fadeDurationSeconds', value)} value={numberConfig(config, 'fadeDurationSeconds', 0.4)} /><NumberField label={label('typing_speed', 'Typing speed')} max={250} min={1} onChange={(value) => onChange('typingSpeed', value)} value={numberConfig(config, 'typingSpeed', 28)} /><NumberField label={label('npc_x', 'NPC X position')} max={100} min={0} onChange={(value) => onChange('npcX', value)} value={numberConfig(config, 'npcX', 50)} /><NumberField label={label('npc_y', 'NPC Y position')} max={100} min={0} onChange={(value) => onChange('npcY', value)} value={numberConfig(config, 'npcY', 50)} /><TextField label={label('bubble_dark', 'Dark bubble color')} onChange={(value) => onChange('bubbleColorDark', value)} value={stringConfig(config, 'bubbleColorDark', '#0f172a')} /><TextField label={label('border_dark', 'Dark bubble border')} onChange={(value) => onChange('bubbleBorderColorDark', value)} value={stringConfig(config, 'bubbleBorderColorDark', '#2dd4bf')} /><NumberField label={label('opacity_dark', 'Dark bubble opacity')} max={100} min={0} onChange={(value) => onChange('bubbleOpacityDark', value)} value={numberConfig(config, 'bubbleOpacityDark', 92)} /><TextField label={label('bubble_light', 'Light bubble color')} onChange={(value) => onChange('bubbleColorLight', value)} value={stringConfig(config, 'bubbleColorLight', '#ffffff')} /><TextField label={label('border_light', 'Light bubble border')} onChange={(value) => onChange('bubbleBorderColorLight', value)} value={stringConfig(config, 'bubbleBorderColorLight', '#0891b2')} /><NumberField label={label('opacity_light', 'Light bubble opacity')} max={100} min={0} onChange={(value) => onChange('bubbleOpacityLight', value)} value={numberConfig(config, 'bubbleOpacityLight', 94)} /><SelectField label={label('sound_set', 'Typing sound set')} onChange={(value) => onChange('typingSoundSetId', value || null)} options={[['',label('default_sound_set', 'Use default sound set')], ...soundSets.map((set) => [set.id, `${set.name}${set.is_default ? ` ${label('default', '(default)')}` : ''}`] as [string,string])]} value={stringConfig(config, 'typingSoundSetId', '')} /><CheckField checked={booleanConfig(config, 'typingSoundEnabled')} label={label('typing_sound', 'Enable typing sound')} onChange={(value) => onChange('typingSoundEnabled', value)} /><CheckField checked={booleanConfig(config, 'background_mirrored')} label={label('mirror_background', 'Mirror background')} onChange={(value) => onChange('backgroundMirrored', value)} /><CheckField checked={booleanConfig(config, 'npcImageMirrored')} label={label('mirror_npc', 'Mirror NPC image')} onChange={(value) => onChange('npcImageMirrored', value)} /></div><SceneAssetsEditor assets={sceneAssets(config)} onChange={(assets) => onChange('sceneAssets', assets)} onPick={(index, theme) => setPickerKey(`sceneAssets.${index}.${theme}`)} />{pickerKey ? <MediaPicker onClose={() => setPickerKey(null)} onSelect={(asset) => { applyImageSelection(pickerKey, asset.url, onChange, config); setPickerKey(null); }} /> : null}</div>;
}

type SceneAsset = { id: string; imageDark: string; imageLight: string; label: string; layer: 'behind_npc' | 'front' | 'bubble' | 'overlay'; mirrored: boolean; width: number; x: number; y: number };

function SceneAssetsEditor({ assets, onChange, onPick }: { assets: SceneAsset[]; onChange: (assets: SceneAsset[]) => void; onPick: (index: number, theme: 'imageDark' | 'imageLight') => void }) {
    const t = usePlatformTranslation();
    const replace = (index: number, asset: SceneAsset) => onChange(assets.map((candidate, candidateIndex) => candidateIndex === index ? asset : candidate));
    const label = (key: string, fallback: string) => t(`settings.world_builder.npc_dialogue.scene_assets.${key}`, fallback);
    return <section className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{label('title', 'Additional scene assets')}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{label('description', 'Layer props, scenery and bubble details into this dialogue scene.')}</p></div><button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-white/20" disabled={assets.length >= 20} onClick={() => onChange([...assets, emptySceneAsset(assets.length)])} type="button"><Plus className="size-4" />{label('add', 'Add asset')}</button></div>{assets.length === 0 ? <p className="mt-3 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-white/20 dark:text-slate-400">{label('empty', 'No extra assets yet.')}</p> : null}<div className="mt-3 grid gap-3">{assets.map((asset, index) => <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10" key={asset.id}><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{label('asset', 'Asset')} {index + 1}</p><button className="text-sm text-red-700 dark:text-red-300" onClick={() => onChange(assets.filter((_, candidateIndex) => candidateIndex !== index))} type="button">{label('remove', 'Remove')}</button></div><div className="mt-3 grid gap-3 md:grid-cols-2"><TextField label={label('label', 'Label')} onChange={(value) => replace(index, { ...asset, label: value })} value={asset.label} /><SelectField label={label('layer', 'Layer')} onChange={(value) => replace(index, { ...asset, layer: value as SceneAsset['layer'] })} options={[['behind_npc', label('behind_npc', 'Behind NPC')], ['front', label('front', 'In front of NPC')], ['bubble', label('bubble', 'Around speech bubble')], ['overlay', label('overlay', 'Above everything')]]} value={asset.layer} /><ImageField label={label('image_dark', 'Dark image')} onChange={(value) => replace(index, { ...asset, imageDark: value })} onPick={() => onPick(index, 'imageDark')} value={asset.imageDark} /><ImageField label={label('image_light', 'Light image')} onChange={(value) => replace(index, { ...asset, imageLight: value })} onPick={() => onPick(index, 'imageLight')} value={asset.imageLight} /><NumberField label={label('x', 'X position')} max={100} min={0} onChange={(value) => replace(index, { ...asset, x: value })} value={asset.x} /><NumberField label={label('y', 'Y position')} max={100} min={0} onChange={(value) => replace(index, { ...asset, y: value })} value={asset.y} /><NumberField label={label('width', 'Width')} max={100} min={1} onChange={(value) => replace(index, { ...asset, width: value })} value={asset.width} /><CheckField checked={asset.mirrored} label={label('mirror', 'Mirror horizontally')} onChange={(value) => replace(index, { ...asset, mirrored: value })} /></div></div>)}</div></section>;
}

function AnswerEventsEditor({ config, onChange, worldNodes }: { config: Config; onChange: (key: string, value: unknown) => void; worldNodes: DialogueGraph['world_nodes'] }) {
    const t = usePlatformTranslation();
    const events = eventsConfig(config.events);
    const update = (key: 'hideNodeIds' | 'unlockNodeIds', value: string) => {
        if (!value || events[key].includes(value)) return;
        onChange('events', { ...events, [key]: [...events[key], value] });
    };
    const remove = (key: 'hideNodeIds' | 'unlockNodeIds', value: string) => onChange('events', { ...events, [key]: events[key].filter((id) => id !== value) });
    const label = (key: string, fallback: string) => t(`settings.world_builder.npc_dialogue.answer_events.${key}`, fallback);
    return <section className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10"><h3 className="font-semibold">{label('title', 'Answer events')}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{label('description', 'Optional learner-specific world changes applied when this answer is chosen.')}</p><div className="mt-3 grid gap-4 md:grid-cols-2">{([['hideNodeIds', label('hide_nodes', 'Hide nodes'), label('hide_description', 'Selected nodes become hidden for this learner.')], ['unlockNodeIds', label('unlock_nodes', 'Unlock nodes'), label('unlock_description', 'Selected locked nodes become available for this learner.')]] as const).map(([key, eventLabel, description]) => <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10" key={key}><label className="grid gap-1 text-sm"><span>{eventLabel}</span><span className="text-xs text-slate-500 dark:text-slate-400">{description}</span><select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" defaultValue="" onChange={(event) => { update(key, event.target.value); event.currentTarget.value = ''; }}><option value="">{t('settings.world_builder.npc_dialogue.add_node', 'Add node')}</option>{worldNodes.map((worldNode) => <option disabled={events[key].includes(worldNode.id)} key={worldNode.id} value={worldNode.id}>{worldNode.title} — {worldNode.map_title}</option>)}</select></label><div className="mt-2 flex flex-wrap gap-2">{events[key].length === 0 ? <span className="text-xs text-slate-500 dark:text-slate-400">{label('empty', 'No nodes selected.')}</span> : events[key].map((id) => { const worldNode = worldNodes.find((candidate) => candidate.id === id); return <button className="rounded-full border border-teal-300 px-2 py-1 text-xs text-teal-800 dark:border-teal-300/40 dark:text-teal-200" key={id} onClick={() => remove(key, id)} type="button">{worldNode ? `${worldNode.title} — ${worldNode.map_title}` : label('unavailable', 'Unavailable node')} ×</button>; })}</div></div>)}</div></section>;
}

function ConfirmDelete({ title, saving, onCancel, onConfirm }: { title: string; saving: boolean; onCancel: () => void; onConfirm: () => void }) { const t = usePlatformTranslation(); return <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-950"><h2 className="font-semibold">{t('settings.world_builder.npc_dialogue.confirm_delete_title', 'Delete :title?', { title })}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('settings.world_builder.npc_dialogue.confirm_delete_description', 'This removes its dialogue graph connections too.')}</p><div className="mt-5 flex justify-end gap-2"><button className="rounded-md px-3 py-2 text-sm" onClick={onCancel} type="button">{t('settings.world_builder.npc_dialogue.cancel', 'Cancel')}</button><button className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} onClick={onConfirm} type="button">{t('settings.world_builder.npc_dialogue.delete', 'Delete')}</button></div></section></div>; }

function outputConnectors(node: DialogueNode, t: Translate): Array<{ id: string; label: string }> { if (node.node_type === 'end') return []; if (node.node_type === 'npc_question') return Array.from({ length: Math.max(1, Math.min(12, numberConfig(node.config as Config, 'questionOutputCount', 2))) }, (_, index) => ({ id: `answer-${index + 1}`, label: t('settings.world_builder.npc_dialogue.answer_output', 'Answer :number', { number: index + 1 }) })); return [{ id: 'out', label: t('settings.world_builder.npc_dialogue.out', 'Out') }]; }
function emptyNode(): DialogueNode { return { id: '', node_type: 'npc_monologue', title: 'NPC monologue', body: '', config: defaultConfig(), position: { x: null, y: null } }; }
function defaultConfig(): Config { return { backgroundDark: '', backgroundLight: '', backgroundMirrored: false, sceneAssets: [], npcImageDark: '', npcImageLight: '', npcImageMirrored: false, slideDirection: 'left', slideDurationSeconds: 0.6, fadeDurationSeconds: 0.4, npcX: 50, npcY: 50, toolId: null, questionOutputCount: 2, journalTopic: '', journalSubtopic: '', typingSpeed: 28, typingSoundEnabled: false, typingSoundSetId: null, bubbleColorDark: '#0f172a', bubbleBorderColorDark: '#2dd4bf', bubbleOpacityDark: 92, bubbleColorLight: '#ffffff', bubbleBorderColorLight: '#0891b2', bubbleOpacityLight: 94 }; }
function sceneAssets(value: Config): SceneAsset[] { const raw = value.sceneAssets; if (!Array.isArray(raw)) return []; return raw.flatMap((asset, index) => { if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return []; const record = asset as Config; const layer = stringConfig(record, 'layer', 'front'); if (!['behind_npc', 'front', 'bubble', 'overlay'].includes(layer)) return []; return [{ id: stringConfig(record, 'id', `asset-${index + 1}`), imageDark: stringConfig(record, 'imageDark', ''), imageLight: stringConfig(record, 'imageLight', ''), label: stringConfig(record, 'label', ''), layer: layer as SceneAsset['layer'], mirrored: booleanConfig(record, 'mirrored'), width: numberConfig(record, 'width', 24), x: numberConfig(record, 'x', 50), y: numberConfig(record, 'y', 50) }]; }); }
function emptySceneAsset(index: number): SceneAsset { return { id: `scene-${Date.now()}-${index + 1}`, imageDark: '', imageLight: '', label: `Asset ${index + 1}`, layer: 'front', mirrored: false, width: 24, x: 50, y: 50 }; }
function applyImageSelection(key: string, url: string, onChange: (key: string, value: unknown) => void, config: Config): void { const sceneAsset = /^sceneAssets\.(\d+)\.(imageDark|imageLight)$/.exec(key); if (!sceneAsset) { onChange(key, url); return; } const index = Number(sceneAsset[1]); const field = sceneAsset[2] as 'imageDark' | 'imageLight'; const assets = sceneAssets(config); const asset = assets[index]; if (!asset) return; assets[index] = { ...asset, [field]: url }; onChange('sceneAssets', assets); }
function eventsConfig(value: unknown): { hideNodeIds: string[]; unlockNodeIds: string[] } { if (!value || typeof value !== 'object' || Array.isArray(value)) return { hideNodeIds: [], unlockNodeIds: [] }; const events = value as Config; const ids = (key: string) => Array.isArray(events[key]) ? events[key].filter((candidate): candidate is string => typeof candidate === 'string') : []; return { hideNodeIds: ids('hideNodeIds'), unlockNodeIds: ids('unlockNodeIds') }; }
function nodeRequest(node: DialogueNode): components['schemas']['AdminNpcDialogueNodeRequest'] { return { node_type: node.node_type, title: node.title, body: node.body, config: node.config, position: node.position.x === null ? null : { x: node.position.x, y: node.position.y ?? 0 } }; }
function graphPosition(value: Record<string, unknown>, x: number, y: number): { x: number; y: number } { const start = value.start; return start && typeof start === 'object' && !Array.isArray(start) && typeof (start as Config).x === 'number' && typeof (start as Config).y === 'number' ? { x: (start as Config).x as number, y: (start as Config).y as number } : { x, y }; }
type Translate = (key: string, fallback?: string, replacements?: Record<string, number | string>) => string;
function labelFor(type: DialogueType, t: Translate): string { return ({ npc_monologue: t('settings.world_builder.npc_dialogue.node_type_monologue', 'NPC monologue'), npc_question: t('settings.world_builder.npc_dialogue.node_type_question', 'Question'), reflection: t('settings.world_builder.npc_dialogue.node_type_reflection', 'Reflection'), answer: t('settings.world_builder.npc_dialogue.node_type_answer', 'Answer'), end: t('settings.world_builder.npc_dialogue.node_type_end', 'End node') })[type]; }
function stringConfig(config: Config, key: string, fallback: string): string { return typeof config[key] === 'string' ? config[key] as string : fallback; }
function numberConfig(config: Config, key: string, fallback: number): number { return typeof config[key] === 'number' && Number.isFinite(config[key]) ? config[key] as number : fallback; }
function booleanConfig(config: Config, key: string): boolean { return config[key] === true; }
function optional(value: string): string | null { const trimmed = value.trim(); return trimmed || null; }
function TextField({ label, multiline = false, onChange, value }: { label: string; multiline?: boolean; onChange: (value: string) => void; value: string }) { return <label className="grid gap-1 text-sm"><span>{label}</span>{multiline ? <textarea className="min-h-24 rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => onChange(event.target.value)} value={value} /> : <input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => onChange(event.target.value)} value={value} />}</label>; }
function ImageField({ label, onChange, onPick, value }: { label: string; onChange: (value: string) => void; onPick: () => void; value: string }) { return <div className="grid gap-1 text-sm"><span>{label}</span><div className="flex gap-2"><input className="min-w-0 flex-1 rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => onChange(event.target.value)} value={value} /><button className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-white/20" onClick={onPick} type="button">Select</button></div></div>; }
function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string,string]>; value: string }) { return <label className="grid gap-1 text-sm"><span>{label}</span><select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function NumberField({ label, max, min, onChange, value }: { label: string; max: number; min: number; onChange: (value: number) => void; value: number }) { return <label className="grid gap-1 text-sm"><span>{label}</span><input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} /></label>; }
function CheckField({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 self-end text-sm"><input checked={checked} className="size-4" onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>; }
