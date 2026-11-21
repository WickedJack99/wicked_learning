import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import { completePlaybackActivity } from './playback-completion';
import { playbackContext, playbackIdentity } from './playback-context';
import { toSourcePlaybackTool } from './playback-projection';

type Context = ReturnType<typeof playbackContext>;
type State = components['schemas']['LearnerNpcDialogueState'];
const nodePath = /^\/learning\/npc-dialogue-nodes\/([a-f0-9-]+)\/(grant-tool|answer|reflection)$/;
const statePath = /^\/learning\/activities\/([a-f0-9-]+)\/npc-dialogue-state$/;
type Queue = { tail: Promise<void>; cursorFailure?: unknown };
const queues = new WeakMap<Context['binding'], Map<string, Queue>>();
const cursors = new WeakMap<Context['binding'], Map<string, string>>();

// Only identifier coercions use this helper. Scene dimensions, opacity and
// timing retain the pinned numeric helpers. A missing tool's real slug remains
// unresolved and its node-bound native grant rejects it normally.
export function npcReference(value: unknown) { return typeof value === 'string' && value.length ? value : 0; }
export function scopedNpcUrl(url: string, activity: unknown, run: unknown) {
    return `${url}?activity=${playbackIdentity(activity)}&run=${playbackIdentity(run)}`;
}
export function isPlaybackNpcPost(url: string) {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && !parsed.hash && (nodePath.test(parsed.pathname) || statePath.test(parsed.pathname));
}
function parameters(url: string, payload: Record<string, unknown>) {
    if (!isPlaybackNpcPost(url)) return unavailable(501);
    const parsed = new URL(url, window.location.origin);
    if ([...parsed.searchParams.keys()].some((key) => key !== 'activity' && key !== 'run') ||
        parsed.searchParams.getAll('activity').length !== 1 || parsed.searchParams.getAll('run').length !== 1) return unavailable(400);
    const context = playbackContext(parsed.searchParams.get('run'), parsed.searchParams.get('activity'), ['npc_dialogue']);
    if (payload.play_run_id !== undefined && payload.play_run_id !== context.run) return unavailable(409);
    const node = nodePath.exec(parsed.pathname);
    if (node && !context.activity.presentation.npc_dialogue_nodes.some((entry) => entry.id === node[1])) return unavailable(404);
    if (!node && statePath.exec(parsed.pathname)![1] !== context.id) return unavailable(409);
    return { context, node, path: { play_run_id: context.run, activity_slug: `id:${context.id}` } };
}

export function playbackNpcPost(url: string, payload: Record<string, unknown>) {
    const { context, node, path } = parameters(url, payload);
    return ordered(context, async () => {
        const header = { 'X-CSRF-Token': await getCsrfToken() };
        if (!node) {
            const current_node_id = playbackIdentity(payload.current_node_id);
            if (!Array.isArray(payload.history) || payload.history.length > 40) return unavailable(400);
            const history = payload.history.map(playbackIdentity);
            const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/cursor', {
                params: { path, header }, body: { current_node_id, history },
            }));
            remember(context, result);
            return { state: { currentNodeId: result.current_node_id, history: result.history } };
        }
        const [, nodeId, action] = node;
        if (action === 'grant-tool') {
            const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/nodes/{dialogue_node_id}/grant-tool', {
                params: { path: { ...path, dialogue_node_id: nodeId }, header },
            }));
            remember(context, result);
            if (!result.granted_tool) return unavailable(503);
            return { tool: toSourcePlaybackTool(result.granted_tool) };
        }
        if (action === 'answer') {
            const answer_node_id = playbackIdentity(payload.answer_key);
            const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/answer', {
                params: { path, header }, body: { answer_node_id, expected_node_id: nodeId },
            }));
            remember(context, result);
            if (result.answer.answer_node_id !== answer_node_id) return unavailable(503);
            return { answer: { answerKey: result.answer.answer_key, answerNodeId: result.answer.answer_node_id, feedback: result.answer.feedback, isCorrect: result.answer.is_correct } };
        }
        if (typeof payload.reflection !== 'string') return unavailable(400);
        const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/reflection', {
            params: { path, header }, body: { reflection: payload.reflection, expected_node_id: nodeId },
        }));
        remember(context, result);
        return { state: { currentNodeId: result.current_node_id, history: result.history } };
    }, node === null);
}

