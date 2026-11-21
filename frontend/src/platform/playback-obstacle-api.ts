import { apiClient, getCsrfToken } from './api/client';
import { JsonRequestError } from './json-request-error';
import { completePlaybackActivity } from './playback-completion';
import { playbackContext, playbackIdentity } from './playback-context';
import { toSourceItemObstacleState, toSourcePlaybackItem } from './playback-projection';

const obstaclePath = /^\/learning\/activities\/([a-f0-9-]+)\/(item-obstacle-slot|item-obstacle-continue|obstacle-tool)$/;

export function isPlaybackObstaclePost(url: string) {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && !parsed.search && !parsed.hash && obstaclePath.test(parsed.pathname);
}

export async function playbackObstaclePost(url: string, payload: Record<string, unknown>) {
    if (!isPlaybackObstaclePost(url)) return unavailable(501);
    const [, id, action] = obstaclePath.exec(new URL(url, window.location.origin).pathname)!;
    const context = playbackContext(payload.play_run_id, id, [action === 'obstacle-tool' ? 'obstacle' : 'item_obstacle']);
    const path = { play_run_id: context.run, activity_slug: `id:${context.id}` };
    const header = { 'X-CSRF-Token': await getCsrfToken() };
    if (action === 'obstacle-tool') {
        const toolId = playbackIdentity(payload.tool_id);
        // Source selects a real owned UUID. The native command takes its public
        // slug and independently rechecks ownership, playability and usefulness.
        const shell = successful(await apiClient.GET('/learner/shell'));
        const tool = shell.tools.find((entry) => entry.id === toolId);
        if (!tool) return unavailable(404);
        const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/use-obstacle-tool', {
            params: { path, header }, body: { tool_slug: tool.slug },
        }));
        return { result: { isUseful: result.is_useful, toolId: tool.id } };
    }
    const items = context.activity.presentation.configured_items;
    if (action === 'item-obstacle-slot') {
        const itemId = playbackIdentity(payload.item_id);
        const index = payload.slot_index;
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 9) return unavailable(400);
        const item = items.find((entry) => entry.id === itemId);
        if (!item) return unavailable(404);
        const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/item-obstacle-slots/{slot_index}', {
            params: { path: { ...path, slot_index: index }, header }, body: { item_slug: item.slug },
        }));
        return { inventory: result.inventory.map(toSourcePlaybackItem), state: toSourceItemObstacleState(result.state, items) };
    }
    const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/item-obstacle/continue', {
        params: { path, header },
    }));
    return { state: toSourceItemObstacleState(result.state, items) };
}

export function completeObstacleActivity(activityId: unknown, run: unknown) {
    return completePlaybackActivity(playbackContext(run, activityId, ['item_obstacle', 'obstacle']), {});
}

function successful<T>(result: { response: Response; data?: T }): T {
    if (!result.response.ok || result.data === undefined) return unavailable(result.response.status);
    return result.data;
}
function unavailable(status: number): never { throw new JsonRequestError('The obstacle action is currently unavailable.', status); }
