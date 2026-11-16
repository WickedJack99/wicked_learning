import { apiClient, getCsrfToken } from './api/client';
import {
    sourceItemGrantRequest,
    sourceItemObstacleRequest,
    sourceMarkdownRequest,
    sourceMessageRequest,
    sourceObstacleRequest,
    sourceOpenPracticeRequest,
    sourcePortalRequest,
    sourceQuestionRequest,
    sourceReflectionRequest,
    sourceSharedTaskRequest,
    sourceToolGrantRequest,
} from './lifted-source-activity-command-mapper';
import type {
    ActivityForm,
    StartRouteForm,
} from './lifted-world-builder-edit-node-activity-types';

export type WorldBuilderCommandResult = {
    ok: boolean;
    status: number;
};

function result(response: Response): WorldBuilderCommandResult {
    return { ok: response.ok, status: response.status };
}

function commandHeaders(token: string) {
    return { 'X-CSRF-Token': token };
}

export async function saveSourceActivity({
    activityId,
    form,
    nodeId,
    updatedAt,
}: {
    activityId?: string;
    form: ActivityForm;
    nodeId: string;
    updatedAt?: string;
}): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const params = { header: commandHeaders(token) };
    const update = Boolean(activityId);

    if (form.type === 'open_practice') {
        const body = sourceOpenPracticeRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/open-practice', {
                body: { ...body, updated_at: updatedAt ?? '' },
                params: { ...params, path: { activity_id: activityId! } },
            })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/open-practice-activities', {
                body,
                params: { ...params, path: { node_id: nodeId } },
            });

        return result(response.response);
    }

    if (form.type === 'review') {
        const body = sourceReflectionRequest(form);
        const response = update
            ? await apiClient.PATCH(
                '/admin/world-builder/activities/{activity_id}/review',
                { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } },
            )
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/review-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'reflection') {
        const body = sourceReflectionRequest(form);
        const response = update
            ? await apiClient.PATCH(
                '/admin/world-builder/activities/{activity_id}/reflection',
                { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } },
            )
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/reflection-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'markdown') {
        const body = sourceMarkdownRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/markdown', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/markdown-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'npc_dialogue') {
        const response = await apiClient.POST(
            '/admin/world-builder/nodes/{node_id}/npc-dialogue-activities',
            {
                body: {
                    introduction: form.introduction.trim() || null,
                    slug: form.slug.trim() || null,
                    title: form.title,
                },
                params: {
                    ...params,
                    path: { node_id: nodeId },
                },
            },
        );

        return result(response.response);
    }

    if (form.type === 'portal') {
        const body = sourcePortalRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/portal', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/portal-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'question') {
        const body = sourceQuestionRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/question', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/question-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'message_prompt' || form.type === 'message_wall') {
        const body = sourceMessageRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/message', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/message-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'shared_task') {
        const body = sourceSharedTaskRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/shared-task', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/shared-task-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'item_grant') {
        const body = sourceItemGrantRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/item-grant', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/item-grant-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'item_obstacle') {
        const body = sourceItemObstacleRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/item-obstacle', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/item-obstacle-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    if (form.type === 'obstacle') {
        const body = sourceObstacleRequest(form);
        const response = update
            ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/obstacle', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
            : await apiClient.POST('/admin/world-builder/nodes/{node_id}/obstacle-activities', { body, params: { ...params, path: { node_id: nodeId } } });

        return result(response.response);
    }

    const body = sourceToolGrantRequest(form);
    const response = update
        ? await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/tool-grant', { body: { ...body, updated_at: updatedAt ?? '' }, params: { ...params, path: { activity_id: activityId! } } })
        : await apiClient.POST('/admin/world-builder/nodes/{node_id}/tool-grant-activities', { body, params: { ...params, path: { node_id: nodeId } } });

    return result(response.response);
}

export async function deleteSourceActivity(activityId: string): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.DELETE('/admin/world-builder/activities/{activity_id}', {
        params: { header: commandHeaders(token), path: { activity_id: activityId } },
    });

    return result(response);
}

export async function updateSourceStartRoute(startRouteId: string, form: StartRouteForm): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.PATCH('/admin/world-builder/start-routes/{start_route_id}', {
        body: form,
        params: { header: commandHeaders(token), path: { start_route_id: startRouteId } },
    });

    return result(response);
}

export async function reorderSourceStartRoute(startRouteId: string, direction: 'up' | 'down'): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.POST('/admin/world-builder/start-routes/{start_route_id}/reorder', {
        body: { direction },
        params: { header: commandHeaders(token), path: { start_route_id: startRouteId } },
    });

    return result(response);
}

export async function deleteSourceStartRoute(startRouteId: string): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.DELETE('/admin/world-builder/start-routes/{start_route_id}', {
        params: { header: commandHeaders(token), path: { start_route_id: startRouteId } },
    });

    return result(response);
}

export async function addSourceStartRoute(nodeId: string, activityId: string): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/start-routes', {
        body: { activity_id: activityId },
        params: { header: commandHeaders(token), path: { node_id: nodeId } },
    });

    return result(response);
}

export async function removeSourceStartRoute(nodeId: string, activityId: string): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.DELETE('/admin/world-builder/nodes/{node_id}/start-routes/{activity_id}', {
        params: { header: commandHeaders(token), path: { activity_id: activityId, node_id: nodeId } },
    });

    return result(response);
}

export async function createSourceTransition(nodeId: string, connection: { fromActivityId: string; fromConnector: string; toActivityId: string | null; toConnector: string }): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/activity-transitions', {
        body: { from_activity_id: connection.fromActivityId, from_connector: connection.fromConnector, to_activity_id: connection.toActivityId, to_connector: connection.toConnector },
        params: { header: commandHeaders(token), path: { node_id: nodeId } },
    });

    return result(response);
}

export async function updateSourceTransition(transitionId: string, label: string, triggerValue: string): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.PATCH('/admin/world-builder/activity-transitions/{transition_id}', {
        body: { label: label.trim() || null, trigger_value: triggerValue.trim() || null },
        params: { header: commandHeaders(token), path: { transition_id: transitionId } },
    });

    return result(response);
}

export async function deleteSourceTransition(transitionId: string): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.DELETE('/admin/world-builder/activity-transitions/{transition_id}', {
        params: { header: commandHeaders(token), path: { transition_id: transitionId } },
    });

    return result(response);
}

export async function saveSourceGraphPosition(nodeId: string, node: 'start' | 'end', position: { x: number; y: number }): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.PATCH('/admin/world-builder/nodes/{node_id}/activity-graph-layout', {
        body: { node, position },
        params: { header: commandHeaders(token), path: { node_id: nodeId } },
    });

    return result(response);
}

export async function saveSourceActivityPosition(activityId: string, position: { x: number; y: number }): Promise<WorldBuilderCommandResult> {
    const token = await getCsrfToken();
    const { response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/graph-position', {
        body: { position },
        params: { header: commandHeaders(token), path: { activity_id: activityId } },
    });

    return result(response);
}