export function completeNpcActivity(activity: unknown, run: unknown, options?: { transitionLabel?: string | null }) {
    const context = playbackContext(run, activity, ['npc_dialogue']);
    return ordered(context, async () => {
        const nodes = context.activity.presentation.npc_dialogue_nodes;
        const edges = context.activity.presentation.npc_dialogue_transitions;
        const current = cursors.get(context.binding)?.get(context.id) ??
            context.document.private_state.npc_dialogues.find((entry) => entry.activity_id === context.id)?.current_node_id ??
            edges.find((edge) => edge.from_node_id === null)?.to_node_id ?? nodes.find((node) => !['answer', 'end'].includes(node.node_type))?.id;
        const node = nodes.find((entry) => entry.id === current);
        const next = node?.node_type === 'end' ? node.id : edges.find((edge) => edge.from_node_id === current && edge.from_connector === 'out')?.to_node_id;
        const exit = (next ? context.activity.transitions.find((edge) => edge.from_connector === `dialogue-end-${next}`) : undefined) ?? context.activity.transitions.find((edge) => edge.trigger === 'completed');
        if (options?.transitionLabel !== undefined && options.transitionLabel !== exit?.label) return unavailable(409);
        const completed = await completePlaybackActivity(context, {});
        const expected = context.document.run_kind === 'replay' ? null : exit?.to_activity_id ?? null;
        if (completed.receipt.next_activity_id !== expected) return unavailable(503);
        return completed;
    });
}

function remember(context: Context, state: State) {
    const nodes = new Set(context.activity.presentation.npc_dialogue_nodes.map((node) => node.id));
    if (!nodes.has(state.current_node_id) || state.history.some((id) => !nodes.has(id))) return unavailable(503);
    let values = cursors.get(context.binding);
    if (!values) { values = new Map(); cursors.set(context.binding, values); }
    values.set(context.id, state.current_node_id);
}
function ordered<T>(context: Context, operation: () => Promise<T>, cursorWrite = false): Promise<T> {
    let activities = queues.get(context.binding);
    if (!activities) { activities = new Map(); queues.set(context.binding, activities); }
    let queue = activities.get(context.id);
    if (!queue) { queue = { tail: Promise.resolve() }; activities.set(context.id, queue); }
    const request = queue.tail.then(() => {
        if (queue.cursorFailure !== undefined) throw queue.cursorFailure;
        if (playbackContext(context.run, context.id, ['npc_dialogue']).binding !== context.binding) return unavailable(409);
        return operation();
    });
    // Source moves optimistically only for cursor writes. After a rejected
    // cursor, reload is required before claiming later persistence. Rejected
    // grants/answers/reflections retain source retry/back behavior; their Rust
    // commands independently authorize the unchanged or stale cursor.
    queue.tail = request.then(() => undefined, (error: unknown) => { if (cursorWrite) queue.cursorFailure = error; });
    return request.catch((error: unknown) => {
        window.dispatchEvent(new CustomEvent('world:source-operation-unavailable', { detail: { message: cursorWrite ? 'The dialogue position could not be saved. Reload to resume.' : 'The dialogue action could not be saved.' } }));
        throw error;
    });
}

function successful<T>(result: { response: Response; data?: T }): T {
    if (!result.response.ok || result.data === undefined) return unavailable(result.response.status);
    return result.data;
}
function unavailable(status: number): never { throw new JsonRequestError('The dialogue action is currently unavailable.', status); }
