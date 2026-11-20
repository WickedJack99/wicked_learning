import { apiClient, getCsrfToken } from './api/client';
import { JsonRequestError } from './json-request-error';

export const bookmarkUnavailableMessage = 'The bookmark could not be updated.';

type BookmarkNode = { id: string; slug: string; mapSlug: string };
type BookmarkWorld = { maps: { slug: string; nodes: BookmarkNode[] }[] };
type BookmarkContext = {
    nodeId: string;
    mapSlug: string;
    nodeSlug: string;
    nodeIds: ReadonlyMap<string, string>;
};
const contexts = new WeakMap<object, BookmarkContext>();

/** Bind the exact projected objects, not a mutable global current World. */
export function registerBookmarkWorld(world: BookmarkWorld, nodeIds: ReadonlyMap<string, string>) {
    for (const map of world.maps) {
        for (const node of map.nodes) {
            contexts.set(node, { nodeId: node.id, mapSlug: map.slug, nodeSlug: node.slug, nodeIds });
        }
    }
}

/** Only the copied World's two bookmark calls are bound here by Vite. */
export async function bookmarkNode(node: BookmarkNode, method: 'POST' | 'DELETE') {
    try {
        const context = contexts.get(node);
        if (!context || context.nodeId !== node.id || context.nodeSlug !== node.slug || context.mapSlug !== node.mapSlug
            || (method !== 'POST' && method !== 'DELETE')) {
            throw new JsonRequestError(bookmarkUnavailableMessage, 409);
        }
        const params = {
            header: { 'X-CSRF-Token': await getCsrfToken() },
            path: { map_slug: context.mapSlug, node_slug: context.nodeSlug },
        };
        const result = method === 'POST'
            ? await apiClient.POST('/learner/maps/{map_slug}/nodes/{node_slug}/bookmark', { params })
            : await apiClient.DELETE('/learner/maps/{map_slug}/nodes/{node_slug}/bookmark', { params });
        if (!result.response.ok || !result.data) {
            throw new JsonRequestError(bookmarkUnavailableMessage, result.response.status);
        }
        if (result.data.bookmarked !== (method === 'POST')) {
            throw new JsonRequestError(bookmarkUnavailableMessage, 503);
        }
        const bookmarkedNodeIds = result.data.bookmarked_nodes.map((bookmark) => {
            const id = context.nodeIds.get(`${bookmark.map_slug}:${bookmark.node_slug}`);
            if (!id) throw new JsonRequestError(bookmarkUnavailableMessage, 503);
            return id;
        });
        if (bookmarkedNodeIds.includes(context.nodeId) !== result.data.bookmarked) {
            throw new JsonRequestError(bookmarkUnavailableMessage, 503);
        }
        window.dispatchEvent(new Event('world:bookmark-available'));
        return { bookmarked: result.data.bookmarked, bookmarkedNodeIds };
    } catch (error) {
        window.dispatchEvent(new CustomEvent('world:source-operation-unavailable', {
            detail: { message: bookmarkUnavailableMessage },
        }));
        throw error;
    }
}
