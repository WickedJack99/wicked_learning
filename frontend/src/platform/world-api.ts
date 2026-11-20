import { apiClient, getCsrfToken } from './api/client';
import { toSourceGroup, toSourceGroupPage } from './world-groups';
import { searchUnavailableMessage, toSourceSearchResponse } from './world-search-projection';

import { JsonRequestError } from './json-request-error';
import { journalRead, journalWrite, isJournalWrite } from './journal-api';
export { JsonRequestError } from './json-request-error';

const unavailableMessage =
    'This World action is not available until its Rust migration slice is activated.';

function unavailableOperation(): never {
    window.dispatchEvent(
        new CustomEvent('world:source-operation-unavailable', {
            detail: { message: unavailableMessage },
        }),
    );

    throw new JsonRequestError(unavailableMessage, 501);
}

/**
 * The copied World page still names Laravel transport paths. This facade maps
 * only audited paths to typed Rust calls. Unmapped operations never fall
 * through to Laravel-shaped requests.
 */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const parsed = new URL(url, window.location.origin);

    if (parsed.origin === window.location.origin && parsed.pathname === '/learning/journal') {
        return await journalRead(parsed, signal) as T;
    }

    if (parsed.pathname === '/learning/search') {
        if (parsed.origin !== window.location.origin) return unavailableOperation();
        try {
            const { data, response } = await apiClient.GET('/learner/search', {
                signal,
                params: {
                    query: {
                        page: Number(parsed.searchParams.get('page') ?? '1'),
                        per_page: Number(parsed.searchParams.get('per_page') ?? '5'),
                        query: parsed.searchParams.get('query') ?? '',
                    },
                },
            });
            if (!response.ok || !data) {
                throw new JsonRequestError(searchUnavailableMessage, response.status);
            }
            const result = toSourceSearchResponse(data);
            window.dispatchEvent(new Event('world:search-available'));
            return result as T;
        } catch (error) {
            if (!signal?.aborted) {
                window.dispatchEvent(new CustomEvent('world:source-operation-unavailable', {
                    detail: { message: searchUnavailableMessage },
                }));
            }
            throw error;
        }
    }

    if (parsed.pathname === '/learning/groups') {
        const { data, response } = await apiClient.GET('/learner/groups', {
            params: {
                query: {
                    page: Number(parsed.searchParams.get('page') ?? '1'),
                    per_page: Number(parsed.searchParams.get('per_page') ?? '1'),
                },
            },
        });
        if (!response.ok || !data) {
            throw new JsonRequestError('The group chats could not be loaded.', response.status);
        }

        return toSourceGroupPage(data) as T;
    }

    return unavailableOperation();
}

export async function postJson<T>(
    url: string,
    payload: Record<string, unknown>,
): Promise<T> {
    if (isJournalWrite('POST', url)) return await journalWrite('POST', url, payload) as T;
    const groupAction = /^\/learning\/groups\/([a-f0-9-]+)\/(messages|admin-chat-vote|messages\/([a-f0-9-]+)\/resolve)$/.exec(url);
    if (groupAction) {
        const [, groupId, action, messageId] = groupAction;
        if (action === 'messages' && (
            typeof payload.body !== 'string' ||
            (payload.is_help_request !== undefined && typeof payload.is_help_request !== 'boolean')
        )) {
            throw new JsonRequestError('The message could not be sent.', 400);
        }

        const headers = { 'X-CSRF-Token': await getCsrfToken() };
        const result = action === 'messages'
            ? await apiClient.POST('/learner/groups/{group_id}/messages', {
                params: { path: { group_id: groupId }, header: headers },
                body: {
                    body: payload.body as string,
                    is_help_request: payload.is_help_request === true,
                },
            })
            : action === 'admin-chat-vote'
                ? await apiClient.POST('/learner/groups/{group_id}/admin-chat-vote', {
                    params: { path: { group_id: groupId }, header: headers },
                })
                : await apiClient.POST('/learner/groups/{group_id}/messages/{message_id}/resolve', {
                    params: { path: { group_id: groupId, message_id: messageId }, header: headers },
                });

        if (!result.response.ok || !result.data) {
            throw new JsonRequestError(
                action === 'messages'
                    ? 'The message could not be sent.'
                    : action === 'admin-chat-vote'
                        ? 'The vote could not be saved.'
                        : 'The help request could not be updated.',
                result.response.status,
            );
        }
        return { group: toSourceGroup(result.data.group) } as T;
    }
    return unavailableOperation();
}

export async function deleteJson<T>(url: string): Promise<T> {
    if (isJournalWrite('DELETE', url)) return await journalWrite('DELETE', url) as T;
    return unavailableOperation();
}

export async function patchJson<T>(
    url: string,
    payload: Record<string, unknown>,
): Promise<T> {
    if (isJournalWrite('PATCH', url)) return await journalWrite('PATCH', url, payload) as T;
    return unavailableOperation();
}
