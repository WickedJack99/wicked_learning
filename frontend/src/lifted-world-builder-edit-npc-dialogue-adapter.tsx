import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import EditNpcDialogue, {
} from './lifted-world-builder-edit-npc-dialogue';
import type { LiftedNpcDialogueTransport } from './lifted-world-builder-edit-npc-dialogue';

type DialogueGraph = components['schemas']['AdminNpcDialogueGraph'];
type EditableTool = components['schemas']['AdminEditableTool'];
type SourceOptions = Parameters<LiftedNpcDialogueTransport['patch']>[2];
type SourceNodeForm = {
    body: string;
    config: Record<string, unknown>;
    title: string;
    type: components['schemas']['AdminNpcDialogueNodeRequest']['node_type'];
};

/**
 * Converts only the snake_case Rust wire contract and UUID identifiers to the
 * pinned source page's prop shape. All dialogue editing UI remains in the
 * direct source lift.
 */
export function sourceNpcDialogueGraph(graph: DialogueGraph) {
    return {
        activity: {
            graphLayout: graphLayout(graph.activity.graph_layout),
            id: graph.activity.id,
            introduction: graph.activity.introduction,
            slug: graph.activity.slug,
            title: graph.activity.title,
        },
        dialogueNodes: graph.dialogue_nodes.map((node) => ({
            body: node.body,
            config: node.config,
            connector: node.connector,
            id: node.id,
            position: node.position,
            title: node.title,
            type: node.node_type,
        })),
        map: graph.map,
        node: graph.node,
        transitions: graph.transitions.map((transition) => ({
            fromConnector: transition.from_connector,
            fromNodeId: transition.from_node_id,
            id: transition.id,
            toConnector: transition.to_connector,
            toNodeId: transition.to_node_id,
        })),
        world: graph.world,
        worldNodes: graph.world_nodes.map((node) => ({
            id: node.id,
            mapTitle: node.map_title,
            title: node.title,
        })),
    };
}

function graphLayout(value: Record<string, unknown>): {
    end?: { x: number; y: number };
    start?: { x: number; y: number };
} {
    const layout: {
        end?: { x: number; y: number };
        start?: { x: number; y: number };
    } = {};

    for (const key of ['start', 'end'] as const) {
        const position = value[key];

        if (
            position &&
            typeof position === 'object' &&
            !Array.isArray(position) &&
            typeof (position as Record<string, unknown>).x === 'number' &&
            typeof (position as Record<string, unknown>).y === 'number'
        ) {
            layout[key] = {
                x: (position as Record<string, number>).x,
                y: (position as Record<string, number>).y,
            };
        }
    }

    return layout;
}

function sourceError(options: SourceOptions): void {
    options?.onError?.({
        form: 'The dialogue graph could not be saved. Refresh it and try again.',
    });
}

function complete(
    response: Response,
    options: SourceOptions,
    onUpdated: () => void,
): void {
    if (!response.ok) {
        sourceError(options);
        options?.onFinish?.();

        return;
    }

    onUpdated();
    options?.onSuccess?.();
    options?.onFinish?.();
}

function nullableText(value: string): string | null {
    return value === '' ? null : value;
}

async function readNpcDialogueGraph(
    activityId: string,
): Promise<DialogueGraph | null> {
    const { data, response } = await apiClient.GET(
        '/admin/world-builder/activities/{activity_id}/npc-dialogue',
        { params: { path: { activity_id: activityId } } },
    );

    return response.ok && data ? data : null;
}

