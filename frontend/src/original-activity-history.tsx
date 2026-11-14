import { ArrowLeft, History, RotateCcw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { usePlatformTranslation } from './original-platform-translation';

type ActivityVersionPage = components['schemas']['AdminActivityVersionPage'];
type ActivityVersionSummary =
    components['schemas']['AdminActivityVersionSummary'];
type ActivityVersionDetails =
    components['schemas']['AdminActivityVersionDetails'];

/**
 * Source-adapted from Laravel's `ActivityHistoryDialog`: the source dialog's
 * bounded page, inspection screen and restore confirmation now use typed Rust
 * transport without changing its authoring workflow or visual hierarchy.
 */
export function OriginalActivityHistoryDialog({
    activityId,
    activityTitle,
    onClose,
    onRestored,
}: {
    activityId: string;
    activityTitle: string;
    onClose: () => void;
    onRestored: () => void;
}) {
    const t = usePlatformTranslation();
    const [history, setHistory] = useState<ActivityVersionPage | null>(null);
    const [details, setDetails] = useState<ActivityVersionDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [inspectingId, setInspectingId] = useState<string | null>(null);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    const loadHistory = useCallback(
        async (page = 1) => {
            setLoading(true);
            setError(null);
            setDetails(null);
            try {
                const { data, response } = await apiClient.GET(
                    '/admin/world-builder/activities/{activity_id}/versions',
                    {
                        params: {
                            path: { activity_id: activityId },
                            query: { page, per_page: 6 },
                        },
                    },
                );
                if (!response.ok || !data) {
                    throw new Error('history unavailable');
                }
                setHistory(data);
            } catch {
                setError(t('settings.activity_history.load_error', 'Activity history could not be loaded. Try again.'));
            } finally {
                setLoading(false);
            }
        },
        [activityId, t],
    );

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const inspect = async (version: ActivityVersionSummary) => {
        setInspectingId(version.id);
        setError(null);
        try {
            const { data, response } = await apiClient.GET(
                '/admin/world-builder/activities/{activity_id}/versions/{version_id}',
                {
                    params: {
                        path: {
                            activity_id: activityId,
                            version_id: version.id,
                        },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('version unavailable');
            }
            setDetails(data.version);
        } catch {
            setError(t('settings.activity_history.inspect_error', 'This activity version could not be inspected. Try again.'));
        } finally {
            setInspectingId(null);
        }
    };

    const restore = async (version: ActivityVersionSummary) => {
        if (
            !window.confirm(
                t('settings.activity_history.restore_confirm', 'Restore this activity version? The current configuration will be preserved in history and the restored activity will need review.'),
            )
        ) {
            return;
        }
        setRestoringId(version.id);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/admin/world-builder/activities/{activity_id}/versions/{version_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_id: activityId,
                            version_id: version.id,
                        },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('restore unavailable');
            }
            onRestored();
        } catch {
            setError(t('settings.activity_history.restore_error', 'This activity version could not be restored. Try again.'));
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <div
            aria-labelledby="activity-history-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.activity-history"
            role="dialog"
        >
            <section className="max-h-[min(44rem,calc(100svh-2rem))] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            <History className="size-4" />
                            {t('settings.activity_history.label', 'Activity history')}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold" id="activity-history-title">
                            {details?.title ?? activityTitle}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {t('settings.activity_history.description', 'Review earlier activity details, type-specific settings and route connections. Restoring preserves the current state as a new history entry.')}
                        </p>
                    </div>
                    <button
                        aria-label={t('settings.activity_history.close', 'Close activity history')}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </header>

                {error ? (
                    <p aria-live="polite" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="status">
                        {error}
                    </p>
                ) : null}

                <div className="mt-5" data-wl-id="authoring.activity-history.content">
                    {loading ? (
                        <p aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300" role="status">
                            {t('settings.activity_history.loading', 'Loading activity history…')}
                        </p>
                    ) : details ? (
                        <HistoryDetails
                            t={t}
                            restoring={restoringId === details.id}
                            version={details}
                            onBack={() => setDetails(null)}
                            onRestore={() => void restore(details)}
                        />
                    ) : history && history.items.length > 0 ? (
                        <div className="grid gap-2">
                            {history.items.map((version) => (
                                <article
                                    className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10"
                                    key={version.id}
                                >
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                        <h3 className="text-sm font-medium">
                                            {version.title || t('settings.activity_history.untitled', 'Untitled activity')}
                                        </h3>
                                        <time className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatVersionDate(version.created_at)}
                                        </time>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {version.activity_type || t('settings.activity_history.unknown_type', 'Unknown type')}
                                        {version.introduction
                                            ? ` · ${version.introduction}`
                                            : ''}
                                    </p>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <button
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                                            disabled={restoringId !== null}
                                            onClick={() => void inspect(version)}
                                            type="button"
                                        >
                                            <Search className="size-4" />
                                            {inspectingId === version.id
                                                ? t('settings.activity_history.inspecting', 'Inspecting…')
                                                : t('settings.activity_history.inspect', 'Inspect')}
                                        </button>
                                        <button
                                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-300/10"
                                            disabled={restoringId !== null}
                                            onClick={() => void restore(version)}
                                            type="button"
                                        >
                                            <RotateCcw className="size-4" />
                                            {restoringId === version.id
                                                ? t('settings.activity_history.restoring', 'Restoring…')
                                                : t('settings.activity_history.restore', 'Restore this version')}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('settings.activity_history.empty', 'No earlier activity configuration yet. The first update will create one.')}
                        </p>
                    )}
                </div>

                {history && !details ? (
                    <nav aria-label={t('settings.activity_history.pagination', 'Activity history pagination')} className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm dark:border-white/10">
                        <span className="text-slate-500 dark:text-slate-400">
                            {t('settings.activity_history.page', 'Page :page of :total', { page: history.pagination.page, total: history.pagination.last_page })}
                        </span>
                        <div className="flex gap-2">
                            <button
                                className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                                disabled={loading || history.pagination.page <= 1}
                                onClick={() =>
                                    void loadHistory(history.pagination.page - 1)
                                }
                                type="button"
                            >
                                {t('settings.activity_history.previous', 'Previous')}
                            </button>
                            <button
                                className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                                disabled={
                                    loading ||
                                    history.pagination.page >=
                                        history.pagination.last_page
                                }
                                onClick={() =>
                                    void loadHistory(history.pagination.page + 1)
                                }
                                type="button"
                            >
                                {t('settings.activity_history.next', 'Next')}
                            </button>
                        </div>
                    </nav>
                ) : null}
            </section>
        </div>
    );
}

function HistoryDetails({
    onBack,
    onRestore,
    restoring,
    t,
    version,
}: {
    onBack: () => void;
    onRestore: () => void;
    restoring: boolean;
    t: Translate;
    version: ActivityVersionDetails;
}) {
    const config = version.snapshot.config;
    const transitions = Array.isArray(version.snapshot.transitions)
        ? version.snapshot.transitions
        : [];

    return (
        <div className="grid gap-4">
            <button
                className="inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10"
                onClick={onBack}
                type="button"
            >
                <ArrowLeft className="size-4" />
                {t('settings.activity_history.back', 'Back to history')}
            </button>
            <dl className="grid gap-3 rounded-lg border border-slate-200 p-4 text-sm sm:grid-cols-2 dark:border-white/10">
                <SnapshotField label={t('settings.activity_history.activity_type', 'Activity type')} value={version.activity_type || t('settings.activity_history.unknown', 'Unknown')} />
                <SnapshotField label={t('settings.activity_history.slug', 'Slug')} value={version.slug || t('settings.activity_history.not_set', 'Not set')} />
                <SnapshotField className="sm:col-span-2" label={t('settings.activity_history.introduction', 'Introduction')} value={version.introduction || t('settings.activity_history.not_set', 'Not set')} />
            </dl>
            <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <h3 className="text-sm font-medium">{t('settings.activity_history.type_settings', 'Type-specific settings')}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {config && typeof config === 'object'
                        ? t('settings.activity_history.configured_fields', ':count configured fields', { count: Object.keys(config).length })
                        : t('settings.activity_history.no_type_settings', 'No type-specific settings were stored.')}
                </p>
            </section>
            <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                <SnapshotField label={t('settings.activity_history.route_connections', 'Route connections')} value={String(transitions.length)} />
                <SnapshotField label={t('settings.activity_history.graph_position', 'Graph position')} value={formatPosition(version.snapshot, t)} />
            </dl>
            <button
                className="inline-flex w-fit items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                disabled={restoring}
                onClick={onRestore}
                type="button"
            >
                <RotateCcw className="size-4" />
                {restoring ? t('settings.activity_history.restoring', 'Restoring…') : t('settings.activity_history.restore', 'Restore this version')}
            </button>
        </div>
    );
}

function SnapshotField({
    className = '',
    label,
    value,
}: {
    className?: string;
    label: string;
    value: string;
}) {
    return (
        <div className={className}>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {label}
            </dt>
            <dd className="mt-1 break-words text-slate-950 dark:text-white">{value}</dd>
        </div>
    );
}

function formatVersionDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(date);
}

type Translate = (key: string, fallback?: string, replacements?: Record<string, number | string>) => string;
function formatPosition(snapshot: Record<string, unknown>, t: Translate): string {
    const x = snapshot.graphPositionX;
    const y = snapshot.graphPositionY;
    return typeof x === 'number' && typeof y === 'number'
        ? `${x}, ${y}`
        : t('settings.activity_history.not_positioned', 'Not positioned');
}
