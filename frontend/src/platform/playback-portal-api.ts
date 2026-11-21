import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import { playbackContext, playbackIdentity } from './playback-context';
import { toSourceActivityReceipt } from './playback-projection';

type Playback = components['schemas']['LearnerPlaybackDocument'];
type Travel = components['schemas']['LearnerPortalTravelResult'];
type Context = ReturnType<typeof playbackContext>;
export type PortalFailure = { message: string; retry: () => void; dismiss: () => void };
type Binding = {
    document: Playback; controller: AbortController; fail: (failure: PortalFailure | null) => void;
    departures: Map<string, Promise<Travel>>; busy?: Promise<void>;
};
const pages = new Map<string, Binding>();

export function bindPlaybackPortals(document: Playback, fail: Binding['fail']) {
    const binding: Binding = { document, fail, controller: new AbortController(), departures: new Map() };
    pages.set(document.play_run_id, binding);
    return () => { binding.controller.abort(); if (pages.get(document.play_run_id) === binding) pages.delete(document.play_run_id); };
}

/** Exact source PortalActivity callback boundary. The copied component owns
 * its pending state/check-in; a rejected transport never becomes completion. */
export function performPortalAction(node: unknown, activity: unknown, action: () => Promise<void>) {
    const matches = [...pages.values()].filter((page) => page.document.node.id === node && page.document.graph.activities.some((entry) => entry.id === activity && entry.activity_type === 'portal'));
    if (matches.length !== 1) return unavailable(409);
    void perform(matches[0], action);
}

export async function completeOutputPortal(context: Context) {
    const page = bindingFor(context.run);
    if (page.document !== context.document || context.document.run_kind !== 'route' || context.activity.config.portalMode === 'input') return unavailable(409);
    const links = page.document.node.outgoing_portal_links.filter((link) => link.source_activity_id === context.id);
    if (links.length !== 1) return unavailable(404);
    let departure = page.departures.get(context.id);
    if (!departure) {
        departure = (async () => {
            const response = await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/portal/travel', {
                signal: page.controller.signal,
                params: { path: { play_run_id: context.run, activity_slug: `id:${context.id}` }, header: { 'X-CSRF-Token': await getCsrfToken() } },
            });
            const result = successful(response);
            playbackIdentity(result.play_run_id);
            if (result.play_run_id === context.run || result.node_slug !== links[0].target_node_slug ||
                result.departure_state.activity_id !== context.id || result.departure_state.progress?.status !== 'completed' ||
                !result.departure_state.progress.completed_at) return unavailable(503);
            return result;
        })().catch((error: unknown) => { page.departures.delete(context.id); throw error; });
        page.departures.set(context.id, departure);
    }
    const result = await departure;
    if (page.controller.signal.aborted) return unavailable(409);
    const progress = toSourceActivityReceipt(result.departure_state, context.activity);
    if (!progress) return unavailable(503);
    return { progress };
}

/** The two source portal visits may only use the arrival minted by their
 * successful departure. Refresh/retry reads it again under current access. */
export function navigatePlaybackPortal(run: unknown, sourceLink: { sourceActivityId: unknown; targetNodeId: unknown; targetActivityId: unknown }, visit: (href: string) => void) {
    const page = bindingFor(playbackIdentity(run));
    void perform(page, async () => {
        const link = page.document.node.outgoing_portal_links.find((entry) => entry.source_activity_id === sourceLink.sourceActivityId);
        if (!link || link.target_node_id !== sourceLink.targetNodeId || link.target_activity_id !== sourceLink.targetActivityId) return unavailable(409);
        const departure = page.departures.get(link.source_activity_id);
        if (!departure) return unavailable(409);
        const receipt = await departure;
        const arrival = successful(await apiClient.GET('/learner/play-runs/{play_run_id}', {
            signal: page.controller.signal, params: { path: { play_run_id: receipt.play_run_id } },
        }));
        if (arrival.run_kind !== 'portal' || arrival.play_run_id !== receipt.play_run_id || arrival.start_id !== null ||
            arrival.node.id !== link.target_node_id || arrival.node.map_id !== link.target_map_id ||
            arrival.node.slug !== receipt.node_slug || arrival.activity.id !== link.target_activity_id ||
            arrival.activity.activity_type !== 'portal' || arrival.activity.config.portalMode !== 'input') return unavailable(503);
        if (page.controller.signal.aborted) return;
        const query = new URLSearchParams({ activity_id: arrival.activity.id, run: arrival.play_run_id });
        visit(`/learning/nodes/${arrival.node.id}/play?${query}`);
    });
}

function bindingFor(run: string) {
    const page = pages.get(run);
    if (!page || page.controller.signal.aborted) return unavailable(409);
    return page;
}
function perform(page: Binding, action: () => Promise<void>): Promise<void> {
    if (page.busy || page.controller.signal.aborted) return page.busy ?? Promise.resolve();
    page.fail(null);
    const pending = Promise.resolve().then(action).catch((error: unknown) => {
        if (!page.controller.signal.aborted) page.fail({
            message: error instanceof JsonRequestError ? error.message : 'The portal connection is unavailable.',
            retry: () => { void perform(page, action); }, dismiss: () => page.fail(null),
        });
    }).finally(() => { if (page.busy === pending) page.busy = undefined; });
    page.busy = pending;
    return pending;
}
function successful<T>(result: { response: Response; data?: T }): T {
    if (!result.response.ok || result.data === undefined) return unavailable(result.response.status);
    return result.data;
}
function unavailable(status: number): never { throw new JsonRequestError('This portal is currently unavailable.', status); }
