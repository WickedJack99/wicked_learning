import { Head, Link, router } from '@inertiajs/react';
import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Connection } from '@xyflow/react';
import {
    ArrowLeft,
    ArrowRight,
    AlertTriangle,
    Check,
    GitBranch,
    History,
    Pencil,
    Plus,
    RefreshCw,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColorField } from '@/components/color-input';
import InputError from '@/components/input-error';
import { PaginationControls } from '@/components/pagination-controls';
import { ReusableImagePicker } from '@/components/reusable-image-picker';
import { SettingsConfigurationDialog } from '@/components/settings-configuration-dialog';
import { SettingsConfigurationSection } from '@/components/settings-configuration-section';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActivityReviewMetadataSuggestions } from '@/features/ai/activity-review-client';
import { ActivityReviewDialog } from '@/features/ai/activity-review-dialog';
import { ActivityHistoryDialog } from '@/features/settings/activity-history-dialog';
import { useAppearance } from '@/hooks/use-appearance';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import { ConfigImageInput } from './activity-config-fields';
import { ActivityFormFields } from './activity-form-fields';
import { activityFormPayload } from './activity-form-payload';
import {
    activityFormFromActivity,
    emptyCreateForm,
} from './activity-form-state';
import {
    activityNodeTypes,
    buildGraphEdges,
    buildGraphNodes,
    routeActivityTitle,
} from './activity-graph-elements';
import { themedPreviewAsset } from './activity-scene-preview';
import { activityTemplateContext } from './activity-template-context';
import {
    isImageMediaReference,
    replaceTemplateMediaReferences,
} from './activity-template-media';
import type { TemplateMediaReplacements } from './activity-template-media';
import type {
    ActivityForm,
    ActivityTemplateTargetGraph,
    ActivityGraphEdge,
    ActivityGraphNode,
    ActivityGraphPayload,
    ActivityNodeData,
    ActivityStartRoute,
    ActivityTransitionSummary,
    ActivitySummary,
    ActivityTemplateDetails,
    ActivityTemplatePage,
    ActivityTemplateRevision,
    ActivityTemplateRevisionPage,
    ActivityTemplateSummary,
    EditableSourceRecord,
    EditableItem,
    EditableSound,
    EditableTool,
    SourceRecordPage,
    SourceReferenceForm,
    SourceRecordVersionPage,
    StartRouteForm,
} from './edit-node-activity-types';
import { useNodeImageUpload } from './use-node-image-upload';

