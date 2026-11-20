import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';

export const searchUnavailableMessage = 'The World search is currently unavailable.';

/** Keep opaque Rust UUIDs and the source's distinct topic/map/node shapes. */
export function toSourceSearchResponse(document: components['schemas']['LearnerDeskSearch']) {
    return {
        pagination: {
            currentPage: document.pagination.current_page,
            lastPage: document.pagination.last_page,
            perPage: document.pagination.per_page,
            total: document.pagination.total,
        },
        results: document.results.map((result) => {
            const common = {
                href: result.href, id: result.id, kind: result.kind,
                subtitle: result.subtitle, title: result.title,
            };
            if (result.kind === 'topic') return common;
            if (result.kind !== 'map' && result.kind !== 'node') {
                throw new JsonRequestError(searchUnavailableMessage, 503);
            }
            const map = { mapId: required(result.map_id), mapSlug: required(result.map_slug) };
            return result.kind === 'map' ? { ...common, ...map } : {
                ...common, ...map,
                nodeId: required(result.node_id), nodeSlug: required(result.node_slug),
            };
        }),
    };
}

function required(value: string | null): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new JsonRequestError(searchUnavailableMessage, 503);
    }
    return value;
}
