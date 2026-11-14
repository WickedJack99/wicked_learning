import {
    History,
    Pencil,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Share2,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { usePlatformTranslation } from './original-platform-translation';

type ActivityTemplate = components['schemas']['AdminActivityTemplateSummary'];
type ActivityTemplateDetails =
    components['schemas']['AdminActivityTemplateDetails'];
type ActivityTemplatePage = components['schemas']['AdminActivityTemplatePage'];
type ActivityTemplateRevisionPage =
    components['schemas']['AdminActivityTemplateRevisionPage'];

type TemplateSourceActivity = { id: string; title: string };

/**
 * Adapted from Laravel's reusable Activity Template Library. The template
 * snapshot remains an authoring starting point: selecting it opens the
 * existing typed activity form, where the author must save a new activity.
 */
export function OriginalActivityTemplatesDialog({
    activity,
    mode,
    onClose,
    onUseTemplate,
}: {
    activity?: TemplateSourceActivity;
    mode: 'library' | 'save' | 'update';
    onClose: () => void;
    onUseTemplate: (template: ActivityTemplateDetails) => void;
}) {
    const t = usePlatformTranslation();
    const [page, setPage] = useState<ActivityTemplatePage | null>(null);
    const [search, setSearch] = useState('');
    const [templateName, setTemplateName] = useState(activity?.title ?? '');
    const [selected, setSelected] = useState<ActivityTemplateDetails | null>(
        null,
    );
    const [rename, setRename] = useState('');
    const [history, setHistory] = useState<ActivityTemplateRevisionPage | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(
        async (nextPage = 1) => {
            setBusy(true);
            setError(null);
            try {
                const { data, response } = await apiClient.GET(
                    '/admin/activity-templates',
                    {
                        params: {
                            query: {
                                page: nextPage,
                                per_page: 8,
                                search: search.trim() || undefined,
                            },
                        },
                    },
                );
                if (!response.ok || !data) {
                    throw new Error('templates unavailable');
                }
                setPage(data);
            } catch {
                setError(t('settings.world_builder.activity_templates.load_error', 'The reusable activity templates could not be loaded.'));
            } finally {
                setBusy(false);
            }
        },
        [search, t],
    );

    useEffect(() => {
        void load();
    }, [load]);

    const open = async (template: ActivityTemplate) => {
        setBusy(true);
        setError(null);
        try {
            const { data, response } = await apiClient.GET(
                '/admin/activity-templates/{template_id}',
                {
                    params: { path: { template_id: template.id } },
                },
            );
            if (!response.ok || !data) {
                throw new Error('template unavailable');
            }
            setSelected(data.template);
            setRename(data.template.name);
            setHistory(null);
        } catch {
            setError(t('settings.world_builder.activity_templates.selected_load_error', 'The selected template could not be loaded.'));
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        if (!activity || !templateName.trim()) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/activities/{activity_id}/templates',
                {
                    body: { name: templateName.trim() },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_id: activity.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('save unavailable');
            }
            setTemplateName('');
            await load(1);
            await open(data.template);
        } catch {
            setError(t('settings.world_builder.activity_templates.save_error', 'The activity could not be saved as a reusable template.'));
        } finally {
            setBusy(false);
        }
    };

    const updateFromActivity = async (template: ActivityTemplate) => {
        if (
            !activity ||
            !window.confirm(
                t('settings.world_builder.activity_templates.update_confirm', 'Update “:template” from “:activity”? The current template will be kept in history.', { activity: activity.title, template: template.name }),
            )
        ) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/activity-templates/{template_id}/from-activity/{activity_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            template_id: template.id,
                            activity_id: activity.id,
                        },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('update unavailable');
            }
            await load(page?.pagination.page ?? 1);
            await open(data.template);
        } catch {
            setError(t('settings.world_builder.activity_templates.update_error', 'The reusable template could not be updated from this activity.'));
        } finally {
            setBusy(false);
        }
    };

    const saveRename = async () => {
        if (!selected || !rename.trim()) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/activity-templates/{template_id}',
                {
                    body: { name: rename.trim() },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { template_id: selected.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('rename unavailable');
            }
            setSelected({ ...selected, ...data.template });
            await load(page?.pagination.page ?? 1);
        } catch {
            setError(t('settings.world_builder.activity_templates.rename_error', 'The reusable template could not be renamed.'));
        } finally {
            setBusy(false);
        }
    };

    const share = async (organizationId: string) => {
        if (!selected) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/activity-templates/{template_id}/sharing',
                {
                    body: { organization_id: organizationId || null },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { template_id: selected.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('sharing unavailable');
            }
            setSelected({ ...selected, ...data.template });
            await load(page?.pagination.page ?? 1);
        } catch {
            setError(t('settings.world_builder.activity_templates.share_error', 'The template sharing setting could not be saved.'));
        } finally {
            setBusy(false);
        }
    };

    const loadHistory = async (nextPage = 1) => {
        if (!selected) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const { data, response } = await apiClient.GET(
                '/admin/activity-templates/{template_id}/revisions',
                {
                    params: {
                        path: { template_id: selected.id },
                        query: { page: nextPage, per_page: 6 },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('history unavailable');
            }
            setHistory(data);
        } catch {
            setError(t('settings.world_builder.activity_templates.history_load_error', 'The template history could not be loaded.'));
        } finally {
            setBusy(false);
        }
    };

    const restore = async (revisionId: string) => {
        if (
            !selected ||
            !window.confirm(
                t('settings.world_builder.activity_templates.restore_confirm', 'Restore this revision to “:template”? The current template will be preserved in history.', { template: selected.name }),
            )
        ) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/activity-templates/{template_id}/revisions/{revision_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            template_id: selected.id,
                            revision_id: revisionId,
                        },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('restore unavailable');
            }
            setSelected({ ...selected, ...data.template });
            await load(page?.pagination.page ?? 1);
            await loadHistory(history?.pagination.page ?? 1);
        } catch {
            setError(t('settings.world_builder.activity_templates.restore_error', 'The template revision could not be restored.'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (
            !selected ||
            !window.confirm(
                t('settings.world_builder.activity_templates.delete_confirm', 'Delete this reusable template? Existing activities will not change.'),
            )
        ) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/activity-templates/{template_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { template_id: selected.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('delete unavailable');
            }
            setSelected(null);
            setHistory(null);
            await load(page?.pagination.page ?? 1);
        } catch {
            setError(t('settings.world_builder.activity_templates.delete_error', 'The reusable template could not be deleted.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            aria-labelledby="activity-template-library-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.activity-templates"
            role="dialog"
        >
            <section className="max-h-[min(48rem,calc(100svh-2rem))] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            <History className="size-4" />
                            {t(
                                'settings.world_builder.activity_templates.eyebrow',
                                'Reusable activities',
                            )}
                        </p>
                        <h2
                            className="mt-1 text-xl font-semibold"
                            id="activity-template-library-title"
                        >
                            {t(
                                'settings.world_builder.activity_templates.title',
                                'Activity template library',
                            )}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {t(
                                'settings.world_builder.activity_templates.description',
                                'Templates create editable copies. Shared templates can be used by organization members, while only their creator can manage them.',
                            )}
                        </p>
                    </div>
                    <button
                        aria-label={t(
                            'settings.world_builder.activity_templates.close',
                            'Close activity template library',
                        )}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </header>
                {error ? (
                    <p
                        className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100"
                        role="status"
                    >
                        {error}
                    </p>
                ) : null}
                {activity && mode === 'save' ? (
                    <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-300/30 dark:bg-teal-300/10">
                        <label className="block text-sm font-medium">
                            {t(
                                'settings.world_builder.activity_templates.save_activity',
                                'Save “:activity” as a reusable template',
                                { activity: activity.title },
                            )}
                            <input
                                aria-label={t(
                                    'settings.world_builder.activity_templates.name_label',
                                    'Template name',
                                )}
                                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-normal dark:border-white/20 dark:bg-slate-900"
                                maxLength={120}
                                onChange={(event) =>
                                    setTemplateName(event.target.value)
                                }
                                value={templateName}
                            />
                        </label>
                        <button
                            className="mt-3 inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                            disabled={busy || !templateName.trim()}
                            onClick={() => void save()}
                            type="button"
                        >
                            <Save className="size-4" />
                            {t(
                                'settings.world_builder.activity_templates.save',
                                'Save reusable template',
                            )}
                        </button>
                    </div>
                ) : null}
                {activity && mode === 'update' ? (
                    <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50/60 p-3 text-sm text-teal-950 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-50">
                        {t(
                            'settings.world_builder.activity_templates.update_description',
                            'Choose one of your templates below to replace it with “:activity”. Its current snapshot will be preserved in history.',
                            { activity: activity.title },
                        )}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                    <div>
                        <div className="flex flex-wrap gap-2">
                            <label className="flex min-w-48 flex-1 items-center gap-2 rounded-md border border-slate-300 px-2 dark:border-white/20">
                                <Search className="size-4 text-slate-500" />
                                <input
                                    aria-label={t(
                                        'settings.world_builder.activity_templates.search_label',
                                        'Search reusable templates',
                                    )}
                                    className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    value={search}
                                />
                            </label>
                            <button
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                                onClick={() => void load()}
                                type="button"
                            >
                                {t(
                                    'settings.world_builder.activity_templates.search',
                                    'Search',
                                )}
                            </button>
                        </div>
                        <div className="mt-3 grid gap-2">
                            {busy && !page ? (
                                <p className="text-sm text-slate-500">
                                    {t(
                                        'settings.world_builder.activity_templates.loading',
                                        'Loading templates…',
                                    )}
                                </p>
                            ) : page?.items.length ? (
                                page.items.map((template) => (
                                    <article
                                        className={`rounded-lg border p-3 ${selected?.id === template.id ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-slate-200 dark:border-white/10'}`}
                                        key={template.id}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-medium">
                                                    {template.name}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                                    {template.title}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {template.activity_type.replaceAll(
                                                        '_',
                                                        ' ',
                                                    )}
                                                    {template.organization
                                                        ? ` · ${t(
                                                              'settings.world_builder.activity_templates.shared_with',
                                                              'Shared with :organization',
                                                              {
                                                                  organization:
                                                                      template
                                                                          .organization
                                                                          .name,
                                                              },
                                                          )}`
                                                        : ` · ${t(
                                                              'settings.world_builder.activity_templates.private',
                                                              'Private',
                                                          )}`}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                                <button
                                                    className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                                                    onClick={() =>
                                                        void open(template)
                                                    }
                                                    type="button"
                                                >
                                                    {t(
                                                        'settings.world_builder.activity_templates.preview',
                                                        'Preview',
                                                    )}
                                                </button>
                                                {mode === 'update' &&
                                                activity &&
                                                template.can_manage ? (
                                                    <button
                                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void updateFromActivity(
                                                                template,
                                                            )
                                                        }
                                                        type="button"
                                                    >
                                                        <RefreshCw className="size-3.5" />
                                                        {t(
                                                            'settings.world_builder.activity_templates.update',
                                                            'Update',
                                                        )}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/20">
                                    {t(
                                        'settings.world_builder.activity_templates.empty',
                                        'No saved activity template matches this page.',
                                    )}
                                </p>
                            )}
                        </div>
                        {page ? (
                            <nav
                                aria-label={t(
                                    'settings.world_builder.activity_templates.pagination_label',
                                    'Activity template pagination',
                                )}
                                className="mt-4 flex items-center justify-between text-sm"
                            >
                                <span className="text-slate-500">
                                    {t(
                                        'settings.world_builder.activity_templates.pagination',
                                        'Page :page of :last',
                                        {
                                            last: page.pagination.last_page,
                                            page: page.pagination.page,
                                        },
                                    )}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-white/20"
                                        disabled={
                                            busy || page.pagination.page <= 1
                                        }
                                        onClick={() =>
                                            void load(page.pagination.page - 1)
                                        }
                                        type="button"
                                    >
                                        {t(
                                            'settings.world_builder.activity_templates.previous',
                                            'Previous',
                                        )}
                                    </button>
                                    <button
                                        className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-white/20"
                                        disabled={
                                            busy ||
                                            page.pagination.page >=
                                                page.pagination.last_page
                                        }
                                        onClick={() =>
                                            void load(page.pagination.page + 1)
                                        }
                                        type="button"
                                    >
                                        {t(
                                            'settings.world_builder.activity_templates.next',
                                            'Next',
                                        )}
                                    </button>
                                </div>
                            </nav>
                        ) : null}
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        {selected ? (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-medium">
                                            {selected.name}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {selected.title} ·{' '}
                                            {selected.activity_type.replaceAll(
                                                '_',
                                                ' ',
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        className="rounded-md bg-teal-700 px-2 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
                                        onClick={() => onUseTemplate(selected)}
                                        type="button"
                                    >
                                        {t(
                                            'settings.world_builder.activity_templates.create_copy',
                                            'Create editable copy',
                                        )}
                                    </button>
                                </div>
                                {selected.media_references.length ? (
                                    <div className="mt-4 rounded-md border border-slate-200 p-3 text-sm dark:border-white/10">
                                        <h4 className="font-medium">
                                            {t(
                                                'settings.world_builder.activity_templates.media_title',
                                                'Reusable media',
                                            )}
                                        </h4>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            {t(
                                                'settings.world_builder.activity_templates.media_availability',
                                                ':available of :total referenced media files are available in this workspace.',
                                                {
                                                    available:
                                                        selected.media_references.filter(
                                                            (reference) =>
                                                                reference.available,
                                                        ).length,
                                                    total: selected.media_references
                                                        .length,
                                                },
                                            )}
                                        </p>
                                        <ul className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                                            {selected.media_references
                                                .slice(0, 6)
                                                .map((reference) => (
                                                    <li
                                                        key={`${reference.asset_id}-${reference.url}`}
                                                    >
                                                        {reference.available
                                                            ? '✓'
                                                            : '!'}{' '}
                                                        {reference.url}
                                                    </li>
                                                ))}
                                        </ul>
                                        {selected.media_references.length >
                                        6 ? (
                                            <p className="mt-2 text-xs text-slate-500">
                                                {t(
                                                    'settings.world_builder.activity_templates.media_more',
                                                    ':count more media references are included.',
                                                    {
                                                        count:
                                                            selected
                                                                .media_references
                                                                .length - 6,
                                                    },
                                                )}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                                {selected.can_manage ? (
                                    <>
                                        <label className="mt-4 block text-sm font-medium">
                                            {t(
                                                'settings.world_builder.activity_templates.name_label',
                                                'Template name',
                                            )}
                                            <input
                                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-normal dark:border-white/20 dark:bg-slate-900"
                                                maxLength={120}
                                                onChange={(event) =>
                                                    setRename(
                                                        event.target.value,
                                                    )
                                                }
                                                value={rename}
                                            />
                                        </label>
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                                                disabled={
                                                    busy || !rename.trim()
                                                }
                                                onClick={() =>
                                                    void saveRename()
                                                }
                                                type="button"
                                            >
                                                <Pencil className="size-3.5" />
                                                {t(
                                                    'settings.world_builder.activity_templates.rename',
                                                    'Rename',
                                                )}
                                            </button>
                                        </div>
                                        <label className="mt-4 block text-sm font-medium">
                                            {t(
                                                'settings.world_builder.activity_templates.share_label',
                                                'Share with organization',
                                            )}
                                            <select
                                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-normal dark:border-white/20 dark:bg-slate-900"
                                                disabled={busy}
                                                onChange={(event) =>
                                                    void share(
                                                        event.target.value,
                                                    )
                                                }
                                                value={
                                                    selected.organization?.id ??
                                                    ''
                                                }
                                            >
                                                <option value="">
                                                    {t(
                                                        'settings.world_builder.activity_templates.private',
                                                        'Private',
                                                    )}
                                                </option>
                                                {page?.share_targets.map(
                                                    (organization) => (
                                                        <option
                                                            key={
                                                                organization.id
                                                            }
                                                            value={
                                                                organization.id
                                                            }
                                                        >
                                                            {organization.name}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                    </>
                                ) : (
                                    <p className="mt-4 inline-flex items-center gap-1 text-sm text-slate-500">
                                        <Share2 className="size-4" />
                                        {t(
                                            'settings.world_builder.activity_templates.read_only',
                                            'This shared template is read-only.',
                                        )}
                                    </p>
                                )}
                                <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-medium">
                                            {t(
                                                'settings.world_builder.activity_templates.history_title',
                                                'Template history',
                                            )}
                                        </h4>
                                        <button
                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10"
                                            disabled={busy}
                                            onClick={() => void loadHistory()}
                                            type="button"
                                        >
                                            <History className="size-3.5" />
                                            {t(
                                                'settings.world_builder.activity_templates.load_history',
                                                'Load history',
                                            )}
                                        </button>
                                    </div>
                                    {history?.items.length ? (
                                        <div className="mt-2 grid gap-2">
                                            {history.items.map((revision) => (
                                                <div
                                                    className="flex items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm dark:border-white/10"
                                                    key={revision.id}
                                                >
                                                    <span>
                                                        <strong>
                                                            {revision.title}
                                                        </strong>
                                                        <br />
                                                        <time className="text-xs text-slate-500">
                                                            {new Date(
                                                                revision.created_at,
                                                            ).toLocaleString()}
                                                        </time>
                                                    </span>
                                                    {selected.can_manage ? (
                                                        <button
                                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-300/10"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void restore(
                                                                    revision.id,
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <RotateCcw className="size-3.5" />
                                                            {t(
                                                                'settings.world_builder.activity_templates.restore',
                                                                'Restore',
                                                            )}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    ) : history ? (
                                        <p className="mt-2 text-sm text-slate-500">
                                            {t(
                                                'settings.world_builder.activity_templates.history_empty',
                                                'No saved history yet.',
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                                {selected.can_manage ? (
                                    <button
                                        className="mt-5 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-300/10"
                                        disabled={busy}
                                        onClick={() => void remove()}
                                        type="button"
                                    >
                                        <Trash2 className="size-4" />
                                        {t(
                                            'settings.world_builder.activity_templates.delete',
                                            'Delete template',
                                        )}
                                    </button>
                                ) : null}
                            </>
                        ) : (
                            <p className="text-sm text-slate-500">
                                {t(
                                    'settings.world_builder.activity_templates.selected_empty',
                                    'Preview a template to inspect it, create an editable copy, or manage its sharing and history.',
                                )}
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