function sourceNodeRequest(
    graph: DialogueGraph,
    dialogueNodeId: string,
    body: unknown,
): components['schemas']['AdminNpcDialogueNodeRequest'] {
    const current = graph.dialogue_nodes.find((node) => node.id === dialogueNodeId);

    if (!current) {
        throw new Error('The dialogue node is no longer part of this graph.');
    }

    const update = body as Partial<SourceNodeForm> & {
        graph_position_x?: number;
        graph_position_y?: number;
    };
    const positionX = update.graph_position_x;
    const positionY = update.graph_position_y;
    const moved =
        typeof positionX === 'number' &&
        typeof positionY === 'number';

    return {
        body: moved ? current.body : nullableText(update.body ?? current.body ?? ''),
        config: moved ? current.config : (update.config ?? current.config),
        node_type: moved ? current.node_type : (update.type ?? current.node_type),
        position: moved
            ? { x: positionX, y: positionY }
            : current.position.x === null
              ? null
              : { x: current.position.x, y: current.position.y ?? 0 },
        title: moved ? current.title : (update.title ?? current.title),
    };
}

function newNodeRequest(body: unknown): components['schemas']['AdminNpcDialogueNodeRequest'] {
    const form = body as SourceNodeForm;

    return {
        body: nullableText(form.body),
        config: form.config,
        node_type: form.type,
        position: null,
        title: form.title,
    };
}

/**
 * The only Laravel/Inertia replacement for the pinned page. It translates the
 * source route-shaped writes into the explicit Rust endpoints and preserves
 * full-node updates when the source page sends a drag-only patch.
 */
function useRustTransport(
    graph: DialogueGraph,
    onUpdated: () => void,
): LiftedNpcDialogueTransport {
    const write = useCallback(async (
        method: 'delete' | 'patch' | 'post',
        sourceUrl: string,
        body: unknown,
        options?: SourceOptions,
    ): Promise<void> => {
        try {
            const token = await getCsrfToken();
            const header = { 'X-CSRF-Token': token };
            const createNodeMatch = /^\/settings\/worlds\/activities\/([^/]+)\/npc-dialogue\/nodes$/.exec(sourceUrl);
            const nodeMatch = /^\/settings\/worlds\/npc-dialogue-nodes\/([^/]+)$/.exec(sourceUrl);
            const createTransitionMatch = /^\/settings\/worlds\/activities\/([^/]+)\/npc-dialogue\/transitions$/.exec(sourceUrl);
            const transitionMatch = /^\/settings\/worlds\/npc-dialogue-transitions\/([^/]+)$/.exec(sourceUrl);
            const layoutMatch = /^\/settings\/worlds\/activities\/([^/]+)\/graph-layout$/.exec(sourceUrl);
            let response: Response;

            if (method === 'post' && createNodeMatch) {
                ({ response } = await apiClient.POST('/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes', {
                    body: newNodeRequest(body),
                    params: { header, path: { activity_id: createNodeMatch[1] } },
                }));
            } else if (method === 'patch' && nodeMatch) {
                ({ response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes/{dialogue_node_id}', {
                    body: sourceNodeRequest(graph, nodeMatch[1], body),
                    params: {
                        header,
                        path: { activity_id: graph.activity.id, dialogue_node_id: nodeMatch[1] },
                    },
                }));
            } else if (method === 'delete' && nodeMatch) {
                ({ response } = await apiClient.DELETE('/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes/{dialogue_node_id}', {
                    params: {
                        header,
                        path: { activity_id: graph.activity.id, dialogue_node_id: nodeMatch[1] },
                    },
                }));
            } else if (method === 'post' && createTransitionMatch) {
                const transition = body as {
                    from_connector: string;
                    from_dialogue_node_id: string | null;
                    to_connector: string;
                    to_dialogue_node_id: string;
                };
                ({ response } = await apiClient.POST('/admin/world-builder/activities/{activity_id}/npc-dialogue/transitions', {
                    body: {
                        from_connector: transition.from_connector,
                        from_node_id: transition.from_dialogue_node_id,
                        to_connector: transition.to_connector,
                        to_node_id: transition.to_dialogue_node_id,
                    },
                    params: { header, path: { activity_id: createTransitionMatch[1] } },
                }));
            } else if (method === 'delete' && transitionMatch) {
                ({ response } = await apiClient.DELETE('/admin/world-builder/activities/{activity_id}/npc-dialogue/transitions/{transition_id}', {
                    params: {
                        header,
                        path: { activity_id: graph.activity.id, transition_id: transitionMatch[1] },
                    },
                }));
            } else if (method === 'patch' && layoutMatch) {
                const sourceLayout = body as { position: { x: number; y: number } };
                ({ response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/npc-dialogue/graph-layout', {
                    body: sourceLayout.position,
                    params: { header, path: { activity_id: layoutMatch[1] } },
                }));
            } else {
                throw new Error(`Unsupported lifted NPC dialogue route: ${method} ${sourceUrl}`);
            }

            complete(response, options, onUpdated);
        } catch {
            sourceError(options);
            options?.onFinish?.();
        }
    }, [graph, onUpdated]);

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

    return {
        delete: (url, options) => write('delete', url, undefined, options),
        patch: (url, body, options) => write('patch', url, body, options),
        post: (url, body, options) => write('post', url, body, options),
        uploadImage,
    };
}

