import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';
import { toSourceJournal, toSourceJournalPage } from './journal-projection';

const pagePath = /^\/learning\/journal\/pages\/([a-f0-9-]+)$/;
const feedbackPath = /^\/learning\/journal\/pages\/([a-f0-9-]+)\/feedback-request$/;
const revisitPath = /^\/learning\/activities\/([a-f0-9-]+)\/revisit-invitation$/;
// Source names an activity; Rust deliberately addresses its private check-in.
// Only a successful, authorized Journal read establishes that association.
let revisitCheckIns = new Map<string, string>();

export async function journalRead(url: URL, signal?: AbortSignal) {
    const result = await apiClient.GET('/learner/journal', {
        signal,
        params: { query: {
            page: Number(url.searchParams.get('page') ?? '1'),
            per_page: Number(url.searchParams.get('per_page') ?? '4'),
            search: url.searchParams.get('search') ?? '',
        } },
    });
    if (!result.response.ok || !result.data) {
        throw new JsonRequestError('The journal could not be loaded.', result.response.status);
    }
    revisitCheckIns = new Map(result.data.revisit_invitations.map((invitation) => [invitation.activity_id, invitation.check_in_id]));
    return toSourceJournal(result.data);
}

type Method = 'POST' | 'PATCH' | 'DELETE';
export function isJournalWrite(method: Method, url: string) {
    return method === 'POST'
        ? url === '/learning/journal/pages' || feedbackPath.test(url) || revisitPath.test(url)
        : pagePath.test(url);
}

function pageDraft(payload: Record<string, unknown>): components['schemas']['UpdateLearnerJournalPageRequest'] {
    if (typeof payload.title !== 'string' || typeof payload.topic !== 'string'
        || (payload.preferred_mode !== 'edit' && payload.preferred_mode !== 'view')
        || (payload.markdown !== undefined && typeof payload.markdown !== 'string')
        || (payload.subtopic != null && typeof payload.subtopic !== 'string')
        || (payload.request_expert_access !== undefined && typeof payload.request_expert_access !== 'boolean')) {
        throw new JsonRequestError('The journal page could not be saved.', 400);
    }
    return {
        title: payload.title, topic: payload.topic, preferred_mode: payload.preferred_mode,
        markdown: payload.markdown as string | undefined,
        subtopic: payload.subtopic as string | null | undefined,
        request_expert_access: payload.request_expert_access === true,
    };
}

export async function journalWrite(method: Method, url: string, payload: Record<string, unknown> = {}) {
    if (!isJournalWrite(method, url)) throw new JsonRequestError('This Journal action is unavailable.', 501);
    const pageId = pagePath.exec(url)?.[1];
    const feedbackPageId = feedbackPath.exec(url)?.[1];
    const activityId = revisitPath.exec(url)?.[1];
    if (activityId) {
        const checkInId = revisitCheckIns.get(activityId);
        if (!checkInId || (payload.action !== 'dismiss' && payload.action !== 'snooze')) {
            throw new JsonRequestError('Reload the journal before updating this invitation.', 409);
        }
        const result = await apiClient.POST('/learner/revisit-invitations/{check_in_id}', {
            params: { path: { check_in_id: checkInId }, header: { 'X-CSRF-Token': await getCsrfToken() } },
            body: { action: payload.action },
        });
        if (!result.response.ok || !result.data) {
            throw new JsonRequestError('The revisit invitation could not be updated.', result.response.status);
        }
        revisitCheckIns.delete(activityId);
        return;
    }
    if (method === 'DELETE' && pageId) {
        const result = await apiClient.DELETE('/learner/journal/pages/{page_id}', {
            params: { path: { page_id: pageId }, header: { 'X-CSRF-Token': await getCsrfToken() } },
        });
        if (!result.response.ok || !result.data) {
            throw new JsonRequestError('The journal page could not be deleted.', result.response.status);
        }
        return { deletedPageId: result.data.deleted_page_id };
    }
    if (feedbackPageId) {
        if (typeof payload.domain_key !== 'string') throw new JsonRequestError('Select a review domain.', 400);
        const result = await apiClient.POST('/learner/journal/pages/{page_id}/feedback-request', {
            params: { path: { page_id: feedbackPageId }, header: { 'X-CSRF-Token': await getCsrfToken() } },
            body: { domain_key: payload.domain_key },
        });
        if (!result.response.ok || !result.data) {
            throw new JsonRequestError('The page review could not be requested.', result.response.status);
        }
        return { page: toSourceJournalPage(result.data.page) };
    }
    const body = pageDraft(payload);
    const header = { 'X-CSRF-Token': await getCsrfToken() };
    const result = method === 'PATCH' && pageId
        ? await apiClient.PATCH('/learner/journal/pages/{page_id}', { params: { path: { page_id: pageId }, header }, body })
        : await apiClient.POST('/learner/journal/pages', { params: { header }, body });
    if (!result.response.ok || !result.data) {
        throw new JsonRequestError('The journal page could not be saved.', result.response.status);
    }
    return { page: toSourceJournalPage(result.data.page) };
}
