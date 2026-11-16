import { useCallback } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import EditMarkdownActivity, {
    type LiftedMarkdownActivityPayload,
    type LiftedMarkdownTransport,
} from './lifted-world-builder-edit-markdown-activity';
import { sourceMarkdownRequest } from './lifted-source-activity-command-mapper';
import type { ActivityForm } from './lifted-world-builder-edit-node-activity-types';
import type { ActivitySummary } from './lifted-world-builder-edit-node-activity-types';

type ActivityGraph = components['schemas']['AdminActivityGraph'];
type SourceOptions = Parameters<LiftedMarkdownTransport['patch']>[2];

/**
 * Maps the existing scoped graph read once at the route boundary. The lifted
 * page remains the owner of the pinned source hierarchy and interaction state.
 */
export function sourceMarkdownActivity(
    graph: ActivityGraph,
    activityId: string,
): LiftedMarkdownActivityPayload | null {
    const activity = graph.activities.find(
        (candidate) =>
            candidate.id === activityId && candidate.activity_type === 'markdown',
    );

    if (!activity) {
        return null;
    }

    return {
        activity: {
            config: activity.config as ActivitySummary['config'],
            id: activity.id,
            introduction: activity.introduction,
            portalLink: null,
            question: null,
            slug: activity.slug,
            title: activity.title,
            type: activity.activity_type,
            updatedAt: activity.updated_at,
        },
        map: graph.map,
        node: graph.node,
        world: graph.world,
    };
}

function reportFailure(options: SourceOptions): void {
    options?.onError?.({
        updated_at:
            'The Markdown pages could not be saved. Refresh and try again.',
    });
    options?.onFinish?.();
}

function sourceSuccess(
    options: SourceOptions,
    updatedAt: string | undefined,
    onUpdated: () => void,
): void {
    onUpdated();
    options?.onSuccess?.({
        props: {
            markdownActivity: {
                activity: { updatedAt },
            },
        },
    });
    options?.onFinish?.();
}

/**
 * The only Laravel/Inertia replacement for the pinned Markdown page:
 * whole-form saves use the typed Markdown writer and special Start/End drags
 * use the source-preserving narrow layout writer.
 */
function useRustMarkdownTransport(
    activityId: string,
    onUpdated: () => void,
): LiftedMarkdownTransport {
    const patch = useCallback(
        async (
            sourceUrl: string,
            body: unknown,
            options?: SourceOptions,
        ): Promise<void> => {
            try {
                const token = await getCsrfToken();
                const header = { 'X-CSRF-Token': token };
                const saveMatch = /^\/settings\/worlds\/activities\/([^/]+)$/.exec(
                    sourceUrl,
                );
                const layoutMatch =
                    /^\/settings\/worlds\/activities\/([^/]+)\/graph-layout$/.exec(
                        sourceUrl,
                    );

                if (saveMatch?.[1] === activityId) {
                    const form = body as ActivityForm;
                    const request = sourceMarkdownRequest(form);
                    const { data, response } = await apiClient.PATCH(
                        '/admin/world-builder/activities/{activity_id}/markdown',
                        {
                            body: { ...request, updated_at: form.updated_at },
                            params: {
                                header,
                                path: { activity_id: activityId },
                            },
                        },
                    );

                    if (!response.ok) {
                        reportFailure(options);
                        return;
                    }

                    sourceSuccess(options, data?.updated_at, onUpdated);
                    return;
                }

                if (layoutMatch?.[1] === activityId) {
                    const request = body as {
                        node: 'end' | 'start';
                        position: { x: number; y: number };
                    };
                    const { data, response } = await apiClient.PATCH(
                        '/admin/world-builder/activities/{activity_id}/markdown/graph-layout',
                        {
                            body: request,
                            params: {
                                header,
                                path: { activity_id: activityId },
                            },
                        },
                    );

                    if (!response.ok) {
                        reportFailure(options);
                        return;
                    }

                    sourceSuccess(options, data?.updated_at, onUpdated);
                    return;
                }

                throw new Error(`Unsupported lifted Markdown route: ${sourceUrl}`);
            } catch {
                reportFailure(options);
            }
        },
        [activityId, onUpdated],
    );

    return { patch };
}

export function LiftedMarkdownActivityDocument({
    activityId,
    graph,
    onBack,
    onUpdated,
}: {
    activityId: string;
    graph: ActivityGraph;
    onBack: () => void;
    onUpdated: () => void;
}) {
    const markdownActivity = sourceMarkdownActivity(graph, activityId);
    const transport = useRustMarkdownTransport(activityId, onUpdated);

    if (!markdownActivity) {
        return (
            <main className="grid h-full min-h-0 place-items-center bg-slate-100 p-6 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-[#111820]">
                    <p className="font-semibold">Markdown pages are unavailable.</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Reload the selected MapAsset and try again.
                    </p>
                    <button
                        className="mt-4 text-sm font-medium text-[var(--settings-accent)] hover:underline"
                        onClick={onBack}
                        type="button"
                    >
                        Back to MapAsset
                    </button>
                </div>
            </main>
        );
    }

    return (
        <EditMarkdownActivity
            markdownActivity={markdownActivity}
            onBack={onBack}
            transport={transport}
        />
    );
}