export function LiftedNpcDialogueDocument({
    activityId,
    onBack,
    onUpdated,
    tools,
}: {
    activityId: string;
    onBack: () => void;
    onUpdated: () => void;
    tools: EditableTool[];
}) {
    const [graph, setGraph] = useState<DialogueGraph | null>(null);
    const [unavailable, setUnavailable] = useState(false);

    const load = useCallback(async () => {
        setUnavailable(false);
        const data = await readNpcDialogueGraph(activityId);

        if (!data) {
            setUnavailable(true);

            return;
        }

        setGraph(data);
    }, [activityId]);

    useEffect(() => {
        let disposed = false;

        void readNpcDialogueGraph(activityId)
            .then((data) => {
                if (disposed) {
                    return;
                }

                if (!data) {
                    setUnavailable(true);

                    return;
                }

                setGraph(data);
            })
            .catch(() => {
                if (!disposed) {
                    setUnavailable(true);
                }
            });

        return () => {
            disposed = true;
        };
    }, [activityId]);

    const handleUpdated = useCallback(() => {
        void load();
        onUpdated();
    }, [load, onUpdated]);
    const transport = useRustTransport(graph ?? emptyGraph(), handleUpdated);
    const sourceTools = useMemo(
        () => tools.map((tool) => ({
            id: tool.id,
            imageDark: tool.image_dark,
            imageLight: tool.image_light,
            slug: tool.slug,
            title: tool.title,
        })),
        [tools],
    );

    if (unavailable) {
        return (
            <section className="grid h-full place-items-center p-6 text-center">
                <div>
                    <h2 className="text-lg font-semibold">Dialogue graph unavailable</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        The dialogue graph could not be loaded. Return to the activity graph and try again.
                    </p>
                    <button className="mt-4 text-sm font-medium text-[var(--settings-accent)]" onClick={onBack} type="button">
                        Activity graph
                    </button>
                </div>
            </section>
        );
    }

    if (!graph) {
        return <div aria-live="polite" className="grid h-full place-items-center text-sm text-slate-500">Loading dialogue graph…</div>;
    }

    return (
        <EditNpcDialogue
            dialogueGraph={sourceNpcDialogueGraph(graph)}
            dialogueSoundSets={graph.typing_sound_sets.map((set) => ({
                id: set.id,
                isDefault: set.is_default,
                letters: [],
                name: set.name,
            }))}
            onBack={onBack}
            tools={sourceTools}
            transport={transport}
        />
    );
}

function emptyGraph(): DialogueGraph {
    return {
        activity: { graph_layout: {}, id: '', introduction: null, slug: '', title: '' },
        dialogue_nodes: [],
        map: { id: '', slug: '', title: '' },
        node: { id: '', slug: '', title: '' },
        transitions: [],
        typing_sound_sets: [],
        world: { id: '', slug: '', title: '' },
        world_nodes: [],
    };
}
