import { ArrowLeft, Pencil, Save, X } from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { OriginalMarkdownRenderer } from './original-markdown';
import { usePlatformTranslation } from './original-platform-translation';

export type InformationPageSlug = 'about' | 'imprint' | 'data-protection';

type PublicPage = components['schemas']['PublicPage'];

/**
 * Source-adapted from `PlatformInfoPage`'s authenticated settings variant.
 * Its writer is the existing scoped public-information endpoint; unauthorised
 * readers retain the original read-only information surface.
 */
export function OriginalSettingsInformationPage({
    appearance,
    slug,
}: {
    appearance: OriginalAppearance;
    slug: InformationPageSlug;
}) {
    const t = usePlatformTranslation();
    const [page, setPage] = useState<PublicPage | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<'loading' | 'missing' | 'ready' | 'unavailable'>('loading');

    useEffect(() => {
        let active = true;

        setStatus('loading');
        setEditing(false);
        setCanEdit(false);

        void Promise.all([
            apiClient.GET('/public/pages/{slug}', { params: { path: { slug } } }),
            apiClient.GET('/admin/public-information-pages'),
        ]).then(([publicResponse, adminResponse]) => {
            if (!active) {
                return;
            }

            if (publicResponse.response.status === 404 || !publicResponse.data) {
                setStatus(publicResponse.response.status === 404 ? 'missing' : 'unavailable');
                return;
            }

            const editablePage = adminResponse.response.ok
                ? adminResponse.data?.find((candidate) => candidate.slug === slug)
                : undefined;
            const loadedPage = editablePage ?? publicResponse.data;

            setPage(loadedPage);
            setDraft(loadedPage.body);
            setCanEdit(Boolean(editablePage));
            setStatus('ready');
        }).catch(() => {
            if (active) {
                setStatus('unavailable');
            }
        });

        return () => {
            active = false;
        };
    }, [slug]);

    function cancel(): void {
        setDraft(page?.body ?? '');
        setEditing(false);
    }

    async function save(): Promise<void> {
        if (!page || saving || draft.trim() === '') {
            return;
        }

        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/public-information-pages/{slug}',
                {
                    body: { body: draft },
                    params: { header: { 'X-CSRF-Token': token }, path: { slug } },
                },
            );
            if (!response.ok || !data) {
                throw new Error('save unavailable');
            }

            setPage(data);
            setDraft(data.body);
            setEditing(false);
        } catch {
            setStatus('unavailable');
        } finally {
            setSaving(false);
        }
    }

    const title = page?.title ?? pageTitle(t, slug);

    return (
        <main
            className="min-h-svh bg-slate-100 px-4 py-6 pb-24 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
            data-wl-id="settings.information"
            style={settingsStyle(appearance)}
        >
            <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-3xl flex-col">
                <header className="mb-6 flex shrink-0 items-center justify-between gap-3">
                    <Link
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]"
                        to="/settings"
                    >
                        <ArrowLeft className="size-4" />
                        {t('common.settings', 'Settings')}
                    </Link>
                    {canEdit && !editing ? (
                        <button
                            className="inline-flex items-center gap-2 rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium hover:bg-[var(--settings-active-background)]"
                            onClick={() => setEditing(true)}
                            type="button"
                        >
                            <Pencil className="size-4" />
                            {t('common.edit', 'Edit')}
                        </button>
                    ) : null}
                </header>
                <article
                    className={`min-h-0 flex-1 rounded-xl border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-6 shadow-xl shadow-slate-950/10 dark:shadow-black/30 md:p-8${editing ? ' flex flex-col' : ''}`}
                    data-wl-id="settings.information.page"
                >
                    <p className="shrink-0 text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                        {title}
                    </p>
                    {status === 'loading' ? (
                        <p aria-live="polite" className="mt-4 text-sm text-[var(--settings-muted-text)]">
                            {t('settings.information.loading', 'Loading information…')}
                        </p>
                    ) : null}
                    {status === 'missing' ? (
                        <p className="mt-4 text-sm text-[var(--settings-muted-text)]" role="alert">
                            {t('settings.information.missing', 'This information page is not available.')}
                        </p>
                    ) : null}
                    {status === 'unavailable' ? (
                        <p className="mt-4 text-sm text-red-700 dark:text-red-300" role="alert">
                            {t('settings.information.unavailable', 'Information is temporarily unavailable. Try again.')}
                        </p>
                    ) : null}
                    {status === 'ready' && page && !editing ? (
                        <div className="mt-4">
                            <OriginalMarkdownRenderer markdown={page.body} />
                        </div>
                    ) : null}
                    {status === 'ready' && page && editing ? (
                        <div className="mt-4 flex min-h-0 flex-1 flex-col" data-wl-id="settings.information.editor">
                            <label className="sr-only" htmlFor="information-markdown">
                                {t('settings.information.markdown', 'Markdown content')}
                            </label>
                            <textarea
                                className="min-h-72 flex-1 resize-none rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 font-mono text-sm leading-6 outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[var(--settings-accent)]/20"
                                id="information-markdown"
                                onChange={(event) => setDraft(event.currentTarget.value)}
                                value={draft}
                            />
                            <div className="mt-4 flex shrink-0 justify-end gap-2">
                                <button
                                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-[var(--settings-active-background)]"
                                    disabled={saving}
                                    onClick={cancel}
                                    type="button"
                                >
                                    <X className="size-4" />
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    disabled={saving || draft.trim() === ''}
                                    onClick={() => void save()}
                                    type="button"
                                >
                                    <Save className="size-4" />
                                    {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </article>
            </div>
        </main>
    );
}

function pageTitle(t: (key: string, fallback?: string) => string, slug: InformationPageSlug): string {
    if (slug === 'imprint') {
        return t('settings.information.imprint', 'Imprint');
    }
    if (slug === 'data-protection') {
        return t('settings.information.data_protection', 'Data protection');
    }
    return t('settings.information.about', 'About');
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';

    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
    } as CSSProperties;
}
