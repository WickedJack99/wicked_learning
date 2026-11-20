import { apiClient, getCsrfToken } from './api/client';
import { JsonRequestError } from './json-request-error';

export const toolUnavailableMessage = 'The tool could not be used.';
export const worldReloadUnavailableMessage = 'The World could not be refreshed. Reload the page to see its current state.';

type NodeTarget = { id: string; slug: string; mapSlug: string };
type ToolTarget = { id: string; slug: string };
type ToolWorld = { maps: { slug: string; nodes: NodeTarget[] }[] };
const contexts = new WeakMap<object, {
    id: string; mapSlug: string; nodeSlug: string;
    tools: ReadonlyMap<string, string>; world: object;
}>();
const reloaders = new WeakMap<object, () => void>();

/** Keep identities with their exact projection, never a global current map. */
export function registerToolWorld(world: ToolWorld, tools: ToolTarget[]) {
    const toolSlugs = new Map(tools.map((tool) => [tool.id, tool.slug]));
    for (const map of world.maps) for (const node of map.nodes) {
        contexts.set(node, { id: node.id, mapSlug: map.slug, nodeSlug: node.slug, tools: toolSlugs, world });
    }
}

export function bindWorldReload(world: object, reload: () => void) {
    reloaders.set(world, reload);
}

/** Only the copied World's exact only:['world'] call is transformed here. */
export function reloadWorld(node: NodeTarget) {
    const context = contexts.get(node);
    const reload = context && reloaders.get(context.world);
    if (!reload) {
        unavailable(worldReloadUnavailableMessage);
        throw new JsonRequestError(worldReloadUnavailableMessage, 409);
    }
    reload();
}

export async function useWorldNodeTool(node: NodeTarget, tool: ToolTarget, sourcePath: string) {
    try {
        const context = contexts.get(node);
        const unlock = sourcePath === `/learning/nodes/${node.id}/unlock-tool`;
        const reveal = sourcePath === `/learning/nodes/${node.id}/reveal-tool`;
        if (!context || context.id !== node.id || context.mapSlug !== node.mapSlug || context.nodeSlug !== node.slug
            || (!unlock && !reveal) || context.tools.get(tool.id) !== tool.slug || !tool.slug) {
            throw new JsonRequestError(toolUnavailableMessage, 409);
        }
        const { data, response } = await apiClient.POST('/learner/maps/{map_slug}/nodes/{node_slug}/use-tool', {
            params: { path: { map_slug: context.mapSlug, node_slug: context.nodeSlug }, header: { 'X-CSRF-Token': await getCsrfToken() } },
            body: { tool_slug: tool.slug },
        });
        if (!response.ok || !data) throw new JsonRequestError(toolUnavailableMessage, response.status);
        if ([data.discovered, data.is_unlocked, data.is_useful].some((flag) => typeof flag !== 'boolean')) {
            throw new JsonRequestError(toolUnavailableMessage, 503);
        }
        window.dispatchEvent(new Event('world:tool-available'));
        return { result: {
            nodeId: context.id, toolId: tool.id, isUseful: data.is_useful,
            ...(unlock ? { isUnlocked: data.is_unlocked } : { discovered: data.discovered }),
        } };
    } catch (error) {
        unavailable(toolUnavailableMessage);
        throw error;
    }
}

function unavailable(message: string) {
    window.dispatchEvent(new CustomEvent('world:source-operation-unavailable', { detail: { message } }));
}
