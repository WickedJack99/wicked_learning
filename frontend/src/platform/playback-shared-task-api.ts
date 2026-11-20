import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import { toSourceSharedTaskState } from './playback-projection';

type Playback = components['schemas']['LearnerPlaybackDocument'];
const documents = new Map<string, { document: Playback }>();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** A route owns its binding; disposing an older render cannot unbind a newer one. */
export function bindSharedTaskPlayback(document: Playback) {
    const binding = { document };
    documents.set(document.play_run_id, binding);
    return () => {
        if (documents.get(document.play_run_id) === binding) documents.delete(document.play_run_id);
    };
}

const sourcePath = /^\/learning\/activities\/([a-f0-9-]+)\/shared-task-(submissions|reviews|checklist)(?:\/([a-f0-9-]+)\/(revision|helpfulness|follow-up))?$/;

export function isSharedTaskWrite(url: string) {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && sourcePath.test(parsed.pathname) && !parsed.search && !parsed.hash;
}

export async function sharedTaskWrite(method: 'POST' | 'PATCH', url: string, payload: Record<string, unknown>) {
    if (!isSharedTaskWrite(url)) return unavailable(501);
    const match = sourcePath.exec(new URL(url, window.location.origin).pathname)!;
    const [, activityId, collection, recordId, action] = match;
    const run = identity(payload.play_run_id);
    identity(activityId);
    const document = documents.get(run)?.document;
    if (!document || !document.graph.activities.some((activity) => activity.id === activityId && activity.activity_type === 'shared_task')) return unavailable(409);
    if (recordId) identity(recordId);
    const params = {
        path: { play_run_id: run, activity_slug: `id:${activityId}` },
        header: { 'X-CSRF-Token': await getCsrfToken() },
    };
    if (method === 'POST' && collection === 'checklist' && !recordId) {
        const indexes = payload.completed_step_indexes;
        if (!Array.isArray(indexes) || indexes.some((index) => typeof index !== 'number' || !Number.isInteger(index))) return unavailable(400);
        const result = await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/checklist', {
            params, body: { completed_step_indexes: indexes },
        });
        if (!result.response.ok || !result.data) return unavailable(result.response.status);
        return { state: { completedStepIndexes: result.data.completed_step_indexes } };
    }
    if (method === 'POST' && collection === 'submissions' && !recordId) {
        const result = await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/submissions', {
            params, body: { body: text(payload.body), share_with_peers: boolean(payload.share_with_peers), project_step_index: step(payload.project_step_index) },
        });
        return projected(result);
    }
    if (method === 'POST' && collection === 'reviews' && !recordId) {
        const responseType = payload.response_type;
        if (responseType !== null && responseType !== undefined && responseType !== 'explanation' && responseType !== 'example' && responseType !== 'question' && responseType !== 'counterexample') return unavailable(400);
        const result = await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews', {
            params, body: { body: text(payload.body), submission_id: identity(payload.submission_id), response_type: responseType, project_step_index: step(payload.project_step_index) },
        });
        return projected(result);
    }
    if (method === 'PATCH' && collection === 'submissions' && action === 'revision' && recordId) {
        const result = await apiClient.PATCH('/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/submissions/{submission_id}/revision', {
            params: { ...params, path: { ...params.path, submission_id: recordId } }, body: { body: text(payload.body) },
        });
        return projected(result);
    }
    if (method === 'PATCH' && collection === 'reviews' && recordId && action === 'helpfulness') {
        const result = await apiClient.PATCH('/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews/{review_id}/helpfulness', {
            params: { ...params, path: { ...params.path, review_id: recordId } }, body: { helpful: boolean(payload.helpful) },
        });
        return projected(result);
    }
    if (method === 'PATCH' && collection === 'reviews' && recordId && action === 'follow-up') {
        const result = await apiClient.PATCH('/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews/{review_id}/follow-up', {
            params: { ...params, path: { ...params.path, review_id: recordId } }, body: { body: payload.body === null ? null : text(payload.body) },
        });
        return projected(result);
    }
    return unavailable(501);
}

function projected(result: { data?: components['schemas']['LearnerSharedTaskState']; response: Response }) {
    if (!result.response.ok || !result.data) return unavailable(result.response.status);
    return { state: toSourceSharedTaskState(result.data) };
}
function identity(value: unknown) { if (typeof value !== 'string' || !uuid.test(value)) return unavailable(400); return value; }
function text(value: unknown) { if (typeof value !== 'string') return unavailable(400); return value; }
function boolean(value: unknown) { if (typeof value !== 'boolean') return unavailable(400); return value; }
function step(value: unknown) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'number' || !Number.isInteger(value)) return unavailable(400);
    return value;
}
function unavailable(status: number): never { throw new JsonRequestError('The Shared Task action could not be completed.', status); }
