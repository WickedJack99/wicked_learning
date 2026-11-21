import { apiClient, getCsrfToken } from './api/client';
import type { components, operations } from './api/schema';
import { JsonRequestError } from './json-request-error';

type Companion = components['schemas']['LearnerCompanion'];
type ContextQuery = NonNullable<operations['getLearnerCompanion']['parameters']['query']>;
type Turn = components['schemas']['CreateLearnerCompanionTurnRequest'];

// The copied control receives the complete projection, with opaque Rust IDs.
// Keep its authorized query beside that object, not in fabricated source props
// or mutable global "current map" state. Server authorization still owns turns.
const contexts = new WeakMap<object, { document: Companion; query: ContextQuery; lifetime: AbortController }>();

export function toSourceCompanion(document: Companion, query: ContextQuery) {
    if (document.context.surface !== query.surface) {
        throw new JsonRequestError('The Companion context is unavailable.', 409);
    }
    const companion = {
        avatarColor: document.avatar_color,
        avatarPositionX: document.avatar_position_x,
        avatarPositionY: document.avatar_position_y,
        avatarScale: document.avatar_scale,
        avatarUrl: document.avatar_url,
        configuration: {
            aiEnabled: document.configuration.ai_enabled,
            mode: document.configuration.mode,
            sourceScope: document.configuration.source_scope,
        },
        context: {
            actions: document.context.actions,
            activity: document.context.activity,
            map: document.context.map,
            node: document.context.node,
            playRunId: document.context.play_run_id,
            postAttemptAvailable: document.context.post_attempt_available,
            route: document.context.route,
            surface: document.context.surface,
            topic: document.context.topic,
            world: document.context.world,
        },
        dialogue: document.dialogue,
        displayName: document.display_name,
        enabled: true,
        message: document.message,
    };
    contexts.set(companion, { document, query: { ...query }, lifetime: new AbortController() });
    return companion;
}

/** A player activity change retires its old projection, including pending
 * turns. It does not turn a failed replacement read into a disabled Companion. */
export function releaseCompanion(companion: object | null) {
    if (!companion) return;
    contexts.get(companion)?.lifetime.abort();
    contexts.delete(companion);
}

export async function loadCompanion(query: ContextQuery, signal?: AbortSignal) {
    const { data, error, response } = await apiClient.GET('/learner/companion', { params: { query }, signal });
    if (response.status === 204) return null;
    if (!response.ok || !data) {
        throw new JsonRequestError(problemTitle(error) ?? 'The Companion context is unavailable.', response.status);
    }
    return toSourceCompanion(data, query);
}

/** Only the copied dialogue's one POST is bound to this adapter by Vite. */
export async function companionFetch(companion: object, input: string, init: RequestInit): Promise<Response> {
    const context = contexts.get(companion);
    if (input !== '/learning/companion/turn' || init.method !== 'POST' || !context || typeof init.body !== 'string') {
        return failure('The Companion context is unavailable. Refresh the page and try again.', 409);
    }
    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(init.body);
    } catch {
        return failure('The Companion request is invalid.', 400);
    }
    const { document, query } = context;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
        || Object.keys(payload).some((key) => !['activity_id', 'assistance_level', 'dialogue_node_id', 'map_id', 'node_id', 'play_run_id', 'surface'].includes(key))
        || payload.surface !== document.context.surface
        || payload.map_id !== (document.context.map?.id ?? undefined)
        || payload.node_id !== (document.context.node?.id ?? undefined)
        || payload.activity_id !== (document.context.activity?.id ?? undefined)
        || payload.play_run_id !== (document.context.play_run_id ?? undefined)
        || typeof payload.dialogue_node_id !== 'string'
        || !document.dialogue?.nodes.some((node) => node.id === payload.dialogue_node_id && node.type === 'ai')
        || !isAssistance(payload.assistance_level)) {
        return failure('The Companion request does not match its current context.', 409);
    }
    const body: Turn = {
        surface: query.surface,
        map_slug: query.map_slug,
        activity_id: document.context.activity?.id,
        play_run_id: document.context.play_run_id ?? undefined,
        dialogue_node_id: payload.dialogue_node_id,
        assistance_level: payload.assistance_level,
    };
    const csrf = await getCsrfToken();
    if (context.lifetime.signal.aborted) return failure('The Companion context has changed. Try again after it reconnects.', 409);
    const { data, error, response } = await apiClient.POST('/learner/companion/turn', {
        params: { header: { 'X-CSRF-Token': csrf } },
        body,
        signal: init.signal ? AbortSignal.any([init.signal, context.lifetime.signal]) : context.lifetime.signal,
    });
    if (context.lifetime.signal.aborted) return failure('The Companion context has changed. Try again after it reconnects.', 409);
    if (!response.ok || !data) {
        return failure(problemTitle(error) ?? 'The companion could not answer this turn. You can continue exploring without it.', response.status);
    }
    return Response.json(data, { status: response.status });
}

function isAssistance(value: unknown): value is Turn['assistance_level'] {
    return value === 'off' || value === 'question' || value === 'hint' || value === 'post-attempt';
}

function failure(message: string, status: number) {
    return Response.json({ message }, { status });
}

function problemTitle(error: unknown): string | undefined {
    return error && typeof error === 'object' && 'title' in error && typeof error.title === 'string'
        ? error.title : undefined;
}
