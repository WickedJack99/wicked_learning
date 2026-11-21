import { apiClient, getCsrfToken } from './api/client';
import { JsonRequestError } from './json-request-error';
import { completePlaybackActivityOnce } from './playback-completion';
import { playbackContext } from './playback-context';
import { toSourcePlaybackItem, toSourcePlaybackTool } from './playback-projection';

const grantPath = /^\/learning\/activities\/([a-f0-9-]+)\/grant-(items|tool)$/;
const types = ['item_grant', 'tool_grant'];

export function isPlaybackGrantPost(url: string) {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && !parsed.search && !parsed.hash && grantPath.test(parsed.pathname);
}

export async function playbackGrantPost(url: string, payload: Record<string, unknown>) {
    if (!isPlaybackGrantPost(url)) return unavailable(501);
    const [, id, kind] = grantPath.exec(new URL(url, window.location.origin).pathname)!;
    const context = playbackContext(payload.play_run_id, id, [kind === 'items' ? 'item_grant' : 'tool_grant']);
    const params = { path: { play_run_id: context.run, activity_slug: `id:${id}` }, header: { 'X-CSRF-Token': await getCsrfToken() } };
    if (kind === 'tool') {
        const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/grant-tool', { params }));
        if (result.tool.id !== context.activity.presentation.configured_tool?.id) return unavailable(503);
        return { tool: toSourcePlaybackTool(result.tool) };
    }
    const result = successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/grant-items', { params }));
    // Source consumes the roll's success and replaces its complete inventory.
    // Never substitute the granted subset or an empty inventory on read failure.
    const shell = successful(await apiClient.GET('/learner/shell'));
    return { inventory: shell.items.map(toSourcePlaybackItem), result: { success: result.success } };
}

export function completeGrantActivity(activityId: unknown, run: unknown) {
    return completePlaybackActivityOnce(playbackContext(run, activityId, types), {});
}

function successful<T>(result: { response: Response; data?: T }): T {
    if (!result.response.ok || result.data === undefined) return unavailable(result.response.status);
    return result.data;
}
function unavailable(status: number): never { throw new JsonRequestError('The player grant is currently unavailable.', status); }
