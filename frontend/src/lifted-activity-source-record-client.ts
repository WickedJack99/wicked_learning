import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type {
    EditableSourceRecord,
    SourceRecordPage,
    SourceRecordVersionPage,
    SourceReferenceForm,
} from './lifted-world-builder-edit-node-activity-types';

type SourceRecord = components['schemas']['AdminSourceRecord'];

const adaptSourceRecord = (record: SourceRecord): EditableSourceRecord => ({
    anchor: record.anchor ?? '',
    concepts: record.concepts,
    excerpt: record.excerpt ?? '',
    id: record.id,
    publishedAt: record.published_at ?? '',
    publisher: record.publisher ?? '',
    rights: record.rights ?? '',
    title: record.title,
    url: record.url,
});

const requestBody = (reference: SourceReferenceForm) => ({
    anchor: reference.anchor || null,
    concepts: reference.concepts,
    excerpt: reference.excerpt || null,
    published_at: reference.publishedAt || null,
    publisher: reference.publisher || null,
    rights: reference.rights || null,
    title: reference.title,
    url: reference.url,
});

export async function loadActivitySourceRecords(
    page: number,
    search: string,
    concept: string,
): Promise<SourceRecordPage> {
    const { data, response } = await apiClient.GET('/admin/source-records', {
        params: {
            query: {
                concept: concept || undefined,
                page,
                per_page: 12,
                search: search || undefined,
            },
        },
    });
    if (!response.ok || !data) throw new Error('source catalog unavailable');
    return {
        items: data.items.map(adaptSourceRecord),
        pagination: {
            currentPage: data.pagination.current_page,
            lastPage: data.pagination.last_page,
            perPage: data.pagination.per_page,
            total: data.pagination.total,
        },
    };
}

export async function loadActivitySourceRecordVersions(
    id: string,
    page: number,
): Promise<SourceRecordVersionPage> {
    const { data, response } = await apiClient.GET('/admin/source-records/{source_id}/versions', { params: { path: { source_id: id }, query: { page, per_page: 8 } } });
    if (!response.ok || !data) throw new Error('source history unavailable');
    return { items: data.items.map((version) => ({ ...adaptSourceRecord(version.source_record), createdAt: version.created_at, id: version.id })), pagination: { lastPage: data.pagination.last_page, page: data.pagination.page, perPage: data.pagination.per_page, total: data.pagination.total } };
}

export async function createActivitySourceRecord(reference: SourceReferenceForm): Promise<void> {
    const token = await getCsrfToken();
    const { response } = await apiClient.POST('/admin/source-records', { body: requestBody(reference), params: { header: { 'X-CSRF-Token': token } } });
    if (!response.ok) throw new Error('source create unavailable');
}

export async function updateActivitySourceRecord(id: string, reference: SourceReferenceForm): Promise<void> {
    const token = await getCsrfToken();
    const { response } = await apiClient.PATCH('/admin/source-records/{source_id}', { body: requestBody(reference), params: { header: { 'X-CSRF-Token': token }, path: { source_id: id } } });
    if (!response.ok) throw new Error('source update unavailable');
}

export async function deleteActivitySourceRecord(id: string): Promise<void> {
    const token = await getCsrfToken();
    const { response } = await apiClient.DELETE('/admin/source-records/{source_id}', { params: { header: { 'X-CSRF-Token': token }, path: { source_id: id } } });
    if (!response.ok) throw new Error('source delete unavailable');
}

export async function restoreActivitySourceRecordVersion(sourceId: string, versionId: string): Promise<EditableSourceRecord> {
    const token = await getCsrfToken();
    const { data, response } = await apiClient.POST('/admin/source-records/{source_id}/versions/{version_id}', { params: { header: { 'X-CSRF-Token': token }, path: { source_id: sourceId, version_id: versionId } } });
    if (!response.ok || !data) throw new Error('source restore unavailable');
    return adaptSourceRecord(data.source_record);
}
