import { ChevronLeft, ChevronRight, Inbox, Send, ShieldCheck, Users } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type ReviewPage = components['schemas']['AdminJournalFeedbackPage'];
type ReviewItem = components['schemas']['AdminJournalFeedbackItem'];

/** Source-adapted from Settings/AdminPanel's FeedbackRequestsSection and the
 * journal Policy section. This is intentionally separate from platform
 * feedback: journal writing is shown here only after a learner requested it. */
export function OriginalJournalFeedbackReviewPage({
    appearance,
    canManagePolicy,
    canRespond,
    canView,
}: {
    appearance: OriginalAppearance;
    canManagePolicy: boolean;
    canRespond: boolean;
    canView: boolean;
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const requestedPage = Number(
        new URLSearchParams(location.search).get('journal_feedback_page') ?? 1,
    );
    const [page, setPage] = useState<ReviewPage | null>(null);
    const [policyEnabled, setPolicyEnabled] = useState<boolean | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!canView) {
            setLoading(false);
            setPage(null);
            return;
        }
        let active = true;
        const pageNumber =
            Number.isInteger(requestedPage) && requestedPage > 0
                ? requestedPage
                : 1;
        setLoading(true);
        setError('');
        void apiClient
            .GET('/admin/journal-feedback', {
                params: { query: { page: pageNumber } },
            })
            .then(({ data, response }) => {
                if (!response.ok || !data) throw new Error('queue unavailable');
                if (!active) return;
                setPage(data);
                setSelectedId((current) =>
                    data.items.some((item) => item.id === current)
                        ? current
                        : (data.items[0]?.id ?? null),
                );
                setFeedbackById((current) => ({
                    ...Object.fromEntries(
                        data.items.map((item) => [item.id, item.feedback ?? '']),
                    ),
                    ...current,
                }));
            })
            .catch(() => active && setError('Journal feedback is temporarily unavailable.'))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [canView, requestedPage]);

    useEffect(() => {
        if (!canManagePolicy) return;
        let active = true;
        void apiClient.GET('/admin/journal-feedback/policy').then(({ data, response }) => {
            if (active && response.ok && data) setPolicyEnabled(data.allow_review_requests);
        });
        return () => { active = false; };
    }, [canManagePolicy]);

    const selected = useMemo(
        () => page?.items.find((item) => item.id === selectedId) ?? null,
        [page, selectedId],
    );
    const currentFeedback = selected ? (feedbackById[selected.id] ?? '') : '';

    async function savePolicy(enabled: boolean): Promise<void> {
        if (saving || !canManagePolicy) return;
        const previous = policyEnabled;
        setPolicyEnabled(enabled);
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/journal-feedback/policy',
                { body: { allow_review_requests: enabled }, params: { header: { 'X-CSRF-Token': token } } },
            );
            if (!response.ok || !data) throw new Error('policy unavailable');
            setPolicyEnabled(data.allow_review_requests);
        } catch {
            setPolicyEnabled(previous);
            setError('The journal review policy could not be saved yet.');
        } finally {
            setSaving(false);
        }
    }

    async function sendFeedback(): Promise<void> {
        if (!selected || !canRespond || saving || selected.responded_at || !currentFeedback.trim()) return;
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/admin/journal-feedback/{request_id}/respond',
                { body: { feedback: currentFeedback }, params: { header: { 'X-CSRF-Token': token }, path: { request_id: selected.id } } },
            );
            if (!response.ok) throw new Error('reply unavailable');
            setPage((current) => current ? {
                ...current,
                items: current.items.map((item) => item.id === selected.id ? {
                    ...item, feedback: currentFeedback.trim(), responded_at: new Date().toISOString(), status: 'responded',
                } : item),
            } : current);
        } catch {
            setError('The feedback could not be sent yet.');
        } finally {
            setSaving(false);
        }
    }

    function changePage(nextPage: number): void {
        const parameters = new URLSearchParams(location.search);
        parameters.set('journal_feedback_page', String(nextPage));
        navigate(`/settings?${parameters.toString()}`);
    }

    return (
        <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
            <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Link className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/home"><ChevronLeft className="size-4" /> Learning desk</Link>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Settings</p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Learning Support</h1>
                    </div>
                </header>
                <section className="min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)]">
                    <div className="flex h-full min-h-0 flex-col" data-wl-id="settings.learning-support.feedback-requests">
                        <header className="shrink-0 border-b border-[var(--settings-border-color)] px-4 py-4 sm:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex items-start gap-3"><Inbox className="mt-1 size-5 shrink-0 text-[var(--settings-accent)]" /><div><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Journal feedback</p><h2 className="mt-2 text-2xl font-semibold">Feedback requests</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Learners have deliberately shared these journal pages for one-time informational feedback.</p></div></div>
                                {canManagePolicy ? <label className="flex items-center gap-3 rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm"><ShieldCheck className="size-4 text-[var(--settings-accent)]" /><span>Allow review requests</span><input aria-label="Allow journal review requests" checked={policyEnabled ?? false} disabled={saving || policyEnabled === null} onChange={(event) => void savePolicy(event.target.checked)} type="checkbox" /></label> : null}
                            </div>
                        </header>
                        {error ? <p className="m-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
                        {loading ? <p className="p-8 text-sm text-[var(--settings-muted-text)]">Loading feedback requests...</p> : null}
                        {!loading && page ? <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]">
                            <aside className="flex min-h-0 flex-col border-b border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] lg:border-r lg:border-b-0"><div className="min-h-0 flex-1 overflow-y-auto p-3">{page.items.length ? page.items.map((item) => <FeedbackRequestButton active={item.id === selected?.id} item={item} key={item.id} onSelect={() => setSelectedId(item.id)} />) : <p className="p-1 text-sm text-[var(--settings-muted-text)]">No feedback requests yet.</p>}</div><Pagination current={page.pagination.current_page} last={page.pagination.last_page} onChange={changePage} /></aside>
                            {selected ? <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]"><FeedbackRequestHeader item={selected} /><div className="grid min-h-0 gap-5 overflow-y-auto p-4 sm:p-5 xl:grid-cols-2"><div className="min-h-[14rem] border-b border-[var(--settings-border-color)] pb-4 text-sm leading-6 whitespace-pre-wrap xl:border-r xl:border-b-0 xl:pr-5 xl:pb-0"><h3 className="mb-3 font-semibold">Reflection</h3>{selected.page.markdown || 'This journal page is empty.'}</div><label className="grid min-h-[14rem] grid-rows-[auto_minmax(0,1fr)] gap-3 font-semibold">Feedback<textarea className="min-h-[14rem] resize-none rounded-md border border-[var(--settings-border-color)] p-3 text-sm font-normal outline-none focus:border-[var(--settings-accent)]" disabled={!canRespond || selected.responded_at !== null} onChange={(event) => setFeedbackById((current) => ({ ...current, [selected.id]: event.target.value }))} placeholder="Write informational feedback for this learner..." value={currentFeedback} /></label></div><footer className="flex justify-end px-4 pb-4 sm:px-5 sm:pb-5"><button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!canRespond || saving || selected.responded_at !== null || !currentFeedback.trim()} onClick={() => void sendFeedback()} type="button"><Send className="size-4" />{saving ? 'Sending...' : selected.responded_at ? 'Responded' : 'Send'}</button></footer></section> : <div className="grid place-items-center text-sm text-[var(--settings-muted-text)]">Select a feedback request.</div>}
                        </div> : null}
                        {!loading && !canView ? <p className="p-6 text-sm text-[var(--settings-muted-text)]">You can manage the review policy, but do not have access to learner review requests.</p> : null}
                    </div>
                </section>
            </div>
        </main>
    );
}

