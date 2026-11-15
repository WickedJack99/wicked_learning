import { useCallback } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import EditWorldMap, {
    type AccessGroup,
    type AccessRoleOption,
    type EditableMapPayload,
    type LiftedWorldMapTransport,
} from './lifted-world-builder-edit-map';
import type { MapAsset } from './lifted-world-builder-types';

type Document = components['schemas']['AdminEditableMap'];
type SourceOptions = Parameters<LiftedWorldMapTransport['patch']>[2];

function sourceMapAsset(
    asset: components['schemas']['AdminEditableMapAsset'],
): MapAsset {
    return {
        focusable: asset.focusable,
        id: asset.id,
        imageUrl: asset.image_url,
        interactionConfig: asset.interaction_config,
        interactionMode: asset.interaction_mode,
        locked: asset.locked,
        nodeId: asset.node_id,
        opacity: asset.opacity,
        soundConfig: asset.sound_config,
        text: asset.text,
        visualConfig: asset.visual_config,
        width: asset.width,
        x: asset.x,
        y: asset.y,
        z: asset.z,
    };
}

/** Only converts Rust wire names and UUIDs into the pinned source page props. */
function sourcePayload(document: Document): EditableMapPayload {
    const { map, world } = document.editable_map;

    return {
        map: {
            accessRoles: map.access_roles,
            backgroundConfig: map.background_config,
            description: map.description,
            editingGroupIds: map.editing_group_ids,
            gridConfig: map.grid_config,
            id: map.id,
            mapAssets: map.map_assets.map(sourceMapAsset),
            mapAssetsLocked: map.map_assets_locked,
            nodeCount: map.node_count,
            nodes: map.nodes.map((node) => ({
                description: node.description,
                id: node.id,
                position: node.position,
                slug: node.slug,
                state: node.state,
                title: node.title,
                unlockDiagnostics: node.unlock_diagnostics,
                visualConfig: node.visual_config as EditableMapPayload['map']['nodes'][number]['visualConfig'],
            })),
            slug: map.slug,
            title: map.title,
            topicId: map.topic_id,
            updatedAt: map.updated_at,
        },
        world: {
            description: world.description,
            id: world.id,
            slug: world.slug,
            title: world.title,
        },
    };
}

function sourceError(options: SourceOptions): void {
    options?.onError?.({ form: 'The change could not be saved. Refresh the map and try again.' });
}

function complete(
    response: Response,
    options: SourceOptions,
    onUpdated: () => void,
    props: Record<string, unknown> = {},
): void {
    if (!response.ok) {
        sourceError(options);
        options?.onFinish?.();
        return;
    }

    onUpdated();
    options?.onSuccess?.({ props });
    options?.onFinish?.();
}

function withoutFocusable(body: unknown): components['schemas']['UpsertAdminWorldMapAssetRequest'] {
    const { focusable: _focusable, ...asset } = body as Record<string, unknown>;

    return asset as components['schemas']['UpsertAdminWorldMapAssetRequest'];
}

function newMapAsset(): components['schemas']['UpsertAdminWorldMapAssetRequest'] {
    return {
        image_url: null,
        interaction_config: {},
        interaction_mode: 'focusable',
        locked: false,
        opacity: 1,
        position_x: 50,
        position_y: 50,
        position_z: 0,
        sound_config: {},
        text: null,
        visual_config: {},
        width: 14,
    };
}

function hexDirection(q: number, r: number): { q: -1 | 0 | 1; r: -1 | 0 | 1 } {
    if (![-1, 0, 1].includes(q) || ![-1, 0, 1].includes(r) || (q === 0 && r === 0)) {
        throw new Error('The selected hex-grid direction is invalid.');
    }

    return { q: q as -1 | 0 | 1, r: r as -1 | 0 | 1 };
}

/**
 * The only Laravel/Inertia replacement for the lifted route.  The source page
 * retains its exact route-shaped writer calls; this adapter binds each one to
 * a typed Rust endpoint, CSRF lifecycle, and the existing document reload.
 */
