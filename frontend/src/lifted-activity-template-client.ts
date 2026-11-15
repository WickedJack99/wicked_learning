import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type {
    ActivityQuestion,
    ActivitySummary,
    ActivityTemplateDetails,
    ActivityTemplatePage,
    ActivityTemplateRevisionPage,
    ActivityTemplateSummary,
} from './lifted-world-builder-edit-node-activity-types';

type RustTemplate = components['schemas']['AdminActivityTemplateSummary'];

function templateSummary(template: RustTemplate): ActivityTemplateSummary {
    return {
        canManage: template.can_manage,
        id: template.id,
        name: template.name,
        organization: template.organization,
        title: template.title,
        type: template.activity_type,
        updatedAt: template.updated_at,
    };
}

function snapshot(value: Record<string, unknown>): ActivityTemplateDetails['snapshot'] {
    const config = value.config;

    if (!isRecord(config) || typeof value.title !== 'string' || typeof value.type !== 'string') {
        throw new Error('The reusable template snapshot is unavailable.');
    }

    return {
        companionConfig: isRecord(value.companionConfig) ? value.companionConfig : undefined,
        config: config as ActivitySummary['config'],
        introduction: typeof value.introduction === 'string' ? value.introduction : null,
        question: isRecord(value.question) ? value.question as ActivityQuestion : null,
        title: value.title,
        type: value.type,
    };
}

function templateDetails(
    template: components['schemas']['AdminActivityTemplateDetails'],
): ActivityTemplateDetails {
    return {
        ...templateSummary(template),
        mediaReferences: template.media_references.map((reference) => ({
            available: reference.available,
            url: reference.url,
        })),
        snapshot: snapshot(template.snapshot),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadActivityTemplates(
    page: number,
    search: string,
): Promise<ActivityTemplatePage> {
    const { data, response } = await apiClient.GET('/admin/activity-templates', {
        params: { query: { page, per_page: 4, search: search.trim() || undefined } },
    });

    if (!response.ok || !data) {
        throw new Error('The activity templates could not be loaded.');
    }

    return {
        items: data.items.map(templateSummary),
        pagination: {
            lastPage: data.pagination.last_page,
            page: data.pagination.page,
            perPage: data.pagination.per_page,
            total: data.pagination.total,
        },
        shareTargets: data.share_targets,
    };
}

export async function updateActivityTemplateFromActivity(templateId: string, activityId: string): Promise<ActivityTemplateSummary> {
    const token = await getCsrfToken();
    const { data, response } = await apiClient.PATCH('/admin/activity-templates/{template_id}/from-activity/{activity_id}', {
        params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activityId, template_id: templateId } },
    });

    if (!response.ok || !data) {
throw new Error('The activity template could not be updated.');
}

    return templateSummary(data.template);
}

export async function renameActivityTemplate(templateId: string, name: string): Promise<ActivityTemplateSummary> {
    const token = await getCsrfToken();
    const { data, response } = await apiClient.PATCH('/admin/activity-templates/{template_id}', {
        body: { name }, params: { header: { 'X-CSRF-Token': token }, path: { template_id: templateId } },
    });

    if (!response.ok || !data) {
throw new Error('The activity template could not be renamed.');
}

    return templateSummary(data.template);
}

export async function loadActivityTemplateRevisions(templateId: string, page: number): Promise<ActivityTemplateRevisionPage> {
    const { data, response } = await apiClient.GET('/admin/activity-templates/{template_id}/revisions', {
        params: { path: { template_id: templateId }, query: { page, per_page: 6 } },
    });

    if (!response.ok || !data) {
throw new Error('The activity template history could not be loaded.');
}

    return {
        items: data.items.map((revision) => ({
            createdAt: revision.created_at,
            id: revision.id,
            name: revision.name,
            title: revision.title,
            type: revision.activity_type,
        })),
        pagination: { lastPage: data.pagination.last_page, page: data.pagination.page, perPage: data.pagination.per_page, total: data.pagination.total },
    };
}

export async function restoreActivityTemplateRevision(templateId: string, revisionId: string): Promise<ActivityTemplateSummary> {
    const token = await getCsrfToken();
    const { data, response } = await apiClient.POST('/admin/activity-templates/{template_id}/revisions/{revision_id}', {
        params: { header: { 'X-CSRF-Token': token }, path: { revision_id: revisionId, template_id: templateId } },
    });

    if (!response.ok || !data) {
throw new Error('The activity template revision could not be restored.');
}

    return templateSummary(data.template);
}

export async function shareActivityTemplate(templateId: string, organizationId: string): Promise<ActivityTemplateSummary> {
    const token = await getCsrfToken();
    const { data, response } = await apiClient.PATCH('/admin/activity-templates/{template_id}/sharing', {
        body: { organization_id: organizationId || null }, params: { header: { 'X-CSRF-Token': token }, path: { template_id: templateId } },
    });

    if (!response.ok || !data) {
throw new Error('The template sharing setting could not be saved.');
}

    return templateSummary(data.template);
}

export async function deleteActivityTemplate(templateId: string): Promise<void> {
    const token = await getCsrfToken();
    const { response } = await apiClient.DELETE('/admin/activity-templates/{template_id}', {
        params: { header: { 'X-CSRF-Token': token }, path: { template_id: templateId } },
    });

    if (!response.ok) {
throw new Error('The activity template could not be deleted.');
}
}

export async function previewActivityTemplate(templateId: string): Promise<ActivityTemplateDetails> {
    const { data, response } = await apiClient.GET('/admin/activity-templates/{template_id}', {
        params: { path: { template_id: templateId } },
    });

    if (!response.ok || !data) {
throw new Error('The selected template could not be loaded.');
}

    return templateDetails(data.template);
}

export async function createActivityTemplate(activityId: string, name: string): Promise<ActivityTemplateSummary> {
    const token = await getCsrfToken();
    const { data, response } = await apiClient.POST('/admin/world-builder/activities/{activity_id}/templates', {
        body: { name }, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activityId } },
    });

    if (!response.ok || !data) {
throw new Error('The activity template could not be saved.');
}

    return templateSummary(data.template);
}
