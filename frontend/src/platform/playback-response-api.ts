import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import { playbackContext } from './playback-context';
import { toSourceQuestionAnswer } from './playback-projection';
import { completePlaybackActivity } from './playback-completion';

const answerPath = /^\/learning\/questions\/([a-f0-9-]+)\/answer$/;
const reflectionPath = /^\/learning\/activities\/([a-f0-9-]+)\/reflection$/;
const responseTypes = ['question', 'reflection', 'review'];

export function isPlaybackResponsePost(url: string) {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && !parsed.search && !parsed.hash &&
        (answerPath.test(parsed.pathname) || reflectionPath.test(parsed.pathname));
}

export async function playbackResponsePost(url: string, payload: Record<string, unknown>) {
    if (!isPlaybackResponsePost(url)) return unavailable(501);
    const pathname = new URL(url, window.location.origin).pathname;
    const questionMatch = answerPath.exec(pathname);
    const id = questionMatch?.[1] ?? reflectionPath.exec(pathname)![1];
    const context = playbackContext(payload.play_run_id, id, questionMatch ? ['question'] : ['reflection', 'review']);
    if (questionMatch) {
        const question = context.activity.presentation.question;
        if (!question || payload.defer_completion !== true ||
            payload.is_recall !== (context.document.run_kind === 'recall') ||
            payload.is_revisit !== (context.document.run_kind === 'revisit')) return unavailable(409);
        const keys = question.allow_multiple ? payload.option_ids : [payload.option_id];
        if (!Array.isArray(keys) || !keys.length || keys.length > 24 || new Set(keys).size !== keys.length ||
            keys.some((key) => typeof key !== 'string' || !question.options.some((option) => option.key === key))) return unavailable(400);
        const body = { option_keys: keys as string[], confidence: confidence(payload.confidence) };
        const result = await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/answer', {
            params: await parameters(context.run, id), body,
        });
        const answer = successful(result);
        if (answer.play_run_id !== context.run || answer.status !== 'in_progress' ||
            answer.selected_option_keys.some((key) => !question.options.some((option) => option.key === key))) return unavailable(503);
        destination(context.document, answer.next_activity_id);
        return { answer: { questionId: id, ...toSourceQuestionAnswer(answer) } };
    }
    if (typeof payload.reflection !== 'string' ||
        (payload.response_context !== undefined && payload.response_context !== null && typeof payload.response_context !== 'string') ||
        (payload.independent_check !== undefined && typeof payload.independent_check !== 'boolean')) return unavailable(400);
    const cues = payload.observed_cues;
    if (cues !== undefined && (!Array.isArray(cues) || cues.length > 3 || cues.some((cue) => typeof cue !== 'string'))) return unavailable(400);
    const result = await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/reflection', {
        params: await parameters(context.run, id),
        body: { reflection: payload.reflection, response_context: payload.response_context,
            independent_check: payload.independent_check, observed_cues: cues as string[] | undefined },
    });
    const saved = successful(result);
    if (saved.play_run_id !== context.run || saved.status !== 'saved') return unavailable(503);
    return saved;
}

export async function queuePlaybackRecall(question: unknown, run: unknown) {
    const context = playbackContext(run, question, ['question']);
    return successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/recall', {
        params: await parameters(context.run, context.id),
    }));
}

export async function removePlaybackRecall(question: unknown, run: unknown) {
    const context = playbackContext(run, question, ['question']);
    return successful(await apiClient.DELETE('/learner/play-runs/{play_run_id}/activities/{activity_slug}/recall', {
        params: await parameters(context.run, context.id),
    }));
}

export async function savePlaybackRecallFeedback(question: unknown, run: unknown, value: unknown) {
    const context = playbackContext(run, question, ['question']);
    const selected = confidence(value);
    return successful(await apiClient.POST('/learner/play-runs/{play_run_id}/activities/{activity_slug}/recall/feedback', {
        params: await parameters(context.run, context.id), body: { confidence_after_feedback: selected },
    }));
}

/** The owning page still handles check-ins/navigation. This returns only the
 * real receipt, including null ordinary progress for isolated Recall runs. */
export async function completeResponseActivity(activityId: unknown, run: unknown, options: Record<string, unknown> = {}) {
    const context = playbackContext(run, activityId, responseTypes);
    const body: components['schemas']['LearnerPlaybackCompletionRequest'] = {
        confidence: confidence(options.confidence) ?? undefined,
        confidence_after_feedback: confidence(options.confidenceAfterFeedback),
    };
    if (context.activity.activity_type !== 'question' && options.outcome !== undefined) {
        if (options.outcome !== null && (typeof options.outcome !== 'string' || !['clearer', 'connected', 'open'].includes(options.outcome))) return unavailable(400);
        body.outcome = options.outcome as 'clearer' | 'connected' | 'open' | null;
    }
    // Answer outcome/attempt/calibration and saved reflection cues belong to
    // Rust's evaluated attempt; never forward source browser-derived evidence.
    return completePlaybackActivity(context, body);
}

async function parameters(run: string, id: string) {
    return { path: { play_run_id: run, activity_slug: `id:${id}` }, header: { 'X-CSRF-Token': await getCsrfToken() } };
}
function confidence(value: unknown): 'exploring' | 'leaning' | 'settled' | null | undefined {
    if (value === null || value === undefined || value === 'exploring' || value === 'leaning' || value === 'settled') return value;
    return unavailable(400);
}
function destination(document: components['schemas']['LearnerPlaybackDocument'], id: string | null) {
    if (id !== null && !document.graph.activities.some((activity) => activity.id === id)) return unavailable(503);
}
function successful<T>(result: { response: Response; data?: T }): T {
    if (!result.response.ok || result.data === undefined) return unavailable(result.response.status);
    return result.data;
}
function unavailable(status: number): never { throw new JsonRequestError('The player response could not be saved.', status); }
