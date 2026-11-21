import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import { completePlaybackActivity } from './playback-completion';
import { playbackContext, playbackIdentity } from './playback-context';

const sourcePath = /^\/learning\/activities\/([a-f0-9-]+)\/messages(?:\/([a-f0-9-]+)\/responses(?:\/([a-f0-9-]+)\/helpfulness)?)?$/;
const types = ['message_prompt', 'message_wall'];

/** Only the exact copied component's transport URLs acquire its actual run. */
export function scopedMessageUrl(url: string, run: unknown) {
    if (!isPlaybackMessageUrl(url)) return unavailable(501);
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set('play_run_id', playbackIdentity(run));
    return parsed.pathname + parsed.search;
}

export function isPlaybackMessageUrl(url: string) {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && !parsed.hash && sourcePath.test(parsed.pathname);
}

function parameters(url: string) {
    if (!isPlaybackMessageUrl(url)) return unavailable(501);
    const parsed = new URL(url, window.location.origin);
    if ([...parsed.searchParams.keys()].some((key) => !['play_run_id', 'page', 'per_page'].includes(key) || parsed.searchParams.getAll(key).length !== 1)) return unavailable(400);
    const [, activity, message, response] = sourcePath.exec(parsed.pathname)!;
    const context = playbackContext(parsed.searchParams.get('play_run_id'), activity, types);
    return { parsed, context, message: message ? playbackIdentity(message) : undefined, response: response ? playbackIdentity(response) : undefined,
        path: { play_run_id: context.run, activity_slug: `id:${context.id}` } };
}

export async function playbackMessageRead(url: string, signal?: AbortSignal) {
    const { parsed, context, message, path } = parameters(url);
    if (message) return unavailable(501);
    if (context.activity.activity_type === 'message_wall') {
        const page = positiveInteger(parsed.searchParams.get('page') ?? '1', 1000);
        const per_page = positiveInteger(parsed.searchParams.get('per_page') ?? '12', 12);
        return wall(successful(await apiClient.GET('/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall', { params: { path, query: { page, per_page } }, signal })));
    }
    if (parsed.searchParams.has('page') || parsed.searchParams.has('per_page')) return unavailable(400);
    if (context.activity.config.messageAudience === 'support') {
        return support(successful(await apiClient.GET('/learner/play-runs/{play_run_id}/activities/{activity_slug}/support-request', { params: { path }, signal })));
    }
    if (context.activity.config.messageAudience !== 'peers') return unavailable(409);
    return prompt(successful(await apiClient.GET('/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-message', { params: { path }, signal })));
}

export async function playbackMessageWrite(method: 'POST' | 'PATCH', url: string, payload: Record<string, unknown>) {
    const { parsed, context, message, response, path } = parameters(url);
    if (parsed.searchParams.has('page') || parsed.searchParams.has('per_page')) return unavailable(400);
    const header = { 'X-CSRF-Token': await getCsrfToken() };
    if (message) {
        if (context.activity.activity_type !== 'message_wall') return unavailable(409);
        if (response && method === 'PATCH') {
            if (typeof payload.helpful !== 'boolean') return unavailable(400);
            return successful(await apiClient.PATCH('/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall/messages/{message_id}/responses/{response_id}/helpfulness', {
                params: { path: { ...path, message_id: message, response_id: response }, header }, body: { helpful: payload.helpful },
            }));
        }
        if (response || method !== 'POST') return unavailable(501);
        const responseType = payload.response_type;
        if (responseType !== undefined && responseType !== 'explanation' && responseType !== 'example' && responseType !== 'question' && responseType !== 'counterexample') return unavailable(400);
        return wall(successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall/messages/{message_id}/responses', {
            params: { path: { ...path, message_id: message }, header }, body: { body: body(payload.body), response_type: responseType },
        })));
    }
    if (method !== 'POST' || context.activity.activity_type !== 'message_prompt') return unavailable(409);
    if (context.activity.config.messageAudience === 'support') {
        return support(successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/support-request', { params: { path, header }, body: { body: body(payload.body) } })));
    }
    if (context.activity.config.messageAudience !== 'peers') return unavailable(409);
    return prompt(successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-message', { params: { path, header }, body: { body: body(payload.body) } })));
}

export function completeMessageActivity(activity: unknown, run: unknown) {
    return completePlaybackActivity(playbackContext(run, activity, types), {});
}

// Project exactly the fields consumed by each whole copied control. The prompt
// never reads pagination or a topic ID; do not invent those unused values.
function prompt(value: components['schemas']['LearnerPeerMessagePromptState']) {
    return { hasContributed: value.has_contributed, topic: { title: value.topic_title } };
}
function support(value: components['schemas']['LearnerSupportRequestState']) {
    return { ...prompt(value), messages: value.message ? [{ id: value.message.id, body: value.message.body,
        responses: value.message.responses.map((reply) => ({ id: reply.id, body: reply.body })),
    }] : [] };
}
function wall(value: components['schemas']['LearnerPeerMessageWall']) {
    return { ...prompt(value), pagination: { currentPage: value.pagination.current_page, lastPage: value.pagination.last_page,
        perPage: value.pagination.per_page, total: value.pagination.total },
        messages: value.messages.map((message) => ({ id: message.id, body: message.body, canRespond: message.can_respond,
            hasResponded: message.has_responded, responses: message.responses.map((reply) => ({ id: reply.id, body: reply.body,
                responseType: reply.response_type, canMarkHelpful: reply.can_mark_helpful, isHelpful: reply.is_helpful })),
        })),
    };
}
function body(value: unknown) {
    if (typeof value !== 'string' || [...value.trim()].length < 2 || [...value.trim()].length > 280) return unavailable(400);
    return value.trim();
}
function positiveInteger(value: string, maximum: number) {
    if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum) return unavailable(400);
    return Number(value);
}
function successful<T>(result: { response: Response; data?: T }): T {
    if (!result.response.ok || result.data === undefined) return unavailable(result.response.status);
    return result.data;
}
function unavailable(status: number): never { throw new JsonRequestError('The message action is currently unavailable.', status); }