function FeedbackRequestButton({ active, item, onSelect }: { active: boolean; item: ReviewItem; onSelect: () => void }) {
    return <button className={`relative w-full border-b border-[var(--settings-border-color)] px-4 py-3 text-left transition hover:bg-[var(--settings-active-background)] ${active ? 'border-l-2 border-l-[var(--settings-accent)] bg-[var(--settings-active-background)]' : 'border-l-2 border-l-transparent'}`} onClick={onSelect} type="button"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.page.title || 'Untitled'}</p><span className="rounded-full bg-[var(--settings-accent)] px-2 py-1 text-xs font-bold text-slate-950 uppercase">{item.responded_at ? 'Responded' : 'Pending'}</span></div><p className="mt-1 text-xs text-[var(--settings-muted-text)]">{item.requester.name ?? item.requester.email ?? 'Unknown requester'}</p><p className="mt-2 text-xs font-semibold text-[var(--settings-accent)]">{item.domain.label}</p></button>;
}

function FeedbackRequestHeader({ item }: { item: ReviewItem }) {
    return <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-4 py-4 sm:px-5"><div><p className="text-xs font-semibold tracking-[0.16em] text-[var(--settings-accent)] uppercase">Journal page</p><h2 className="mt-1 text-2xl font-semibold">{item.page.title || 'Untitled'}</h2><p className="mt-1 text-sm text-[var(--settings-muted-text)]">{item.page.topic}{item.page.subtopic ? ` / ${item.page.subtopic}` : ''}</p><p className="mt-2 text-sm font-semibold text-[var(--settings-accent)]">{item.domain.label}</p></div><div className="flex items-center gap-2 text-sm text-[var(--settings-muted-text)]"><Users className="size-4" />{item.requester.name ?? item.requester.email ?? 'Unknown requester'}</div></header>;
}

function Pagination({ current, last, onChange }: { current: number; last: number; onChange: (next: number) => void }) {
    return <footer className="flex items-center justify-between gap-2 border-t border-[var(--settings-border-color)] p-3 text-sm"><button className="inline-flex items-center disabled:opacity-40" disabled={current <= 1} onClick={() => onChange(current - 1)} type="button"><ChevronLeft className="size-4" /> Previous</button><span className="text-xs text-[var(--settings-muted-text)]">Page {current} of {last}</span><button className="inline-flex items-center disabled:opacity-40" disabled={current >= last} onClick={() => onChange(current + 1)} type="button">Next <ChevronRight className="size-4" /></button></footer>;
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
