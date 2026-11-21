import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import { bindPlaybackDocument, playbackContext, playbackIdentity } from './playback-context';
import { completePlaybackActivityOnce } from './playback-completion';
import { completeResponseActivity } from './playback-response-api';
import { completeNpcActivity } from './playback-npc-api';
import { toSourceActivityReceipt } from './playback-projection';
import { completeInputPortal, completeOutputPortal } from './playback-portal-api';

type Playback = components['schemas']['LearnerPlaybackDocument'];
type Page = { document: Playback; reloadCompanion: (activity: string) => Promise<boolean> };
const pages = new Map<string, Page>();
const activityPath = /^\/learning\/activities\/([a-f0-9-]+)\/(progress|translation|check-in)$/;
const bookmarkPath = /^\/learning\/nodes\/([a-f0-9-]+)\/bookmark$/;
const restartPath = /^\/learning\/activity-starts\/([a-f0-9-]+)\/restart$/;

/** Only a mounted whole player owns these source page commands. */
export function bindPlaybackPage(document: Playback, reloadCompanion: Page['reloadCompanion']) {
    const releaseDocument = bindPlaybackDocument(document);
    const page = { document, reloadCompanion };
    pages.set(document.play_run_id, page);
    return () => {
        if (pages.get(document.play_run_id) === page) pages.delete(document.play_run_id);
        releaseDocument();
    };
}

export function playbackHref(document: Playback): string {
    const query = new URLSearchParams({ activity_id: document.activity.id, run: document.play_run_id });
    if (document.start_id) query.set('route', document.start_id);
    if (document.run_kind === 'recall') query.set('recall_question', document.activity.id);
    return `/learning/nodes/${document.node.id}/play?${query}`;
}

export function isPlaybackPageUrl(url: string) {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && !parsed.hash &&
        (activityPath.test(parsed.pathname) || bookmarkPath.test(parsed.pathname) || restartPath.test(parsed.pathname));
}

export async function playbackPageRead(url: string, signal?: AbortSignal) {
    const parsed = checkedUrl(url);
    const match = activityPath.exec(parsed.pathname);
    if (!match || match[2] !== 'translation' || [...parsed.searchParams.keys()].some((key) => key !== 'play_run_id') ||
        parsed.searchParams.getAll('play_run_id').length !== 1) return unavailable(400);
    const context = contextForActivity(match[1], parsed.searchParams.get('play_run_id'));
    return successful(await apiClient.GET('/learner/play-runs/{play_run_id}/activities/{activity_slug}/translation', {
        signal, params: { path: { play_run_id: context.run, activity_slug: `id:${context.id}` } },
    }));
}

