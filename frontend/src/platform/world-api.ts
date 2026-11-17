import { apiClient } from './api/client';

export class JsonRequestError extends Error {
    public constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'JsonRequestError';
    }
}

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
 * only its audited read paths to typed Rust calls; all source writers remain
 * visibly unavailable instead of falling through to Laravel-shaped requests.
 */
export async function getJson<T>(url: string, _signal?: AbortSignal): Promise<T> {
    const parsed = new URL(url, window.location.origin);

    if (parsed.pathname === '/learning/search') {
        const { data, response } = await apiClient.GET('/learner/search', {
            params: {
                query: {
                    page: Number(parsed.searchParams.get('page') ?? '1'),
                    per_page: Number(parsed.searchParams.get('per_page') ?? '5'),
                    query: parsed.searchParams.get('query') ?? '',
                },
            },
        });
        if (!response.ok || !data) {
            throw new JsonRequestError('The World search is currently unavailable.', response.status);
        }

        return {
            pagination: {
                currentPage: data.pagination.current_page,
                lastPage: data.pagination.last_page,
                perPage: data.pagination.per_page,
                total: data.pagination.total,
            },
            results: data.results.map((result) => ({
                href: result.href,
                id: result.id,
                kind: result.kind,
                mapId: 0,
                mapSlug: result.map_slug,
                nodeId: 0,
                nodeSlug: result.node_slug,
                subtitle: result.subtitle,
                title: result.title,
            })),
        } as T;
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

        return data as T;
    }

    return unavailableOperation();
}

export async function postJson<T>(
    _url: string,
    _payload: Record<string, unknown>,
): Promise<T> {
    return unavailableOperation();
}

export async function deleteJson<T>(_url: string): Promise<T> {
    return unavailableOperation();
}

export async function patchJson<T>(
    _url: string,
    _payload: Record<string, unknown>,
): Promise<T> {
    return unavailableOperation();
}