export default function EditNodeActivities({
    activityGraph,
    embedded = false,
    items,
    sounds,
    tools,
    worldGraph,
}: {
    activityGraph: ActivityGraphPayload;
    worldGraph: ActivityTemplateTargetGraph | null;
    embedded?: boolean;
    items: EditableItem[];
    sounds: EditableSound[];
    tools: EditableTool[];
}) {
    const { resolvedAppearance } = useAppearance();
    const t = usePlatformTranslation();
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const firstType = activityGraph.activityTypes[0]?.key ?? 'open_practice';
    const [form, setForm] = useState<ActivityForm>(() =>
        emptyCreateForm(firstType),
    );
    const [duplicateSourceTitle, setDuplicateSourceTitle] = useState<
        string | null
    >(null);
    const [targetNodeId, setTargetNodeId] = useState(() =>
        String(activityGraph.node.id),
    );
    const [editOpen, setEditOpen] = useState(false);
    const [editingActivity, setEditingActivity] =
        useState<ActivitySummary | null>(null);
    const [editForm, setEditForm] = useState<ActivityForm>(() =>
        emptyCreateForm(firstType),
    );
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
    const [templateSaveActivity, setTemplateSaveActivity] =
        useState<ActivitySummary | null>(null);
    const [templateUpdateActivity, setTemplateUpdateActivity] =
        useState<ActivitySummary | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [activityTemplates, setActivityTemplates] = useState<
        ActivityTemplateSummary[]
    >([]);
    const [activityTemplatesPagination, setActivityTemplatesPagination] =
        useState<ActivityTemplatePage['pagination']>({
            lastPage: 1,
            page: 1,
            perPage: 4,
            total: 0,
        });
    const [activityTemplateSearch, setActivityTemplateSearch] = useState('');
    const [shareTargets, setShareTargets] = useState<
        ActivityTemplatePage['shareTargets']
    >([]);
    const [managingActivityTemplates, setManagingActivityTemplates] =
        useState(false);
    const [editingActivityTemplate, setEditingActivityTemplate] =
        useState<ActivityTemplateSummary | null>(null);
    const [editingActivityTemplateName, setEditingActivityTemplateName] =
        useState('');
    const [updatingActivityTemplate, setUpdatingActivityTemplate] =
        useState(false);
    const [sharingActivityTemplateId, setSharingActivityTemplateId] = useState<
        number | null
    >(null);
    const [deletingActivityTemplateId, setDeletingActivityTemplateId] =
        useState<number | null>(null);
    const [loadingActivityTemplates, setLoadingActivityTemplates] =
        useState(false);
    const [activityTemplateError, setActivityTemplateError] = useState<
        string | null
    >(null);
    const [templateHistory, setTemplateHistory] =
        useState<ActivityTemplateSummary | null>(null);
    const [templateRevisions, setTemplateRevisions] = useState<
        ActivityTemplateRevision[]
    >([]);
    const [templateRevisionPagination, setTemplateRevisionPagination] =
        useState<ActivityTemplateRevisionPage['pagination']>({
            lastPage: 1,
            page: 1,
            perPage: 6,
            total: 0,
        });
    const [loadingTemplateRevisions, setLoadingTemplateRevisions] =
        useState(false);
    const [restoringTemplateRevisionId, setRestoringTemplateRevisionId] =
        useState<number | null>(null);
    const [loadingTemplateId, setLoadingTemplateId] = useState<number | null>(
        null,
    );
    const [previewingActivityTemplate, setPreviewingActivityTemplate] =
        useState<ActivityTemplateDetails | null>(null);
    const [templateMediaReplacements, setTemplateMediaReplacements] =
        useState<TemplateMediaReplacements>({});
    const [templateMediaPickerReference, setTemplateMediaPickerReference] =
        useState<string | null>(null);
    const [sourceRecords, setSourceRecords] = useState<EditableSourceRecord[]>(
        () => activityGraph.sourceRecords,
    );
    const [sourceRecordsPagination, setSourceRecordsPagination] = useState(
        () => activityGraph.sourceRecordsPagination,
    );
    const [updating, setUpdating] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<ActivitySummary | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);
    const [selectedActivity, setSelectedActivity] =
        useState<ActivitySummary | null>(null);
    const [selectedTransition, setSelectedTransition] =
        useState<ActivityTransitionSummary | null>(null);
    const [transitionLabel, setTransitionLabel] = useState('');
    const [transitionTriggerValue, setTransitionTriggerValue] = useState('');
    const [transitionErrors, setTransitionErrors] = useState<
        Record<string, string>
    >({});
    const [updatingTransition, setUpdatingTransition] = useState(false);
    const [deletingTransition, setDeletingTransition] = useState(false);
    const [reviewingActivity, setReviewingActivity] =
        useState<ActivitySummary | null>(() => {
            if (typeof window === 'undefined') {
                return null;
            }

            const reviewActivityId = Number(
                new URLSearchParams(window.location.search).get(
                    'reviewActivity',
                ),
            );

            return Number.isInteger(reviewActivityId) && reviewActivityId > 0
                ? (activityGraph.activities.find(
                      (activity) => activity.id === reviewActivityId,
                  ) ?? null)
                : null;
        });
    const [selectedStartRoute, setSelectedStartRoute] =
        useState<ActivityStartRoute | null>(null);
    const [startRouteForm, setStartRouteForm] = useState<StartRouteForm>({
        button_border_color_dark: '',
        button_border_color_light: '',
        button_color_dark: '',
        button_color_light: '',
        description: '',
        image_dark: '',
        image_light: '',
        label: '',
    });
    const [startRouteErrors, setStartRouteErrors] = useState<
        Record<string, string>
    >({});
    const [updatingStartRoute, setUpdatingStartRoute] = useState(false);
    const [pendingDeleteStartRoute, setPendingDeleteStartRoute] =
        useState<ActivityStartRoute | null>(null);
    const [deletingStartRoute, setDeletingStartRoute] = useState(false);
    const {
        imageUploadErrors,
        resetImageUploadErrors,
        uploadNodeImage,
        uploadingImageKey,
    } = useNodeImageUpload(activityGraph.map.id);

    const saveSourceRecord = useCallback(
        async (reference: SourceReferenceForm): Promise<void> => {
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await fetch('/settings/worlds/source-records', {
                body: JSON.stringify(reference),
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('The source could not be saved.');
            }

            const payload = (await response.json()) as {
                sourceRecord: EditableSourceRecord;
            };
            setSourceRecords((current) => [
                payload.sourceRecord,
                ...current.filter(
                    (source) => source.id !== payload.sourceRecord.id,
                ),
            ]);
        },
        [],
    );

    const loadSourceRecords = useCallback(
        async (
            page: number,
            search: string,
            concept: string,
        ): Promise<SourceRecordPage> => {
            const params = new URLSearchParams({
                page: String(page),
                per_page: '12',
            });

            if (search.trim() !== '') {
                params.set('search', search.trim());
            }

            if (concept.trim() !== '') {
                params.set('concept', concept.trim());
            }

            const response = await fetch(
                `/settings/worlds/source-records?${params.toString()}`,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            if (!response.ok) {
                throw new Error('The source records could not be loaded.');
            }

            const payload = (await response.json()) as SourceRecordPage;
            setSourceRecords(payload.items);
            setSourceRecordsPagination(payload.pagination);

            return payload;
        },
        [],
    );

    const updateSourceRecord = useCallback(
        async (id: number, reference: SourceReferenceForm): Promise<void> => {
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await fetch(
                `/settings/worlds/source-records/${id}`,
                {
                    body: JSON.stringify(reference),
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    method: 'PATCH',
                },
            );

            if (!response.ok) {
                throw new Error('The source could not be updated.');
            }

            const payload = (await response.json()) as {
                sourceRecord: EditableSourceRecord;
            };
            setSourceRecords((current) =>
                current.map((source) =>
                    source.id === payload.sourceRecord.id
                        ? payload.sourceRecord
                        : source,
                ),
            );
        },
        [],
    );

    const deleteSourceRecord = useCallback(
        async (id: number): Promise<void> => {
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await fetch(
                `/settings/worlds/source-records/${id}`,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    method: 'DELETE',
                },
            );

            if (!response.ok) {
                throw new Error('The source could not be deleted.');
            }

            setSourceRecords((current) =>
                current.filter((source) => source.id !== id),
            );
        },
        [],
    );

    const loadSourceRecordVersions = useCallback(
        async (id: number, page: number): Promise<SourceRecordVersionPage> => {
            const response = await fetch(
                `/settings/worlds/source-records/${id}/versions?page=${page}&per_page=8`,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            if (!response.ok) {
                throw new Error('The source history could not be loaded.');
            }

            return (await response.json()) as SourceRecordVersionPage;
        },
        [],
    );

    const restoreSourceRecordVersion = useCallback(
        async (
            sourceId: number,
            versionId: number,
        ): Promise<EditableSourceRecord> => {
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await fetch(
                `/settings/worlds/source-records/${sourceId}/versions/${versionId}/restore`,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    method: 'POST',
                },
            );

            if (!response.ok) {
                throw new Error('The source version could not be restored.');
            }

            const payload = (await response.json()) as {
                sourceRecord: EditableSourceRecord;
            };
            setSourceRecords((current) =>
                current.map((source) =>
                    source.id === payload.sourceRecord.id
                        ? payload.sourceRecord
                        : source,
                ),
            );

            return payload.sourceRecord;
        },
        [],
    );

    const openEdit = useCallback(
        (activity: ActivitySummary) => {
            setEditingActivity(activity);
            setEditForm(activityFormFromActivity(activity, firstType));
            setEditErrors({});
            resetImageUploadErrors();
            setEditOpen(true);
        },
        [firstType, resetImageUploadErrors],
    );

    const requestDelete = useCallback((activity: ActivitySummary) => {
        setPendingDelete(activity);
    }, []);

    const useAsStartingPoint = useCallback(
        (activity: ActivitySummary) => {
            setForm({
                ...activityFormFromActivity(activity, firstType),
                slug: '',
                title: `${activity.title} (copy)`,
            });
            setDuplicateSourceTitle(activity.title);
            setTargetNodeId(String(activityGraph.node.id));
            setErrors({});
            resetImageUploadErrors();
            setCreateOpen(true);
        },
        [activityGraph.node.id, firstType, resetImageUploadErrors],
    );

    const requestSaveTemplate = useCallback((activity: ActivitySummary) => {
        setTemplateSaveActivity(activity);
        setTemplateName(activity.title);
    }, []);

    const loadActivityTemplates = useCallback(
        async (page = 1, search = ''): Promise<ActivityTemplatePage | null> => {
            setLoadingActivityTemplates(true);
            setActivityTemplateError(null);
            const params = new URLSearchParams({
                page: String(page),
                per_page: '4',
            });

            if (search.trim() !== '') {
                params.set('search', search.trim());
            }

            try {
                const response = await fetch(
                    `/settings/worlds/activity-templates?${params.toString()}`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The activity templates could not be loaded.',
                    );
                }

                const payload = (await response.json()) as ActivityTemplatePage;
                setActivityTemplates(payload.items);
                setActivityTemplatesPagination(payload.pagination);
                setShareTargets(payload.shareTargets);

                return payload;
            } catch (error) {
                setActivityTemplateError(
                    error instanceof Error
                        ? error.message
                        : 'The activity templates could not be loaded.',
                );

                return null;
            } finally {
                setLoadingActivityTemplates(false);
            }
        },
        [],
    );

    const requestUpdateTemplate = useCallback(
        (activity: ActivitySummary): void => {
            setTemplateUpdateActivity(activity);
            setActivityTemplateError(null);
            void loadActivityTemplates(1);
        },
        [loadActivityTemplates],
    );

    const updateTemplateFromActivity = useCallback(
        async (template: ActivityTemplateSummary): Promise<void> => {
            if (!templateUpdateActivity) {
                return;
            }

            setUpdatingActivityTemplate(true);
            setActivityTemplateError(null);
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';

            try {
                const response = await fetch(
                    `/settings/worlds/activity-templates/${template.id}/from-activity/${templateUpdateActivity.id}`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        method: 'PATCH',
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The activity template could not be updated.',
                    );
                }

                const payload = (await response.json()) as {
                    template: ActivityTemplateSummary;
                };
                setActivityTemplates((current) =>
                    current.map((currentTemplate) =>
                        currentTemplate.id === payload.template.id
                            ? payload.template
                            : currentTemplate,
                    ),
                );
                setTemplateUpdateActivity(null);
            } catch (error) {
                setActivityTemplateError(
                    error instanceof Error
                        ? error.message
                        : 'The activity template could not be updated.',
                );
            } finally {
                setUpdatingActivityTemplate(false);
            }
        },
        [templateUpdateActivity],
    );

    const beginRenameActivityTemplate = useCallback(
        (template: ActivityTemplateSummary): void => {
            setEditingActivityTemplate(template);
            setEditingActivityTemplateName(template.name);
            setActivityTemplateError(null);
        },
        [],
    );

    const cancelRenameActivityTemplate = useCallback((): void => {
        setEditingActivityTemplate(null);
        setEditingActivityTemplateName('');
        setActivityTemplateError(null);
    }, []);

    const renameActivityTemplate = useCallback(async (): Promise<void> => {
        if (
            !editingActivityTemplate ||
            editingActivityTemplateName.trim() === ''
        ) {
            return;
        }

        setUpdatingActivityTemplate(true);
        setActivityTemplateError(null);
        const csrfToken =
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                ?.content ?? '';

        try {
            const response = await fetch(
                `/settings/worlds/activity-templates/${editingActivityTemplate.id}`,
                {
                    body: JSON.stringify({
                        name: editingActivityTemplateName.trim(),
                    }),
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    method: 'PATCH',
                },
            );

            if (!response.ok) {
                throw new Error(
                    t(
                        'settings.worlds.activities.template.rename_error',
                        'The activity template could not be renamed.',
                    ),
                );
            }

            const payload = (await response.json()) as {
                template: ActivityTemplateSummary;
            };
            setActivityTemplates((current) =>
                current.map((template) =>
                    template.id === payload.template.id
                        ? payload.template
                        : template,
                ),
            );
            cancelRenameActivityTemplate();
        } catch (error) {
            setActivityTemplateError(
                error instanceof Error
                    ? error.message
                    : t(
                          'settings.worlds.activities.template.rename_error',
                          'The activity template could not be renamed.',
                      ),
            );
        } finally {
            setUpdatingActivityTemplate(false);
        }
    }, [
        cancelRenameActivityTemplate,
        editingActivityTemplate,
        editingActivityTemplateName,
        t,
    ]);

    const loadTemplateRevisions = useCallback(
        async (template: ActivityTemplateSummary, page = 1): Promise<void> => {
            setLoadingTemplateRevisions(true);
            setActivityTemplateError(null);

            try {
                const params = new URLSearchParams({
                    page: String(page),
                    per_page: '6',
                });
                const response = await fetch(
                    `/settings/worlds/activity-templates/${template.id}/revisions?${params.toString()}`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The activity template history could not be loaded.',
                    );
                }

                const payload =
                    (await response.json()) as ActivityTemplateRevisionPage;
                setTemplateRevisions(payload.items);
                setTemplateRevisionPagination(payload.pagination);
            } catch (error) {
                setActivityTemplateError(
                    error instanceof Error
                        ? error.message
                        : 'The activity template history could not be loaded.',
                );
            } finally {
                setLoadingTemplateRevisions(false);
            }
        },
        [],
    );

    const openTemplateHistory = useCallback(
        (template: ActivityTemplateSummary): void => {
            setTemplateHistory(template);
            void loadTemplateRevisions(template);
        },
        [loadTemplateRevisions],
    );

    const restoreTemplateRevision = useCallback(
        async (revision: ActivityTemplateRevision): Promise<void> => {
            if (!templateHistory) {
                return;
            }

            if (
                !window.confirm(
                    `Restore “${revision.title}” to ${templateHistory.name}? The current template will be kept in history.`,
                )
            ) {
                return;
            }

            setRestoringTemplateRevisionId(revision.id);
            setActivityTemplateError(null);
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';

            try {
                const response = await fetch(
                    `/settings/worlds/activity-templates/${templateHistory.id}/revisions/${revision.id}/restore`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        method: 'POST',
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The activity template revision could not be restored.',
                    );
                }

                const payload = (await response.json()) as {
                    template: ActivityTemplateSummary;
                };
                setActivityTemplates((current) =>
                    current.map((template) =>
                        template.id === payload.template.id
                            ? payload.template
                            : template,
                    ),
                );
                await loadTemplateRevisions(
                    payload.template,
                    templateRevisionPagination.page,
                );
            } catch (error) {
                setActivityTemplateError(
                    error instanceof Error
                        ? error.message
                        : 'The activity template revision could not be restored.',
                );
            } finally {
                setRestoringTemplateRevisionId(null);
            }
        },
        [
            loadTemplateRevisions,
            templateHistory,
            templateRevisionPagination.page,
        ],
    );

    const shareActivityTemplate = useCallback(
        async (
            template: ActivityTemplateSummary,
            organizationId: string,
        ): Promise<void> => {
            setSharingActivityTemplateId(template.id);
            setActivityTemplateError(null);
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';

            try {
                const response = await fetch(
                    `/settings/worlds/activity-templates/${template.id}/sharing`,
                    {
                        body: JSON.stringify({
                            organization_id:
                                organizationId === ''
                                    ? null
                                    : Number(organizationId),
                        }),
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        method: 'PATCH',
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The template sharing setting could not be saved.',
                    );
                }

                const payload = (await response.json()) as {
                    template: ActivityTemplateSummary;
                };
                setActivityTemplates((current) =>
                    current.map((currentTemplate) =>
                        currentTemplate.id === payload.template.id
                            ? payload.template
                            : currentTemplate,
                    ),
                );
            } catch (error) {
                setActivityTemplateError(
                    error instanceof Error
                        ? error.message
                        : 'The template sharing setting could not be saved.',
                );
            } finally {
                setSharingActivityTemplateId(null);
            }
        },
        [],
    );

    const deleteActivityTemplate = useCallback(
        async (template: ActivityTemplateSummary): Promise<void> => {
            if (
                !window.confirm(
                    t(
                        'settings.worlds.activities.template.delete_confirm',
                        'Delete this private template? Existing activities will not change.',
                    ),
                )
            ) {
                return;
            }

            setDeletingActivityTemplateId(template.id);
            setActivityTemplateError(null);
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const page = activityTemplatesPagination.page;

            try {
                const response = await fetch(
                    `/settings/worlds/activity-templates/${template.id}`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        method: 'DELETE',
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        t(
                            'settings.worlds.activities.template.delete_error',
                            'The activity template could not be deleted.',
                        ),
                    );
                }

                const payload = await loadActivityTemplates(
                    page,
                    activityTemplateSearch,
                );

                if (
                    payload &&
                    payload.items.length === 0 &&
                    payload.pagination.lastPage < page
                ) {
                    await loadActivityTemplates(
                        payload.pagination.lastPage,
                        activityTemplateSearch,
                    );
                }

                if (editingActivityTemplate?.id === template.id) {
                    cancelRenameActivityTemplate();
                }
            } catch (error) {
                setActivityTemplateError(
                    error instanceof Error
                        ? error.message
                        : t(
                              'settings.worlds.activities.template.delete_error',
                              'The activity template could not be deleted.',
                          ),
                );
            } finally {
                setDeletingActivityTemplateId(null);
            }
        },
        [
            activityTemplateSearch,
            activityTemplatesPagination.page,
            cancelRenameActivityTemplate,
            editingActivityTemplate,
            loadActivityTemplates,
            t,
        ],
    );

    const previewSavedTemplate = useCallback(
        async (template: ActivityTemplateSummary): Promise<void> => {
            setLoadingTemplateId(template.id);
            setActivityTemplateError(null);

            try {
                const response = await fetch(
                    `/settings/worlds/activity-templates/${template.id}`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The selected template could not be loaded.',
                    );
                }

                const payload = (await response.json()) as {
                    template: ActivityTemplateDetails;
                };
                setTemplateMediaReplacements({});
                setPreviewingActivityTemplate(payload.template);
            } catch (error) {
                setActivityTemplateError(
                    error instanceof Error
                        ? error.message
                        : 'The selected template could not be loaded.',
                );
            } finally {
                setLoadingTemplateId(null);
            }
        },
        [],
    );

    const applyTemplatePreview = useCallback((): void => {
        if (!previewingActivityTemplate) {
            return;
        }

        const snapshot = previewingActivityTemplate.snapshot;
        const resolvedConfig = replaceTemplateMediaReferences(
            snapshot.config,
            templateMediaReplacements,
        ) as ActivitySummary['config'];
        const formSource = {
            config: resolvedConfig,
            introduction: snapshot.introduction,
            portalLink: null,
            question: snapshot.question ?? null,
            slug: '',
            title: snapshot.title,
            type: snapshot.type,
        };

        setForm({
            ...activityFormFromActivity(formSource, firstType),
            slug: '',
            title: `${snapshot.title} (copy)`,
        });
        setDuplicateSourceTitle(previewingActivityTemplate.name);
        setTargetNodeId(String(activityGraph.node.id));
        setErrors({});
        resetImageUploadErrors();
        setPreviewingActivityTemplate(null);
        setTemplateMediaReplacements({});
    }, [
        activityGraph.node.id,
        firstType,
        previewingActivityTemplate,
        resetImageUploadErrors,
        templateMediaReplacements,
    ]);

    const saveActivityTemplate = useCallback(async (): Promise<void> => {
        if (!templateSaveActivity || templateName.trim() === '') {
            return;
        }

        setSavingTemplate(true);
        setActivityTemplateError(null);
        const csrfToken =
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                ?.content ?? '';

        try {
            const response = await fetch(
                `/settings/worlds/activities/${templateSaveActivity.id}/templates`,
                {
                    body: JSON.stringify({ name: templateName.trim() }),
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    method: 'POST',
                },
            );

            if (!response.ok) {
                throw new Error('The activity template could not be saved.');
            }

            setTemplateSaveActivity(null);
            setTemplateName('');

            if (createOpen && !duplicateSourceTitle) {
                await loadActivityTemplates(1);
            }
        } catch (error) {
            setActivityTemplateError(
                error instanceof Error
                    ? error.message
                    : 'The activity template could not be saved.',
            );
        } finally {
            setSavingTemplate(false);
        }
    }, [
        createOpen,
        duplicateSourceTitle,
        loadActivityTemplates,
        templateName,
        templateSaveActivity,
    ]);

    const requestReview = useCallback((activity: ActivitySummary) => {
        setReviewingActivity(activity);
    }, []);

    const editWithReviewSuggestions = useCallback(
        (
            activityId: number,
            suggestions: ActivityReviewMetadataSuggestions,
        ) => {
            const activity =
                activityGraph.activities.find(
                    (candidate) => candidate.id === activityId,
                ) ?? null;

            if (!activity) {
                return;
            }

            const currentForm = activityFormFromActivity(activity, firstType);

            setEditingActivity(activity);
            setEditForm({
                ...currentForm,
                competence_topics:
                    suggestions.suggestedCompetenceTopics.length > 0
                        ? suggestions.suggestedCompetenceTopics.map(
                              (topic) => ({
                                  topic,
                                  weight: '1',
                              }),
                          )
                        : currentForm.competence_topics,
                learning_intent:
                    suggestions.suggestedLearningIntent ??
                    currentForm.learning_intent,
            });
            setEditErrors({});
            resetImageUploadErrors();
            setReviewingActivity(null);
            setEditOpen(true);
        },
        [activityGraph.activities, firstType, resetImageUploadErrors],
    );

    const initialNodes = useMemo(
        () =>
            buildGraphNodes(
                activityGraph,
                openEdit,
                requestDelete,
                useAsStartingPoint,
                requestReview,
                requestSaveTemplate,
                requestUpdateTemplate,
            ),
        [
            activityGraph,
            openEdit,
            requestDelete,
            requestReview,
            requestSaveTemplate,
            requestUpdateTemplate,
            useAsStartingPoint,
        ],
    );
    const initialEdges = useMemo(
        () => buildGraphEdges(activityGraph),
        [activityGraph],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
    useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);
    useEffect(() => {
        if (!reviewingActivity || typeof window === 'undefined') {
            return;
        }

        const reviewActivityId = Number(
            new URLSearchParams(window.location.search).get('reviewActivity'),
        );

        if (reviewActivityId !== reviewingActivity.id) {
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.delete('reviewActivity');
        window.history.replaceState(window.history.state, '', url);
    }, [reviewingActivity]);
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key !== 'Delete' ||
                !selectedActivity ||
                createOpen ||
                editOpen ||
                pendingDelete
            ) {
                return;
            }

            if (isEditableTarget(event.target)) {
                return;
            }

            event.preventDefault();
            setPendingDelete(selectedActivity);
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [createOpen, editOpen, pendingDelete, selectedActivity]);

    const selectedType = activityGraph.activityTypes.find(
        (type) => type.key === form.type,
    );
    const selectedEditType = activityGraph.activityTypes.find(
        (type) => type.key === editForm.type,
    );
    const copiedTemplateContext = duplicateSourceTitle
        ? activityTemplateContext(form)
        : null;
    const previewTemplateForm = useMemo(() => {
        if (!previewingActivityTemplate) {
            return null;
        }

        const snapshot = previewingActivityTemplate.snapshot;

        return activityFormFromActivity(
            {
                config: snapshot.config,
                introduction: snapshot.introduction,
                portalLink: null,
                question: snapshot.question ?? null,
                slug: '',
                title: snapshot.title,
                type: snapshot.type,
            },
            firstType,
        );
    }, [firstType, previewingActivityTemplate]);
    const previewTemplateContext = previewTemplateForm
        ? activityTemplateContext(previewTemplateForm)
        : null;
    const previewTemplateTypeLabel = previewingActivityTemplate
        ? (activityGraph.activityTypes.find(
              (type) => type.key === previewingActivityTemplate.snapshot.type,
          )?.label ?? previewingActivityTemplate.snapshot.type)
        : null;
    const copyingToAnotherMapAsset =
        duplicateSourceTitle && targetNodeId !== String(activityGraph.node.id);
    const targetMaps = useMemo(() => {
        const maps = (worldGraph?.maps ?? []).map((map) => ({
            ...map,
            nodes: [...map.nodes],
        }));
        const hasCurrentNode = maps.some((map) =>
            map.nodes.some((node) => node.id === activityGraph.node.id),
        );

        if (!hasCurrentNode) {
            maps.unshift({
                id: activityGraph.map.id,
                nodes: [
                    {
                        id: activityGraph.node.id,
                        title: activityGraph.node.title,
                    },
                ],
                title: activityGraph.map.title,
            });
        }

        return maps;
    }, [activityGraph.map, activityGraph.node, worldGraph]);
    const activitiesNeedingReview = activityGraph.activities.filter(
        (activity) => activity.aiReviewStatus !== 'reviewed',
    ).length;
    const nextActivityNeedingReview = activityGraph.activities.find(
        (activity) => activity.aiReviewStatus !== 'reviewed',
    );
    const nextReviewActivity = activityGraph.activities.find(
        (activity) =>
            activity.aiReviewStatus !== 'reviewed' &&
            activity.id !== reviewingActivity?.id,
    );
    const hasEditActivityChanges = useDirtyState(
        editForm,
        editingActivity
            ? activityFormFromActivity(editingActivity, firstType)
            : emptyCreateForm(firstType),
    );
    const hasStartRouteChanges = useDirtyState(
        startRouteForm,
        selectedStartRoute
            ? routeFormFromStartRoute(selectedStartRoute)
            : emptyStartRouteForm(),
    );

    const openCreate = () => {
        setForm(emptyCreateForm(firstType));
        setDuplicateSourceTitle(null);
        setTargetNodeId(String(activityGraph.node.id));
        setActivityTemplateSearch('');
        setActivityTemplateError(null);
        setErrors({});
        resetImageUploadErrors();
        void loadActivityTemplates(1);
        setCreateOpen(true);
    };

    const createActivity = () => {
        setCreating(true);

        const selectedTargetNodeId = Number(targetNodeId);
        const payload =
            selectedTargetNodeId === activityGraph.node.id
                ? activityFormPayload(form)
                : {
                      ...activityFormPayload(form),
                      target_node_id: selectedTargetNodeId,
                  };

        router.post(
            `/settings/worlds/nodes/${activityGraph.node.id}/activities`,
            payload,
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => {
                    setCreateOpen(false);
                    setDuplicateSourceTitle(null);
                },
                onFinish: () => setCreating(false),
            },
        );
    };

    const updateActivity = () => {
        if (!editingActivity || !hasEditActivityChanges) {
            return;
        }

        setUpdating(true);

        router.patch(
            `/settings/worlds/activities/${editingActivity.id}`,
            activityFormPayload(editForm),
            {
                preserveScroll: true,
                onError: (nextErrors) => setEditErrors(nextErrors),
                onSuccess: () => {
                    setEditOpen(false);
                    setEditingActivity(null);
                },
                onFinish: () => setUpdating(false),
            },
        );
    };

    const deleteActivity = () => {
        if (!pendingDelete) {
            return;
        }

        setDeleting(true);

        router.delete(`/settings/worlds/activities/${pendingDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setPendingDelete(null);
                setSelectedActivity(null);
            },
            onFinish: () => setDeleting(false),
        });
    };

    const openStartRoute = (edge: ActivityGraphEdge) => {
        if (!edge.data || !('startRouteId' in edge.data)) {
            return;
        }

        const startRouteId =
            edge.data && 'startRouteId' in edge.data
                ? edge.data.startRouteId
                : null;

        const route =
            activityGraph.node.startRoutes.find(
                (candidate) => candidate.id === startRouteId,
            ) ?? null;

        if (!route) {
            return;
        }

        setSelectedStartRoute(route);
        setStartRouteForm(routeFormFromStartRoute(route));
        setStartRouteErrors({});
        resetImageUploadErrors();
    };

    const updateStartRoute = () => {
        if (!selectedStartRoute || !hasStartRouteChanges) {
            return;
        }

        setUpdatingStartRoute(true);

        router.patch(
            `/settings/worlds/activity-starts/${selectedStartRoute.id}`,
            startRouteForm,
            {
                preserveScroll: true,
                onError: (nextErrors) => setStartRouteErrors(nextErrors),
                onSuccess: () => {
                    setSelectedStartRoute(null);
                    setStartRouteErrors({});
                },
                onFinish: () => setUpdatingStartRoute(false),
            },
        );
    };

    const deleteStartRoute = () => {
        if (!pendingDeleteStartRoute) {
            return;
        }

        setDeletingStartRoute(true);

        router.delete(
            `/settings/worlds/activity-starts/${pendingDeleteStartRoute.id}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPendingDeleteStartRoute(null);
                    setSelectedStartRoute(null);
                },
                onFinish: () => setDeletingStartRoute(false),
            },
        );
    };

    const connectActivities = (connection: Connection) => {
        if (!connection.source || !connection.target) {
            return;
        }

        if (connection.source === 'start') {
            if (connection.target !== 'end') {
                router.post(
                    `/settings/worlds/nodes/${activityGraph.node.id}/activities/start`,
                    {
                        activity_id: Number(connection.target),
                    },
                    { preserveScroll: true },
                );
            }

            return;
        }

        router.post(
            `/settings/worlds/nodes/${activityGraph.node.id}/activity-transitions`,
            {
                from_activity_id: Number(connection.source),
                to_activity_id:
                    connection.target === 'end'
                        ? null
                        : Number(connection.target),
                from_connector: connection.sourceHandle ?? 'completed',
                to_connector:
                    connection.target === 'end'
                        ? 'end'
                        : (connection.targetHandle ?? 'in'),
            },
            { preserveScroll: true },
        );
    };

    const handleEdgeClick = (edge: ActivityGraphEdge) => {
        if (edge.id.startsWith('start:')) {
            const activityId =
                edge.data && 'start' in edge.data ? Number(edge.target) : null;

            router.delete(
                `/settings/worlds/nodes/${activityGraph.node.id}/activities/start`,
                {
                    data: {
                        activity_id: activityId,
                    },
                    preserveScroll: true,
                },
            );

            return;
        }

        const transitionId =
            edge.data && 'id' in edge.data ? edge.data.id : null;

        if (transitionId) {
            const transition =
                activityGraph.transitions.find(
                    (candidate) => candidate.id === transitionId,
                ) ?? null;

            if (transition) {
                setSelectedTransition(transition);
                setTransitionLabel(transition.label ?? '');
                setTransitionTriggerValue(transition.triggerValue ?? '');
                setTransitionErrors({});
            }
        }
    };

    const activateEdge = (edge: ActivityGraphEdge) => {
        if (edge.id.startsWith('start:')) {
            openStartRoute(edge);

            return;
        }

        handleEdgeClick(edge);
    };

    const handleGraphKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        const edgeElement =
            event.target instanceof Element
                ? event.target.closest<HTMLElement>(
                      '[aria-roledescription="edge"]',
                  )
                : null;
        const edgeId = edgeElement?.dataset.id;

        if (!edgeId) {
            return;
        }

        const edge = edges.find((candidate) => candidate.id === edgeId);

        if (!edge) {
            return;
        }

        event.preventDefault();
        activateEdge(edge);
    };

    const updateTransition = () => {
        if (!selectedTransition) {
            return;
        }

        setUpdatingTransition(true);

        router.patch(
            `/settings/worlds/activity-transitions/${selectedTransition.id}`,
            {
                label: transitionLabel,
                trigger_value: transitionTriggerValue,
            },
            {
                preserveScroll: true,
                onError: (nextErrors) => setTransitionErrors(nextErrors),
                onSuccess: () => {
                    setSelectedTransition(null);
                    setTransitionErrors({});
                },
                onFinish: () => setUpdatingTransition(false),
            },
        );
    };

    const deleteTransition = () => {
        if (!selectedTransition) {
            return;
        }

        setDeletingTransition(true);

        router.delete(
            `/settings/worlds/activity-transitions/${selectedTransition.id}`,
            {
                preserveScroll: true,
                onSuccess: () => setSelectedTransition(null),
                onFinish: () => setDeletingTransition(false),
            },
        );
    };

    const savePosition = (node: ActivityGraphNode) => {
        const position = {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
        };

        if (node.type === 'special') {
            router.patch(
                `/settings/worlds/nodes/${activityGraph.node.id}/activities/layout`,
                {
                    node: node.id,
                    position,
                },
                { preserveScroll: true },
            );

            return;
        }

        router.patch(
            `/settings/worlds/activities/${node.data.activity.id}`,
            {
                graph_position_x: position.x,
                graph_position_y: position.y,
            },
            { preserveScroll: true },
        );
    };

    return (
        <>
            {!embedded ? (
                <Head title={`Activities for ${activityGraph.node.title}`} />
            ) : null}
            <main
                className={cn(
                    'h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100',
                    embedded &&
                        'bg-transparent text-inherit dark:bg-transparent',
                )}
            >
                <div
                    className={cn(
                        'flex h-full flex-col px-4 pt-4 pb-24',
                        embedded && 'p-0',
                    )}
                >
                    <header
                        className={cn(
                            'mb-3 flex shrink-0 items-center justify-between gap-4',
                            embedded &&
                                'mb-0 border-b border-[var(--settings-border-color)] p-4',
                        )}
                    >
                        <div className="min-w-0">
                            {!embedded ? (
                                <Button
                                    asChild
                                    className="mb-2"
                                    size="sm"
                                    variant="ghost"
                                >
                                    <Link
                                        href={`/settings?panel=admin-world-builder&map=${activityGraph.map.id}`}
                                    >
                                        <ArrowLeft className="size-4" />
                                        Edit map
                                    </Link>
                                </Button>
                            ) : null}
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                {activityGraph.map.title}
                            </p>
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                {activityGraph.node.title} activities
                            </h1>
                        </div>
                        <Button onClick={openCreate} type="button">
                            <Plus className="size-4" />
                            Add activity
                        </Button>
                    </header>
                    {activitiesNeedingReview > 0 ? (
                        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-100">
                            <p>
                                {activitiesNeedingReview}{' '}
                                {activitiesNeedingReview === 1
                                    ? 'activity needs'
                                    : 'activities need'}{' '}
                                AI review. The queue is scoped to this node.
                            </p>
                            {activityGraph.aiReviewTemplates.length > 0 &&
                            nextActivityNeedingReview ? (
                                <Button
                                    className="h-8 shrink-0 border-amber-300/70 bg-white/70 px-3 text-xs text-amber-950 hover:bg-white dark:border-amber-200/30 dark:bg-slate-950/30 dark:text-amber-100 dark:hover:bg-slate-950/60"
                                    onClick={() =>
                                        setReviewingActivity(
                                            nextActivityNeedingReview,
                                        )
                                    }
                                    type="button"
                                    variant="outline"
                                >
                                    <Sparkles className="size-3.5" />
                                    Review next activity
                                </Button>
                            ) : activityGraph.canManageAiReview ? (
                                <Button
                                    asChild
                                    className="h-8 shrink-0 border-amber-300/70 bg-white/70 px-3 text-xs text-amber-950 hover:bg-white dark:border-amber-200/30 dark:bg-slate-950/30 dark:text-amber-100 dark:hover:bg-slate-950/60"
                                    variant="outline"
                                >
                                    <Link href="/settings?panel=admin-ai-integrations&ai=templates&purpose=activity_review">
                                        Set up review helper
                                        <ArrowRight className="size-3.5" />
                                    </Link>
                                </Button>
                            ) : (
                                <span className="text-xs text-amber-900/70 dark:text-amber-100/70">
                                    No review helper is available.
                                </span>
                            )}
                        </div>
                    ) : null}

                    <section
                        className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]"
                        onKeyDown={handleGraphKeyDown}
                    >
                        {activityGraph.activities.length === 0 ? (
                            <div className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center">
                                <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] px-5 py-4 text-center shadow-lg backdrop-blur">
                                    <GitBranch className="mx-auto mb-2 size-7 text-[var(--settings-accent)]" />
                                    <p className="font-semibold">
                                        No activities yet
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        Add one, then connect Start to its
                                        input.
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        <ReactFlow
                            colorMode={resolvedAppearance}
                            edges={edges}
                            fitView
                            fitViewOptions={{ padding: 0.28 }}
                            nodeTypes={activityNodeTypes}
                            nodes={nodes}
                            onConnect={connectActivities}
                            onEdgeClick={(_, edge) =>
                                activateEdge(edge as ActivityGraphEdge)
                            }
                            onEdgesChange={onEdgesChange}
                            onNodeDragStop={(_, node) =>
                                savePosition(node as ActivityGraphNode)
                            }
                            onNodeClick={(_, node) => {
                                setSelectedActivity(
                                    node.type === 'activity'
                                        ? (node.data as ActivityNodeData)
                                              .activity
                                        : null,
                                );
                            }}
                            onNodesChange={onNodesChange}
                            onPaneClick={() => setSelectedActivity(null)}
                        >
                            <Background gap={24} />
                            <Controls />
                            <MiniMap pannable zoomable />
                        </ReactFlow>
                    </section>
                </div>
            </main>

            <ActivityReviewDialog
                activity={reviewingActivity}
                canManageAiReview={activityGraph.canManageAiReview}
                nextActivity={nextReviewActivity ?? null}
                onClose={() => setReviewingActivity(null)}
                onEdit={(activityId) => {
                    const activity =
                        activityGraph.activities.find(
                            (candidate) => candidate.id === activityId,
                        ) ?? null;

                    if (activity) {
                        openEdit(activity);
                    }
                }}
                onReviewed={() => {
                    router.reload({
                        only: ['selectedWorldNode'],
                    });
                }}
                onReviewNext={(activity) => setReviewingActivity(activity)}
                onUseMetadata={editWithReviewSuggestions}
                templates={activityGraph.aiReviewTemplates}
            />

            <Dialog
                open={Boolean(selectedTransition)}
                onOpenChange={(open) => {
                    if (!open && !updatingTransition && !deletingTransition) {
                        setSelectedTransition(null);
                        setTransitionErrors({});
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit connection</DialogTitle>
                        <DialogDescription>
                            Give this path a short label for the activity graph.
                            Leaving it blank restores the default label.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="activity-transition-label">
                            Connection label
                        </Label>
                        <Input
                            id="activity-transition-label"
                            maxLength={120}
                            onChange={(event) =>
                                setTransitionLabel(event.target.value)
                            }
                            value={transitionLabel}
                        />
                        {transitionErrors.label ? (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {transitionErrors.label}
                            </p>
                        ) : null}
                    </div>
                    {selectedTransition?.trigger === 'outcome' ? (
                        <div className="grid gap-2">
                            <Label htmlFor="activity-transition-outcome">
                                Answer outcome key
                            </Label>
                            <Input
                                aria-describedby="activity-transition-outcome-help"
                                id="activity-transition-outcome"
                                list="activity-transition-outcome-options"
                                maxLength={120}
                                onChange={(event) =>
                                    setTransitionTriggerValue(
                                        event.target.value,
                                    )
                                }
                                placeholder="e.g. inspect-spread"
                                value={transitionTriggerValue}
                            />
                            <datalist id="activity-transition-outcome-options">
                                {activityGraph.activities
                                    .find(
                                        (activity) =>
                                            activity.id ===
                                            selectedTransition.fromActivityId,
                                    )
                                    ?.question?.options.filter(
                                        (option) => option.outcomeKey,
                                    )
                                    .map((option) => (
                                        <option
                                            key={option.outcomeKey}
                                            value={option.outcomeKey ?? ''}
                                        />
                                    ))}
                            </datalist>
                            <p
                                className="text-xs leading-5 text-muted-foreground"
                                id="activity-transition-outcome-help"
                            >
                                Match this value to an answer outcome key on the
                                source question. Leave it blank to use the
                                question's generic correct or incorrect route.
                            </p>
                            {transitionErrors.trigger_value ? (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    {transitionErrors.trigger_value}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/10"
                            disabled={updatingTransition || deletingTransition}
                            onClick={deleteTransition}
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                            Delete connection
                        </Button>
                        <div className="flex justify-end gap-2">
                            <Button
                                disabled={
                                    updatingTransition || deletingTransition
                                }
                                onClick={() => setSelectedTransition(null)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={
                                    updatingTransition || deletingTransition
                                }
                                onClick={updateTransition}
                                type="button"
                            >
                                Save
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <SettingsConfigurationDialog className="flex h-[calc(100svh-8rem)] flex-col overflow-hidden">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>
                            {duplicateSourceTitle
                                ? 'Create activity from template'
                                : 'Add activity'}
                        </DialogTitle>
                        <DialogDescription>
                            {duplicateSourceTitle
                                ? `An editable copy of “${duplicateSourceTitle}” is ready. Adjust it before saving; the new activity will enter the review queue.`
                                : 'Create an activity in this MapAsset. Choose its type, then configure its content, visuals, sound and learning evidence.'}
                        </DialogDescription>
                    </DialogHeader>

                    {!duplicateSourceTitle ? (
                        <section className="shrink-0 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-semibold">
                                        Start from a saved template
                                    </h2>
                                    <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.worlds.activities.template.sharing_description',
                                            'Templates are private by default. Share a saved template with an organization while keeping the full configuration behind an explicit preview.',
                                        )}
                                    </p>
                                </div>
                                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                                    <Button
                                        aria-pressed={managingActivityTemplates}
                                        className="h-8 px-2.5 text-xs"
                                        onClick={() => {
                                            setManagingActivityTemplates(
                                                (current) => !current,
                                            );
                                            cancelRenameActivityTemplate();
                                        }}
                                        type="button"
                                        variant="outline"
                                    >
                                        <Pencil className="size-3.5" />
                                        {t(
                                            'settings.worlds.activities.template.manage',
                                            'Manage saved templates',
                                        )}
                                    </Button>
                                    <Input
                                        aria-label="Search saved activity templates"
                                        className="h-8 w-full sm:w-56"
                                        onChange={(event) =>
                                            setActivityTemplateSearch(
                                                event.target.value,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                void loadActivityTemplates(
                                                    1,
                                                    activityTemplateSearch,
                                                );
                                            }
                                        }}
                                        placeholder="Search templates"
                                        value={activityTemplateSearch}
                                    />
                                </div>
                            </div>
                            {loadingActivityTemplates ? (
                                <p className="mt-3 text-xs text-[var(--settings-muted-text)]">
                                    Loading saved templates…
                                </p>
                            ) : activityTemplates.length > 0 ? (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {activityTemplates.map((template) =>
                                        editingActivityTemplate?.id ===
                                        template.id ? (
                                            <div
                                                className="grid min-h-16 gap-2 rounded-md border border-[var(--settings-accent)] bg-[var(--settings-content-background)] p-2"
                                                key={template.id}
                                            >
                                                <Input
                                                    aria-label={t(
                                                        'settings.worlds.activities.template.rename',
                                                        'Rename template',
                                                    )}
                                                    autoFocus
                                                    maxLength={120}
                                                    onChange={(event) =>
                                                        setEditingActivityTemplateName(
                                                            event.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key ===
                                                            'Enter'
                                                        ) {
                                                            event.preventDefault();
                                                            void renameActivityTemplate();
                                                        }

                                                        if (
                                                            event.key ===
                                                            'Escape'
                                                        ) {
                                                            event.preventDefault();
                                                            cancelRenameActivityTemplate();
                                                        }
                                                    }}
                                                    value={
                                                        editingActivityTemplateName
                                                    }
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        aria-label={t(
                                                            'settings.worlds.activities.template.rename_cancel',
                                                            'Cancel rename',
                                                        )}
                                                        className="h-7 px-2"
                                                        disabled={
                                                            updatingActivityTemplate
                                                        }
                                                        onClick={
                                                            cancelRenameActivityTemplate
                                                        }
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        <X className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        aria-label={t(
                                                            'settings.worlds.activities.template.rename_save',
                                                            'Save name',
                                                        )}
                                                        className="h-7 px-2"
                                                        disabled={
                                                            updatingActivityTemplate ||
                                                            editingActivityTemplateName.trim() ===
                                                                ''
                                                        }
                                                        onClick={() =>
                                                            void renameActivityTemplate()
                                                        }
                                                        type="button"
                                                    >
                                                        <Check className="size-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="flex min-h-16 flex-wrap items-stretch rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)]"
                                                key={template.id}
                                            >
                                                <Button
                                                    className="h-auto min-h-16 min-w-0 flex-1 justify-between gap-3 rounded-r-none border-0 px-3 py-2 text-left whitespace-normal"
                                                    disabled={
                                                        loadingTemplateId !==
                                                            null ||
                                                        updatingActivityTemplate ||
                                                        deletingActivityTemplateId !==
                                                            null
                                                    }
                                                    onClick={() =>
                                                        void previewSavedTemplate(
                                                            template,
                                                        )
                                                    }
                                                    type="button"
                                                    variant="ghost"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-medium">
                                                            {template.name}
                                                        </span>
                                                        <span className="mt-1 block text-xs text-[var(--settings-muted-text)]">
                                                            {template.type} ·{' '}
                                                            {template.title}
                                                        </span>
                                                        <span className="mt-1 block text-xs text-[var(--settings-muted-text)]">
                                                            {template.organization
                                                                ? t(
                                                                      'settings.worlds.activities.template.shared_with',
                                                                      'Shared with :name',
                                                                      {
                                                                          name: template
                                                                              .organization
                                                                              .name,
                                                                      },
                                                                  )
                                                                : t(
                                                                      'settings.worlds.activities.template.private_template',
                                                                      'Private template',
                                                                  )}
                                                        </span>
                                                    </span>
                                                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--settings-accent)]">
                                                        {t(
                                                            'settings.worlds.activities.template.preview',
                                                            'Preview',
                                                        )}
                                                        <ArrowRight className="size-4" />
                                                    </span>
                                                </Button>
                                                {managingActivityTemplates ? (
                                                    <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 border-t border-[var(--settings-border-color)] px-2 py-2 sm:w-auto sm:border-t-0 sm:py-0">
                                                        <Button
                                                            aria-label={`${t(
                                                                'settings.worlds.activities.template.history',
                                                                'View template history',
                                                            )}: ${template.name}`}
                                                            className="size-8 p-0"
                                                            disabled={
                                                                loadingTemplateId !==
                                                                    null ||
                                                                updatingActivityTemplate ||
                                                                deletingActivityTemplateId !==
                                                                    null
                                                            }
                                                            onClick={() =>
                                                                openTemplateHistory(
                                                                    template,
                                                                )
                                                            }
                                                            title={t(
                                                                'settings.worlds.activities.template.history',
                                                                'View template history',
                                                            )}
                                                            type="button"
                                                            variant="outline"
                                                        >
                                                            <History className="size-3.5" />
                                                        </Button>
                                                        {template.canManage ? (
                                                            <>
                                                                {shareTargets.length >
                                                                0 ? (
                                                                    <select
                                                                        aria-label={`${t(
                                                                            'settings.worlds.activities.template.share',
                                                                            'Share template',
                                                                        )}: ${template.name}`}
                                                                        className="h-8 max-w-44 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-2 text-xs text-[var(--settings-text-color)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                                                                        disabled={
                                                                            sharingActivityTemplateId ===
                                                                                template.id ||
                                                                            updatingActivityTemplate ||
                                                                            deletingActivityTemplateId !==
                                                                                null
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            void shareActivityTemplate(
                                                                                template,
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                        value={
                                                                            template.organization?.id.toString() ??
                                                                            ''
                                                                        }
                                                                    >
                                                                        <option value="">
                                                                            {t(
                                                                                'settings.worlds.activities.template.private',
                                                                                'Private',
                                                                            )}
                                                                        </option>
                                                                        {shareTargets.map(
                                                                            (
                                                                                organization,
                                                                            ) => (
                                                                                <option
                                                                                    key={
                                                                                        organization.id
                                                                                    }
                                                                                    value={String(
                                                                                        organization.id,
                                                                                    )}
                                                                                >
                                                                                    {
                                                                                        organization.name
                                                                                    }
                                                                                </option>
                                                                            ),
                                                                        )}
                                                                    </select>
                                                                ) : null}
                                                                <Button
                                                                    aria-label={`${t(
                                                                        'settings.worlds.activities.template.rename',
                                                                        'Rename template',
                                                                    )}: ${template.name}`}
                                                                    className="size-8 p-0"
                                                                    disabled={
                                                                        loadingTemplateId !==
                                                                            null ||
                                                                        deletingActivityTemplateId !==
                                                                            null
                                                                    }
                                                                    onClick={() =>
                                                                        beginRenameActivityTemplate(
                                                                            template,
                                                                        )
                                                                    }
                                                                    type="button"
                                                                    variant="outline"
                                                                >
                                                                    <Pencil className="size-3.5" />
                                                                </Button>
                                                                <Button
                                                                    aria-label={`${t(
                                                                        'settings.worlds.activities.template.delete',
                                                                        'Delete template',
                                                                    )}: ${template.name}`}
                                                                    className="size-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                                    disabled={
                                                                        loadingTemplateId !==
                                                                            null ||
                                                                        updatingActivityTemplate ||
                                                                        deletingActivityTemplateId !==
                                                                            null
                                                                    }
                                                                    onClick={() =>
                                                                        void deleteActivityTemplate(
                                                                            template,
                                                                        )
                                                                    }
                                                                    type="button"
                                                                    variant="outline"
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <span className="px-1 text-xs text-[var(--settings-muted-text)]">
                                                                {t(
                                                                    'settings.worlds.activities.template.shared_read_only',
                                                                    'Shared read-only template',
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ),
                                    )}
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-[var(--settings-muted-text)]">
                                    {activityTemplateSearch.trim() === ''
                                        ? 'No saved templates yet. Save one from an activity card.'
                                        : 'No saved templates match this search.'}
                                </p>
                            )}
                            {activityTemplateError ? (
                                <p
                                    className="mt-2 text-xs text-red-600 dark:text-red-400"
                                    role="alert"
                                >
                                    {activityTemplateError}
                                </p>
                            ) : null}
                            <PaginationControls
                                buttonClassName="text-xs text-[var(--settings-accent)] hover:text-[var(--settings-accent-foreground)]"
                                className="mt-3 border-t border-[var(--settings-border-color)] pt-2"
                                currentPage={activityTemplatesPagination.page}
                                disabled={
                                    loadingActivityTemplates ||
                                    loadingTemplateId !== null
                                }
                                label="Saved activity template pagination"
                                nextLabel="Next saved template page"
                                onPageChange={(page) =>
                                    void loadActivityTemplates(
                                        page,
                                        activityTemplateSearch,
                                    )
                                }
                                pageCount={activityTemplatesPagination.lastPage}
                                previousLabel="Previous saved template page"
                            />
                        </section>
                    ) : null}

                    {copiedTemplateContext ? (
                        <div className="grid gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100">
                            <p className="flex items-start gap-2 font-medium">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                {t(
                                    'settings.worlds.activities.template.scope',
                                    'This is an editable starting point. Review context-specific references before saving.',
                                )}
                            </p>
                            {copiedTemplateContext.references.length > 0 ? (
                                <ul className="grid gap-1 pl-6 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
                                    {copiedTemplateContext.references.includes(
                                        'message_topic',
                                    ) ? (
                                        <li>
                                            {t(
                                                'settings.worlds.activities.template.message_topic',
                                                'Message topic copied from the source MapAsset; review it before saving.',
                                            )}
                                        </li>
                                    ) : null}
                                    {copiedTemplateContext.references.includes(
                                        'portal_destination',
                                    ) ? (
                                        <li>
                                            {t(
                                                'settings.worlds.activities.template.portal_destination',
                                                'Portal destination copied from the source activity; confirm it before saving.',
                                            )}
                                        </li>
                                    ) : null}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}

                    {duplicateSourceTitle ? (
                        <div className="grid gap-2 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3">
                            <Label htmlFor="activity-template-target">
                                Copy into MapAsset
                            </Label>
                            <select
                                aria-describedby="activity-template-target-help"
                                className="h-10 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-3 text-sm text-[var(--settings-text-color)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                                id="activity-template-target"
                                onChange={(event) => {
                                    const nextTargetId = event.target.value;

                                    setTargetNodeId(nextTargetId);

                                    if (
                                        nextTargetId !==
                                        String(activityGraph.node.id)
                                    ) {
                                        setForm((current) => ({
                                            ...current,
                                            message_topic_id: '',
                                            message_topic_title: '',
                                            target_portal_activity_id: '',
                                        }));
                                    }
                                }}
                                value={targetNodeId}
                            >
                                {targetMaps.map((map) => (
                                    <optgroup key={map.id} label={map.title}>
                                        {map.nodes.map((node) => (
                                            <option
                                                key={node.id}
                                                value={node.id}
                                            >
                                                {node.title}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <p
                                className="text-xs leading-5 text-[var(--settings-muted-text)]"
                                id="activity-template-target-help"
                            >
                                Choose the destination MapAsset. Message topics
                                and portal destinations are reset when moving a
                                copy to another MapAsset so they cannot point at
                                the source context by accident.
                            </p>
                            {copyingToAnotherMapAsset ? (
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    Source-specific message and portal links
                                    have been cleared for this destination.
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    <form
                        className="flex min-h-0 flex-1 flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            createActivity();
                        }}
                    >
                        <ActivityFormFields
                            activityTypes={activityGraph.activityTypes}
                            competenceTopicOptions={
                                activityGraph.competenceTopicOptions
                            }
                            evidenceConceptOptions={
                                activityGraph.evidenceConceptOptions
                            }
                            editingActivityId={null}
                            errors={errors}
                            form={form}
                            imageUploadErrors={imageUploadErrors}
                            messageTopics={activityGraph.messageTopics}
                            onChange={setForm}
                            onDeleteSourceRecord={deleteSourceRecord}
                            onLoadSourceRecordVersions={
                                loadSourceRecordVersions
                            }
                            onLoadSourceRecords={loadSourceRecords}
                            onRestoreSourceRecordVersion={
                                restoreSourceRecordVersion
                            }
                            onUploadPortalImage={uploadNodeImage}
                            portalCandidates={activityGraph.portalCandidates}
                            selectedType={selectedType}
                            items={items}
                            sounds={sounds}
                            sourceRecords={sourceRecords}
                            sourceRecordsPagination={sourceRecordsPagination}
                            tools={tools}
                            onSaveSourceRecord={saveSourceRecord}
                            onUpdateSourceRecord={updateSourceRecord}
                            uploadingImageKey={uploadingImageKey}
                        />

                        <DialogFooter className="shrink-0">
                            <Button
                                disabled={creating}
                                onClick={() => setCreateOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button disabled={creating} type="submit">
                                Create
                            </Button>
                        </DialogFooter>
                    </form>
                </SettingsConfigurationDialog>
            </Dialog>

            <Dialog
                open={templateSaveActivity !== null}
                onOpenChange={(open) => {
                    if (!open && !savingTemplate) {
                        setTemplateSaveActivity(null);
                        setTemplateName('');
                        setActivityTemplateError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Save reusable activity template
                        </DialogTitle>
                        <DialogDescription>
                            Save the authored configuration as a private,
                            editable starting point. Learner responses and
                            evidence are never included.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="activity-template-name">
                            Template name
                        </Label>
                        <Input
                            autoFocus
                            id="activity-template-name"
                            maxLength={120}
                            onChange={(event) =>
                                setTemplateName(event.target.value)
                            }
                            value={templateName}
                        />
                        {activityTemplateError ? (
                            <p
                                className="text-sm text-red-600 dark:text-red-400"
                                role="alert"
                            >
                                {activityTemplateError}
                            </p>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button
                            disabled={savingTemplate}
                            onClick={() => {
                                setTemplateSaveActivity(null);
                                setTemplateName('');
                                setActivityTemplateError(null);
                            }}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={
                                savingTemplate || templateName.trim() === ''
                            }
                            onClick={() => void saveActivityTemplate()}
                            type="button"
                        >
                            Save template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={templateUpdateActivity !== null}
                onOpenChange={(open) => {
                    if (!open && !updatingActivityTemplate) {
                        setTemplateUpdateActivity(null);
                        setActivityTemplateError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Update a saved template</DialogTitle>
                        <DialogDescription>
                            Save the persisted configuration from{' '}
                            <span className="font-medium">
                                {templateUpdateActivity?.title}
                            </span>{' '}
                            as a new template version. Existing activities made
                            from the template will not change.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        {loadingActivityTemplates ? (
                            <p className="text-sm text-[var(--settings-muted-text)]">
                                Loading saved templates…
                            </p>
                        ) : activityTemplates.length > 0 ? (
                            activityTemplates.map((template) => (
                                <div
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3"
                                    key={template.id}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {template.name}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                                            {template.type} · current activity:{' '}
                                            {template.title}
                                        </p>
                                    </div>
                                    {template.canManage ? (
                                        <Button
                                            className="h-8 shrink-0 px-2.5 text-xs"
                                            disabled={updatingActivityTemplate}
                                            onClick={() =>
                                                void updateTemplateFromActivity(
                                                    template,
                                                )
                                            }
                                            type="button"
                                        >
                                            <RefreshCw className="size-3.5" />
                                            Update from activity
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-[var(--settings-muted-text)]">
                                            Shared read-only template
                                        </span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-[var(--settings-muted-text)]">
                                No saved templates are available to update.
                            </p>
                        )}
                    </div>
                    {activityTemplateError ? (
                        <p
                            className="text-sm text-red-600 dark:text-red-400"
                            role="alert"
                        >
                            {activityTemplateError}
                        </p>
                    ) : null}
                    <PaginationControls
                        buttonClassName="text-xs text-[var(--settings-accent)] hover:text-[var(--settings-accent-foreground)]"
                        className="border-t border-[var(--settings-border-color)] pt-2"
                        currentPage={activityTemplatesPagination.page}
                        disabled={
                            loadingActivityTemplates || updatingActivityTemplate
                        }
                        label="Saved activity template pagination"
                        nextLabel="Next saved template page"
                        onPageChange={(page) =>
                            void loadActivityTemplates(page)
                        }
                        pageCount={activityTemplatesPagination.lastPage}
                        previousLabel="Previous saved template page"
                    />
                    <DialogFooter>
                        <Button
                            disabled={updatingActivityTemplate}
                            onClick={() => setTemplateUpdateActivity(null)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={templateHistory !== null}
                onOpenChange={(open) => {
                    if (!open && restoringTemplateRevisionId === null) {
                        setTemplateHistory(null);
                        setTemplateRevisions([]);
                        setActivityTemplateError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Template history</DialogTitle>
                        <DialogDescription>
                            Review recoverable snapshots of{' '}
                            <span className="font-medium">
                                {templateHistory?.name}
                            </span>
                            . Restoring changes the reusable template only; it
                            does not alter existing activities.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        {loadingTemplateRevisions ? (
                            <p className="text-sm text-[var(--settings-muted-text)]">
                                Loading template history…
                            </p>
                        ) : templateRevisions.length > 0 ? (
                            templateRevisions.map((revision) => (
                                <div
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3"
                                    key={revision.id}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {revision.title}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                                            {revision.type}
                                            {revision.createdAt
                                                ? ` · ${formatTemplateDate(revision.createdAt)}`
                                                : ''}
                                        </p>
                                    </div>
                                    {templateHistory?.canManage ? (
                                        <Button
                                            className="h-8 shrink-0 px-2.5 text-xs"
                                            disabled={
                                                restoringTemplateRevisionId !==
                                                null
                                            }
                                            onClick={() =>
                                                void restoreTemplateRevision(
                                                    revision,
                                                )
                                            }
                                            type="button"
                                            variant="outline"
                                        >
                                            <History className="size-3.5" />
                                            Restore
                                        </Button>
                                    ) : null}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-[var(--settings-muted-text)]">
                                No revisions recorded yet.
                            </p>
                        )}
                    </div>
                    {activityTemplateError ? (
                        <p
                            className="text-sm text-red-600 dark:text-red-400"
                            role="alert"
                        >
                            {activityTemplateError}
                        </p>
                    ) : null}
                    <PaginationControls
                        buttonClassName="text-xs text-[var(--settings-accent)] hover:text-[var(--settings-accent-foreground)]"
                        className="border-t border-[var(--settings-border-color)] pt-2"
                        currentPage={templateRevisionPagination.page}
                        disabled={
                            loadingTemplateRevisions ||
                            restoringTemplateRevisionId !== null
                        }
                        label="Activity template history pagination"
                        nextLabel="Next template history page"
                        onPageChange={(page) =>
                            templateHistory
                                ? void loadTemplateRevisions(
                                      templateHistory,
                                      page,
                                  )
                                : undefined
                        }
                        pageCount={templateRevisionPagination.lastPage}
                        previousLabel="Previous template history page"
                    />
                    <DialogFooter>
                        <Button
                            disabled={restoringTemplateRevisionId !== null}
                            onClick={() => setTemplateHistory(null)}
                            type="button"
                            variant="outline"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={previewingActivityTemplate !== null}
                onOpenChange={(open) => {
                    if (!open && loadingTemplateId === null) {
                        setPreviewingActivityTemplate(null);
                        setTemplateMediaReplacements({});
                        setTemplateMediaPickerReference(null);
                        setActivityTemplateError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'settings.worlds.activities.template.preview_title',
                                'Preview activity template',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'settings.worlds.activities.template.preview_description',
                                'Review what will be copied into a new editable activity before replacing the current draft.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {previewingActivityTemplate ? (
                        <div className="grid gap-3 text-sm">
                            <dl className="grid gap-2 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 sm:grid-cols-2">
                                <div>
                                    <dt className="text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.worlds.activities.template.preview_template',
                                            'Template',
                                        )}
                                    </dt>
                                    <dd className="mt-1 font-medium">
                                        {previewingActivityTemplate.name}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.worlds.activities.template.preview_activity_type',
                                            'Activity type',
                                        )}
                                    </dt>
                                    <dd className="mt-1 font-medium">
                                        {previewTemplateTypeLabel}
                                    </dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.worlds.activities.template.preview_activity_title',
                                            'Activity title',
                                        )}
                                    </dt>
                                    <dd className="mt-1 font-medium">
                                        {
                                            previewingActivityTemplate.snapshot
                                                .title
                                        }
                                    </dd>
                                </div>
                            </dl>
                            <div className="grid gap-2 rounded-md border border-[var(--settings-border-color)] p-3">
                                <p className="text-xs font-semibold tracking-wide text-[var(--settings-accent)] uppercase">
                                    {t(
                                        'settings.worlds.activities.template.preview_included',
                                        'Included configuration',
                                    )}
                                </p>
                                <ul className="grid gap-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                                    <li>
                                        {t(
                                            'settings.worlds.activities.template.preview_activity_settings',
                                            'Activity introduction and type-specific settings',
                                        )}
                                    </li>
                                    {previewingActivityTemplate.snapshot
                                        .question ? (
                                        <li>
                                            {t(
                                                'settings.worlds.activities.template.preview_question',
                                                'Question, options and feedback',
                                            )}
                                        </li>
                                    ) : null}
                                    {previewTemplateContext?.references.map(
                                        (reference) => (
                                            <li key={reference}>
                                                {reference === 'message_topic'
                                                    ? t(
                                                          'settings.worlds.activities.template.preview_message_topic',
                                                          'A message topic reference that should be reviewed',
                                                      )
                                                    : t(
                                                          'settings.worlds.activities.template.preview_portal_destination',
                                                          'A portal destination reference that should be reviewed',
                                                      )}
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </div>
                            {previewingActivityTemplate.mediaReferences.length >
                            0 ? (
                                <div
                                    className="grid gap-2 rounded-md border border-[var(--settings-border-color)] p-3"
                                    data-wl-id="admin.activity-template.media-resolution"
                                >
                                    <p className="text-xs font-semibold tracking-wide text-[var(--settings-accent)] uppercase">
                                        {t(
                                            'settings.worlds.activities.template.preview_media',
                                            'Reusable media',
                                        )}
                                    </p>
                                    <p className="text-xs leading-5 text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.worlds.activities.template.preview_media_summary',
                                            ':available of :total referenced media files are available in this workspace.',
                                            {
                                                available:
                                                    previewingActivityTemplate.mediaReferences.filter(
                                                        (reference) =>
                                                            reference.available,
                                                    ).length,
                                                total: previewingActivityTemplate
                                                    .mediaReferences.length,
                                            },
                                        )}
                                    </p>
                                    {previewingActivityTemplate.mediaReferences.some(
                                        (reference) => !reference.available,
                                    ) ? (
                                        <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">
                                            {t(
                                                'settings.worlds.activities.template.preview_media_resolution_help',
                                                'Unavailable image references can be replaced with an existing image before you create the editable activity.',
                                            )}
                                        </p>
                                    ) : null}
                                    <ul className="grid gap-2 text-xs leading-5 text-[var(--settings-muted-text)]">
                                        {previewingActivityTemplate.mediaReferences
                                            .filter(
                                                (reference, index) =>
                                                    !reference.available ||
                                                    index < 6,
                                            )
                                            .map((reference) => (
                                                <li
                                                    className="flex flex-wrap items-center justify-between gap-2"
                                                    key={reference.url}
                                                >
                                                    <span
                                                        className={
                                                            reference.available
                                                                ? undefined
                                                                : 'text-amber-700 dark:text-amber-300'
                                                        }
                                                    >
                                                        {reference.available
                                                            ? '✓'
                                                            : '!'}{' '}
                                                        {reference.url}
                                                        {templateMediaReplacements[
                                                            reference.url
                                                        ] ? (
                                                            <span className="text-[var(--settings-accent)]">
                                                                {' → '}
                                                                {
                                                                    templateMediaReplacements[
                                                                        reference
                                                                            .url
                                                                    ]
                                                                }
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    {!reference.available &&
                                                    isImageMediaReference(
                                                        reference.url,
                                                    ) ? (
                                                        <Button
                                                            data-wl-id="admin.activity-template.media-replacement"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() =>
                                                                setTemplateMediaPickerReference(
                                                                    reference.url,
                                                                )
                                                            }
                                                            type="button"
                                                            variant="outline"
                                                        >
                                                            {templateMediaReplacements[
                                                                reference.url
                                                            ]
                                                                ? t(
                                                                      'settings.worlds.activities.template.preview_media_change_replacement',
                                                                      'Change replacement',
                                                                  )
                                                                : t(
                                                                      'settings.worlds.activities.template.preview_media_choose_replacement',
                                                                      'Choose replacement',
                                                                  )}
                                                        </Button>
                                                    ) : null}
                                                </li>
                                            ))}
                                    </ul>
                                    {previewingActivityTemplate.mediaReferences.filter(
                                        (reference, index) =>
                                            reference.available && index >= 6,
                                    ).length > 0 ? (
                                        <p className="text-xs text-[var(--settings-muted-text)]">
                                            {t(
                                                'settings.worlds.activities.template.preview_media_more',
                                                ':count more media references are included.',
                                                {
                                                    count: previewingActivityTemplate.mediaReferences.filter(
                                                        (reference, index) =>
                                                            reference.available &&
                                                            index >= 6,
                                                    ).length,
                                                },
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                            <p className="text-xs leading-5 text-[var(--settings-muted-text)]">
                                {t(
                                    'settings.worlds.activities.template.preview_safety',
                                    'Applying creates a new draft in the current MapAsset. It does not change this template or any existing activity. Learner responses and evidence are not part of the template.',
                                )}
                            </p>
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                setPreviewingActivityTemplate(null);
                                setTemplateMediaReplacements({});
                                setTemplateMediaPickerReference(null);
                            }}
                            type="button"
                            variant="outline"
                        >
                            {t(
                                'settings.worlds.activities.template.preview_cancel',
                                'Cancel',
                            )}
                        </Button>
                        <Button
                            disabled={loadingTemplateId !== null}
                            onClick={applyTemplatePreview}
                            type="button"
                        >
                            {t(
                                'settings.worlds.activities.template.use_as_starting_point',
                                'Use as starting point',
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <SettingsConfigurationDialog className="flex h-[calc(100svh-8rem)] flex-col overflow-hidden">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Edit activity</DialogTitle>
                        <DialogDescription>
                            Update the shared activity fields and its
                            type-specific settings. Dedicated editors are
                            available from the activity graph when needed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        <ActivityFormFields
                            activityTypes={activityGraph.activityTypes}
                            competenceTopicOptions={
                                activityGraph.competenceTopicOptions
                            }
                            evidenceConceptOptions={
                                activityGraph.evidenceConceptOptions
                            }
                            editingActivityId={editingActivity?.id ?? null}
                            errors={editErrors}
                            form={editForm}
                            imageUploadErrors={imageUploadErrors}
                            messageTopics={activityGraph.messageTopics}
                            onChange={setEditForm}
                            onDeleteSourceRecord={deleteSourceRecord}
                            onLoadSourceRecordVersions={
                                loadSourceRecordVersions
                            }
                            onLoadSourceRecords={loadSourceRecords}
                            onRestoreSourceRecordVersion={
                                restoreSourceRecordVersion
                            }
                            onUploadPortalImage={uploadNodeImage}
                            portalCandidates={activityGraph.portalCandidates}
                            selectedType={selectedEditType}
                            items={items}
                            sounds={sounds}
                            sourceRecords={sourceRecords}
                            sourceRecordsPagination={sourceRecordsPagination}
                            tools={tools}
                            onSaveSourceRecord={saveSourceRecord}
                            onUpdateSourceRecord={updateSourceRecord}
                            uploadingImageKey={uploadingImageKey}
                        />
                    </div>

                    <InputError message={editErrors.updated_at} />

                    <DialogFooter className="shrink-0">
                        {editingActivity &&
                        activityGraph.aiReviewTemplates.length > 0 ? (
                            <Button
                                className="sm:mr-auto"
                                disabled={updating || hasEditActivityChanges}
                                onClick={() => {
                                    setEditOpen(false);
                                    setReviewingActivity(editingActivity);
                                }}
                                title={
                                    hasEditActivityChanges
                                        ? 'Save your changes before requesting an AI review.'
                                        : undefined
                                }
                                type="button"
                                variant="outline"
                            >
                                <Sparkles className="size-4" />
                                Review with AI
                            </Button>
                        ) : null}
                        {editingActivity ? (
                            <ActivityHistoryDialog
                                activityId={editingActivity.id}
                                onOpenChange={setActivityHistoryOpen}
                                onRestored={() => {
                                    setActivityHistoryOpen(false);
                                    setEditOpen(false);
                                    setEditingActivity(null);
                                    router.reload({
                                        only: ['selectedWorldNode'],
                                    });
                                }}
                                open={activityHistoryOpen}
                            >
                                <Button
                                    disabled={updating}
                                    type="button"
                                    variant="outline"
                                >
                                    <History className="size-4" />
                                    History
                                </Button>
                            </ActivityHistoryDialog>
                        ) : null}
                        <Button
                            disabled={updating}
                            onClick={() => setEditOpen(false)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={updating || !hasEditActivityChanges}
                            onClick={updateActivity}
                            type="button"
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </SettingsConfigurationDialog>
            </Dialog>

            {templateMediaPickerReference ? (
                <ReusableImagePicker
                    currentValue={
                        templateMediaReplacements[
                            templateMediaPickerReference
                        ] ?? templateMediaPickerReference
                    }
                    onClear={() => {
                        setTemplateMediaReplacements((current) => {
                            const next = { ...current };
                            delete next[templateMediaPickerReference];

                            return next;
                        });
                        setTemplateMediaPickerReference(null);
                    }}
                    onClose={() => setTemplateMediaPickerReference(null)}
                    onSelect={(url) => {
                        setTemplateMediaReplacements((current) => ({
                            ...current,
                            [templateMediaPickerReference]: url,
                        }));
                        setTemplateMediaPickerReference(null);
                    }}
                />
            ) : null}

            <Dialog
                open={Boolean(selectedStartRoute)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedStartRoute(null);
                    }
                }}
            >
                <SettingsConfigurationDialog className="overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Route visuals</DialogTitle>
                        <DialogDescription>
                            Configure optional images for the route button shown
                            in the learner node panel.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedStartRoute ? (
                        <div className="grid gap-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                                <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                                    Starts activity
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                                    {routeActivityTitle(
                                        activityGraph.activities,
                                        selectedStartRoute,
                                    )}
                                </p>
                            </div>

                            <RouteVisualPreview
                                form={startRouteForm}
                                mode={resolvedAppearance}
                                title={routeActivityTitle(
                                    activityGraph.activities,
                                    selectedStartRoute,
                                )}
                            />

                            <SettingsConfigurationSection
                                description={t(
                                    'settings.worlds.activities.route_label.description',
                                    'Give this starting point a clear name. Leave it empty to use the activity title.',
                                )}
                                title={t(
                                    'settings.worlds.activities.route_label.title',
                                    'Route name',
                                )}
                            >
                                <div className="grid gap-2">
                                    <Label htmlFor="route-label">
                                        {t(
                                            'settings.worlds.activities.route_label.label',
                                            'Name',
                                        )}
                                    </Label>
                                    <Input
                                        id="route-label"
                                        maxLength={120}
                                        onChange={(event) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                label: event.target.value,
                                            }))
                                        }
                                        placeholder={routeActivityTitle(
                                            activityGraph.activities,
                                            selectedStartRoute,
                                        )}
                                        value={startRouteForm.label}
                                    />
                                    {startRouteErrors.label ? (
                                        <p className="text-xs text-red-600 dark:text-red-300">
                                            {startRouteErrors.label}
                                        </p>
                                    ) : null}
                                </div>
                            </SettingsConfigurationSection>

                            <SettingsConfigurationSection
                                description={t(
                                    'settings.worlds.activities.route_description.description',
                                    'A short explanation helps learners choose this route without turning it into a ranked recommendation.',
                                )}
                                title={t(
                                    'settings.worlds.activities.route_description.title',
                                    'Route guidance',
                                )}
                            >
                                <div className="grid gap-2">
                                    <Label htmlFor="route-description">
                                        {t(
                                            'settings.worlds.activities.route_description.label',
                                            'Description',
                                        )}
                                    </Label>
                                    <textarea
                                        className="min-h-20 resize-y rounded-md border border-slate-300/80 bg-white/80 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[var(--settings-accent)]/30 dark:border-white/15 dark:bg-slate-950/50 dark:text-slate-100"
                                        id="route-description"
                                        maxLength={600}
                                        onChange={(event) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                        placeholder={t(
                                            'settings.worlds.activities.route_description.placeholder',
                                            'What might a learner explore through this route?',
                                        )}
                                        value={startRouteForm.description}
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {t(
                                            'settings.worlds.activities.route_description.helper',
                                            'Optional, up to 600 characters. Shown with this route wherever learners choose a starting point.',
                                        )}
                                    </p>
                                    {startRouteErrors.description ? (
                                        <p className="text-xs text-red-600 dark:text-red-300">
                                            {startRouteErrors.description}
                                        </p>
                                    ) : null}
                                </div>
                            </SettingsConfigurationSection>

                            <SettingsConfigurationSection
                                description="Optional images shown as the route card background."
                                title="Route images"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ConfigImageInput
                                        description="Displayed below the route button in dark mode."
                                        error={
                                            startRouteErrors.image_dark ??
                                            imageUploadErrors.route_image_dark
                                        }
                                        id="route-image-dark"
                                        label="Dark route image"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                image_dark: value,
                                            }))
                                        }
                                        onUpload={(file) =>
                                            void uploadNodeImage(
                                                'route_image_dark',
                                                file,
                                                (url) =>
                                                    setStartRouteForm(
                                                        (current) => ({
                                                            ...current,
                                                            image_dark: url,
                                                        }),
                                                    ),
                                            )
                                        }
                                        uploading={
                                            uploadingImageKey ===
                                            'route_image_dark'
                                        }
                                        value={startRouteForm.image_dark}
                                    />
                                    <ConfigImageInput
                                        description="Displayed below the route button in light mode. If empty, light mode shows only the button."
                                        error={
                                            startRouteErrors.image_light ??
                                            imageUploadErrors.route_image_light
                                        }
                                        id="route-image-light"
                                        label="Light route image"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                image_light: value,
                                            }))
                                        }
                                        onUpload={(file) =>
                                            void uploadNodeImage(
                                                'route_image_light',
                                                file,
                                                (url) =>
                                                    setStartRouteForm(
                                                        (current) => ({
                                                            ...current,
                                                            image_light: url,
                                                        }),
                                                    ),
                                            )
                                        }
                                        uploading={
                                            uploadingImageKey ===
                                            'route_image_light'
                                        }
                                        value={startRouteForm.image_light}
                                    />
                                </div>
                            </SettingsConfigurationSection>

                            <SettingsConfigurationSection
                                description="Theme-specific colors for the button layered over a route image."
                                title="Overlay button"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_color_dark
                                        }
                                        fallback="#0f172a"
                                        id="route-button-color-dark"
                                        label="Dark button color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_color_dark: value,
                                            }))
                                        }
                                        value={startRouteForm.button_color_dark}
                                    />
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_border_color_dark
                                        }
                                        fallback="#334155"
                                        id="route-button-border-color-dark"
                                        label="Dark border and frame color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_border_color_dark: value,
                                            }))
                                        }
                                        value={
                                            startRouteForm.button_border_color_dark
                                        }
                                    />
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_color_light
                                        }
                                        fallback="#ffffff"
                                        id="route-button-color-light"
                                        label="Light button color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_color_light: value,
                                            }))
                                        }
                                        value={
                                            startRouteForm.button_color_light
                                        }
                                    />
                                    <RouteColorInput
                                        error={
                                            startRouteErrors.button_border_color_light
                                        }
                                        fallback="#e2e8f0"
                                        id="route-button-border-color-light"
                                        label="Light border and frame color"
                                        onChange={(value) =>
                                            setStartRouteForm((current) => ({
                                                ...current,
                                                button_border_color_light:
                                                    value,
                                            }))
                                        }
                                        value={
                                            startRouteForm.button_border_color_light
                                        }
                                    />
                                </div>
                            </SettingsConfigurationSection>
                        </div>
                    ) : null}

                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/10"
                            disabled={updatingStartRoute}
                            onClick={() =>
                                setPendingDeleteStartRoute(selectedStartRoute)
                            }
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                            Delete route
                        </Button>
                        <div className="flex justify-end gap-2">
                            <Button
                                disabled={updatingStartRoute}
                                onClick={() => setSelectedStartRoute(null)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={
                                    updatingStartRoute || !hasStartRouteChanges
                                }
                                onClick={updateStartRoute}
                                type="button"
                            >
                                Save
                            </Button>
                        </div>
                    </DialogFooter>
                </SettingsConfigurationDialog>
            </Dialog>

            <Dialog
                open={Boolean(pendingDelete)}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDelete(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete activity?</DialogTitle>
                        <DialogDescription>
                            {pendingDelete
                                ? `This removes "${pendingDelete.title}" and its outgoing connections. This cannot be undone.`
                                : 'This activity will be removed.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            disabled={deleting}
                            onClick={() => setPendingDelete(null)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                            disabled={deleting}
                            onClick={deleteActivity}
                            type="button"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(pendingDeleteStartRoute)}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteStartRoute(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete route?</DialogTitle>
                        <DialogDescription>
                            This removes the route button from the learner node
                            panel. The target activity itself stays untouched.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            disabled={deletingStartRoute}
                            onClick={() => setPendingDeleteStartRoute(null)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                            disabled={deletingStartRoute}
                            onClick={deleteStartRoute}
                            type="button"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function RouteVisualPreview({
    form,
    mode,
    title,
}: {
    form: StartRouteForm;
    mode: 'dark' | 'light';
    title: string;
}) {
    const isLight = mode === 'light';
    const image = themedPreviewAsset(form.image_dark, form.image_light, mode);
    const buttonColor =
        (isLight ? form.button_color_light : form.button_color_dark) ||
        (isLight ? '#ffffff' : '#0f172a');
    const borderColor =
        (isLight
            ? form.button_border_color_light
            : form.button_border_color_dark) ||
        (isLight ? '#e2e8f0' : '#334155');

    return (
        <div className="grid gap-2">
            <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Route card preview
                </p>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Uses the current appearance mode.
                </p>
            </div>
            <button
                className="group grid overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5"
                style={{ borderColor }}
                type="button"
            >
                <span
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold"
                    style={{
                        backgroundColor: buttonColor,
                        borderColor,
                        color: isLight ? '#0f172a' : '#f8fafc',
                    }}
                >
                    {title}
                    <ArrowRight className="size-4" />
                </span>
                {image ? (
                    <img
                        alt=""
                        className="aspect-[3/1] w-full object-cover"
                        draggable={false}
                        src={image}
                    />
                ) : null}
            </button>
        </div>
    );
}

function emptyStartRouteForm(): StartRouteForm {
    return {
        button_border_color_dark: '',
        button_border_color_light: '',
        button_color_dark: '',
        button_color_light: '',
        description: '',
        image_dark: '',
        image_light: '',
        label: '',
    };
}

function routeFormFromStartRoute(route: ActivityStartRoute): StartRouteForm {
    return {
        button_border_color_dark: route.buttonBorderColorDark ?? '',
        button_border_color_light: route.buttonBorderColorLight ?? '',
        button_color_dark: route.buttonColorDark ?? '',
        button_color_light: route.buttonColorLight ?? '',
        description: route.description ?? '',
        image_dark: route.imageDark ?? '',
        image_light: route.imageLight ?? '',
        label: route.customLabel ?? '',
    };
}

function RouteColorInput({
    error,
    fallback,
    id,
    label,
    onChange,
    value,
}: {
    error?: string;
    fallback: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <ColorField
            className="rounded-md bg-slate-50 p-3 dark:bg-white/5"
            error={error}
            fallback={fallback}
            id={id}
            inputClassName="font-mono text-sm"
            label={label}
            onChange={onChange}
            pickerClassName="h-10"
            showClear
            value={value}
        />
    );
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]'),
    );
}

function formatTemplateDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
          }).format(date);
}