export async function playbackPageWrite(method: 'POST' | 'DELETE', url: string, payload: Record<string, unknown> = {}) {
    const parsed = checkedUrl(url);
    if (parsed.search) return unavailable(400);
    const activity = activityPath.exec(parsed.pathname);
    if (activity && method === 'POST') {
        const context = activity[2] === 'check-in'
            ? contextForActivity(activity[1]) : contextForActivity(activity[1], payload.play_run_id);
        const params = { path: { play_run_id: context.run, activity_slug: `id:${context.id}` }, header: { 'X-CSRF-Token': await getCsrfToken() } };
        if (activity[2] === 'check-in') {
            // Recall has no ordinary progress/check-in contract (ADR-037).
            if (context.document.run_kind === 'recall') return unavailable(501);
            const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/check-ins', {
                params, body: checkIn(payload),
            }));
            const progress = toSourceActivityReceipt(result.activity_state, context.activity);
            if (!progress) return unavailable(503);
            return { progress };
        }
        if (activity[2] !== 'progress') return unavailable(400);
        if (payload.status === 'reached') {
            const receipt = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/reach', { params }));
            return { progress: toSourceActivityReceipt(receipt, context.activity) };
        }
        if (payload.status !== 'completed' || payload.is_revisit !== (context.document.run_kind === 'revisit')) return unavailable(400);
        if (context.document.run_kind === 'recall') return unavailable(501);
        if (context.activity.activity_type === 'portal' && context.activity.config.portalMode !== 'input') return completeOutputPortal(context);
        const type = context.activity.activity_type;
        const result = ['question', 'reflection', 'review'].includes(type)
            ? await completeResponseActivity(context.id, context.run, {
                confidence: payload.confidence, confidenceAfterFeedback: payload.confidence_after_feedback, outcome: payload.outcome,
            })
            : type === 'npc_dialogue' ? await completeNpcActivity(context.id, context.run)
                : type === 'portal' ? await completeInputPortal(context) : await completePlaybackActivityOnce(context, {});
        // Rust derives the destination, answer calibration/attempt/outcome,
        // assistance and saved cues. Source display hints cannot overwrite them.
        if (!result.progress) return unavailable(503);
        return { progress: result.progress };
    }
    const bookmark = bookmarkPath.exec(parsed.pathname);
    if (bookmark) {
        const page = uniquePage((document) => document.node.id === playbackIdentity(bookmark[1]));
        const params = { path: { map_slug: page.document.node.map_slug, node_slug: page.document.node.slug }, header: { 'X-CSRF-Token': await getCsrfToken() } };
        const result = successful(method === 'POST'
            ? await apiClient.POST('/learner/maps/{map_slug}/nodes/{node_slug}/bookmark', { params })
            : await apiClient.DELETE('/learner/maps/{map_slug}/nodes/{node_slug}/bookmark', { params }));
        if (result.bookmarked !== (method === 'POST')) return unavailable(503);
        return { bookmarked: result.bookmarked };
    }
    const restart = restartPath.exec(parsed.pathname);
    if (restart && method === 'POST') {
        const start = playbackIdentity(restart[1]);
        const page = uniquePage((document) => document.start_id === start);
        const result = successful(await apiClient.POST('/learner/activity-starts/{start_id}/reset', {
            params: { path: { start_id: start }, query: { node_id: page.document.node.id }, header: { 'X-CSRF-Token': await getCsrfToken() } },
        }));
        const next = successful(await apiClient.GET('/learner/play-runs/{play_run_id}', { params: { path: { play_run_id: result.play_run_id } } }));
        if (next.node.id !== page.document.node.id || next.start_id !== start || next.play_run_id !== result.play_run_id) return unavailable(503);
        return { url: playbackHref(next) };
    }
    return unavailable(501);
}

/** The source's exact Companion-only reload retains its local player state. */
export async function reloadPlaybackCompanion(run: unknown, activity: unknown, options: { only: string[]; onSuccess?: () => void; onFinish?: () => void }) {
    const context = contextForActivity(activity, run);
    if (options.only.length !== 1 || options.only[0] !== 'companion') return unavailable(400);
    try { if (await pages.get(context.run)!.reloadCompanion(context.id)) options.onSuccess?.(); }
    finally { options.onFinish?.(); }
}

function contextForActivity(value: unknown, run?: unknown) {
    const id = playbackIdentity(value);
    const page = run === undefined ? uniquePage((document) => document.graph.activities.some((entry) => entry.id === id)) : pages.get(playbackIdentity(run));
    if (!page) return unavailable(409);
    return playbackContext(page.document.play_run_id, id, page.document.graph.activities.map((activity) => activity.activity_type));
}
function uniquePage(matches: (document: Playback) => boolean) {
    const found = [...pages.values()].filter((page) => matches(page.document));
    if (found.length !== 1) return unavailable(409);
    return found[0];
}
function checkedUrl(url: string) { if (!isPlaybackPageUrl(url)) return unavailable(501); return new URL(url, window.location.origin); }
function checkIn(payload: Record<string, unknown>): components['schemas']['LearnerActivityCheckInRequest'] {
    const { feeling, note, next_direction } = payload;
    if ((feeling !== null && !['clearer', 'forming', 'stretched', 'stuck'].includes(feeling as string)) ||
        (next_direction !== null && !['revisit', 'related', 'settle'].includes(next_direction as string)) ||
        (note !== null && (typeof note !== 'string' || [...note].length > 500))) return unavailable(400);
    return { feeling: feeling as 'clearer' | 'forming' | 'stretched' | 'stuck' | null, note: note as string | null, next_direction: next_direction as 'revisit' | 'related' | 'settle' | null };
}
function successful<T>(result: { response: Response; data?: T }): T {
    if (!result.response.ok || result.data === undefined) return unavailable(result.response.status);
    return result.data;
}
function unavailable(status: number): never { throw new JsonRequestError('The player action is currently unavailable.', status); }