function useRustTransport(
    document: Document,
    onUpdated: () => void,
): LiftedWorldMapTransport {
    const write = useCallback(async (
        method: 'delete' | 'patch' | 'post',
        sourceUrl: string,
        body: unknown,
        options?: SourceOptions,
    ): Promise<void> => {
        const token = await getCsrfToken();
        const header = { 'X-CSRF-Token': token };
        const nodeMatch = /^\/settings\/worlds\/nodes\/([^/]+)$/.exec(sourceUrl);
        const nodeInsertMatch = /^\/settings\/worlds\/nodes\/([^/]+)\/insert$/.exec(sourceUrl);
        const nodeResetMatch = /^\/settings\/worlds\/nodes\/([^/]+)\/reset-unlocks$/.exec(sourceUrl);
        const nodeSwapMatch = /^\/settings\/worlds\/nodes\/([^/]+)\/swap$/.exec(sourceUrl);
        const assetMatch = /^\/settings\/worlds\/assets\/([^/]+)$/.exec(sourceUrl);
        const mapNodesMatch = /^\/settings\/worlds\/maps\/([^/]+)\/nodes$/.exec(sourceUrl);
        const mapDetailsMatch = /^\/settings\/worlds\/maps\/([^/]+)\/details$/.exec(sourceUrl);
        const mapAccessMatch = /^\/settings\/worlds\/maps\/([^/]+)\/access$/.exec(sourceUrl);
        const mapVisualsMatch = /^\/settings\/worlds\/maps\/([^/]+)$/.exec(sourceUrl);
        let response: Response;

        if (method === 'patch' && nodeMatch) {
            ({ response } = await apiClient.PATCH('/admin/world-builder/nodes/{node_id}', {
                body: body as components['schemas']['UpsertAdminWorldNodeRequest'],
                params: { header, path: { node_id: nodeMatch[1] } },
            }));
        } else if (method === 'post' && nodeInsertMatch) {
            const source = body as Record<string, unknown>;
            const { direction_q, direction_r, ...node } = source;
            ({ response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/insert', {
                body: {
                    direction: hexDirection(Number(direction_q), Number(direction_r)),
                    node: node as components['schemas']['UpsertAdminWorldNodeRequest'],
                },
                params: { header, path: { node_id: nodeInsertMatch[1] } },
            }));
        } else if (method === 'post' && mapNodesMatch) {
            ({ response } = await apiClient.POST('/admin/world-builder/maps/{map_id}/nodes', {
                body: body as components['schemas']['UpsertAdminWorldNodeRequest'],
                params: { header, path: { map_id: mapNodesMatch[1] } },
            }));
        } else if (method === 'post' && nodeResetMatch) {
            ({ response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/reset-unlocks', {
                params: { header, path: { node_id: nodeResetMatch[1] } },
            }));
        } else if (method === 'delete' && nodeMatch) {
            ({ response } = await apiClient.DELETE('/admin/world-builder/nodes/{node_id}', {
                params: { header, path: { node_id: nodeMatch[1] } },
            }));
        } else if (method === 'patch' && nodeSwapMatch) {
            const direction = body as { direction_q: number; direction_r: number };
            ({ response } = await apiClient.PATCH('/admin/world-builder/nodes/{node_id}/swap', {
                body: hexDirection(direction.direction_q, direction.direction_r),
                params: { header, path: { node_id: nodeSwapMatch[1] } },
            }));
        } else if (method === 'patch' && assetMatch) {
            ({ response } = await apiClient.PATCH('/admin/world-builder/assets/{asset_id}', {
                body: withoutFocusable(body),
                params: { header, path: { asset_id: assetMatch[1] } },
            }));
        } else if (method === 'patch' && mapVisualsMatch) {
            ({ response } = await apiClient.PATCH('/admin/world-builder/maps/{map_id}/visuals', {
                body: body as components['schemas']['UpdateAdminWorldMapVisualsRequest'],
                params: { header, path: { map_id: mapVisualsMatch[1] } },
            }));
        } else if (method === 'patch' && mapDetailsMatch) {
            const details = body as { description: string; title: string; updated_at: string };
            ({ response } = await apiClient.PATCH('/admin/world-builder/maps/{map_id}/details', {
                body: {
                    description: details.description || null,
                    map_assets_locked: document.editable_map.map.map_assets_locked,
                    title: details.title,
                    topic_id: document.editable_map.map.topic_id,
                    updated_at: details.updated_at,
                },
                params: { header, path: { map_id: mapDetailsMatch[1] } },
            }));
        } else if (method === 'patch' && mapAccessMatch) {
            ({ response } = await apiClient.PATCH('/admin/world-builder/maps/{map_id}/access', {
                body: body as components['schemas']['UpdateAdminWorldMapAccessRequest'],
                params: { header, path: { map_id: mapAccessMatch[1] } },
            }));
        } else {
            throw new Error(`Unsupported lifted World Builder route: ${method} ${sourceUrl}`);
        }

        complete(response, options, onUpdated);
    }, [document, onUpdated]);

    const uploadImage = useCallback(async (file: File, mapId: string) => {
        const token = await getCsrfToken();
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`/api/v1/admin/world-builder/maps/${mapId}/visual-media`, {
            body,
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token },
            method: 'POST',
        });
        const payload = await response.json() as { url?: string };
        if (!response.ok || !payload.url) {
            throw new Error('The image could not be uploaded.');
        }
        return { url: payload.url };
    }, []);

    const uploadSound = useCallback(async (file: File) => {
        const token = await getCsrfToken();
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/v1/admin/sounds/media', {
            body,
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token },
            method: 'POST',
        });
        const payload = await response.json() as { asset_id?: string };
        if (!response.ok || !payload.asset_id) {
            throw new Error('The sound could not be uploaded.');
        }
        return { url: `/api/v1/admin/media-assets/${payload.asset_id}/content` };
    }, []);

    const addMapAsset = useCallback(async (mapId: string) => {
        const token = await getCsrfToken();
        const { response } = await apiClient.POST('/admin/world-builder/maps/{map_id}/assets', {
            body: newMapAsset(),
            params: { header: { 'X-CSRF-Token': token }, path: { map_id: mapId } },
        });
        if (!response.ok) {
            throw new Error('The MapAsset could not be added.');
        }
        onUpdated();
    }, [onUpdated]);

    const importMapAsset = useCallback(async (mapId: string, file: File) => {
        const token = await getCsrfToken();
        const body = new FormData();
        body.append('manifest', file);
        const response = await fetch(`/api/v1/admin/world-builder/maps/${mapId}/asset-exports/import`, {
            body,
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token },
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('The MapAsset could not be imported.');
        }
        onUpdated();
    }, [onUpdated]);

    return {
        addMapAsset,
        delete: (url, options) => write('delete', url, undefined, options),
        importMapAsset,
        patch: (url, body, options) => write('patch', url, body, options),
        post: (url, body, options) => write('post', url, body, options),
        reload: () => onUpdated(),
        uploadImage,
        uploadSound,
    };
}

export function LiftedWorldBuilderEditMapDocument({
    document,
    onUpdated,
}: {
    document: Document;
    onUpdated: () => void;
}) {
    const transport = useRustTransport(document, onUpdated);

    return (
        <EditWorldMap
            accessGroups={document.access_groups as AccessGroup[]}
            editableMap={sourcePayload(document)}
            embedded
            items={document.items.map(({ id, title }) => ({ id, title }))}
            roleOptions={document.role_options as AccessRoleOption[]}
            tools={document.tools.map(({ id, slug, title }) => ({ id, slug, title }))}
            transport={transport}
        />
    );
}
