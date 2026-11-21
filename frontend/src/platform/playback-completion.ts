import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import type { playbackContext } from './playback-context';
import { toSourceActivityReceipt } from './playback-projection';

type Context = ReturnType<typeof playbackContext>;
type Receipt = components['schemas']['LearnerPlaybackCompletionResult'];
type Completion = { receipt: Receipt; progress: ReturnType<typeof toSourceActivityReceipt> };
const completions = new WeakMap<Context['binding'], Map<string, Promise<Completion>>>();

/** Source grant effects and callbacks can complete the same activity together.
 * Share only a real request/receipt inside its owning document binding; a new
 * binding starts fresh, and a failed request remains retryable. */
export function completePlaybackActivityOnce(context: Context, body: components['schemas']['LearnerPlaybackCompletionRequest']): Promise<Completion> {
    let pending = completions.get(context.binding);
    if (!pending) { pending = new Map(); completions.set(context.binding, pending); }
    const key = `${context.id}:${JSON.stringify(body)}`;
    const previous = pending.get(key);
    if (previous) return previous;
    const request = completePlaybackActivity(context, body).catch((error: unknown) => {
        if (pending!.get(key) === request) pending!.delete(key);
        throw error;
    });
    pending.set(key, request);
    return request;
}

export async function completePlaybackActivity(context: Context, body: components['schemas']['LearnerPlaybackCompletionRequest']): Promise<Completion> {
    const result = await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/complete', {
        params: { path: { play_run_id: context.run, activity_slug: `id:${context.id}` }, header: { 'X-CSRF-Token': await getCsrfToken() } }, body,
    });
    if (!result.response.ok || !result.data) throw new JsonRequestError('The player response could not be saved.', result.response.status);
    const data = result.data;
    if (data.play_run_id !== context.run || data.activity_state.activity_id !== context.id ||
        (data.next_activity_id !== null && !context.document.graph.activities.some((activity) => activity.id === data.next_activity_id))) {
        throw new JsonRequestError('The player completion is unavailable.', 503);
    }
    return { receipt: data, progress: toSourceActivityReceipt(data.activity_state, context.activity) };
}
