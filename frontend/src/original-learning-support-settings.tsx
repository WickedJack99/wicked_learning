import { ArrowLeft, MessageSquareText, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalLearnerHeader } from './original-learner-header';

type LearningSupportTopic = components['schemas']['LearningSupportTopic'];
type LearningSupportRequestPage = components['schemas']['LearningSupportRequestPage'];

/**
 * A direct extraction of the source Learning Support message workspace. It is
 * intentionally limited to private support requests: peer walls and the
 * broader Settings panels remain unavailable until their matching contracts
 * are migrated.
 */
export function OriginalLearningSupportSettingsPage({
    onSignedOut,
    userEmail,
}: {
    onSignedOut: () => void;
    userEmail: string;
}) {
    const [topics, setTopics] = useState<LearningSupportTopic[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [document, setDocument] = useState<LearningSupportRequestPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        let current = true;
        void apiClient.GET('/learning-support/topics').then(({ data, response }) => {
            if (!current) return;
            if (!response.ok || !data) {
                setError('Learning Support messages could not be loaded.');
                setLoading(false);
                return;
            }
            setTopics(data);
            setSelectedTopicId((selected) => selected ?? data[0]?.id ?? null);
            setLoading(false);
        }).catch(() => current && (setError('Learning Support messages could not be loaded.'), setLoading(false)));
        return () => { current = false; };
    }, []);

    useEffect(() => {
        if (!selectedTopicId) {
            setDocument(null);
            return;
        }
        let current = true;
        setLoading(true);
        void loadRequests(selectedTopicId, 1).then((next) => {
            if (current) setDocument(next);
        }).catch(() => current && setError('The selected message topic could not be loaded.')).finally(() => current && setLoading(false));
        return () => { current = false; };
    }, [selectedTopicId]);

    async function loadRequests(topicId: string, page: number): Promise<LearningSupportRequestPage> {
        const { data, response } = await apiClient.GET('/learning-support/topics/{topic_id}/requests', {
            params: { path: { topic_id: topicId }, query: { page } },
        });
        if (!response.ok || !data) throw new Error('unavailable');
        return data;
    }

    async function changePage(page: number): Promise<void> {
        if (!selectedTopicId) return;
        setLoading(true);
        setError('');
        try {
            setDocument(await loadRequests(selectedTopicId, page));
        } catch {
            setError('The selected message topic could not be loaded.');
        } finally {
            setLoading(false);
        }
    }

    async function saveReply(messageId: string): Promise<void> {
        const body = replyBodies[messageId]?.trim() ?? '';
        if (body.length < 2) {
            setError('Write at least two characters.');
            return;
        }
        setSavingId(messageId);
        setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/learning-support/messages/{message_id}/responses', {
                body: { body },
                params: { header: { 'X-CSRF-Token': token }, path: { message_id: messageId } },
            });
            if (!response.ok || !selectedTopicId || !document) throw new Error('unavailable');
            setReplyBodies((current) => ({ ...current, [messageId]: '' }));
            setDocument(await loadRequests(selectedTopicId, document.pagination.current_page));
        } catch {
            setError('The private reply could not be saved yet.');
        } finally {
            setSavingId(null);
        }
    }

    return (
        <div style={settingsStyle}>
            <OriginalLearnerHeader onSignedOut={onSignedOut} showSettings userEmail={userEmail} />
            <main className="min-h-svh bg-[var(--settings-content-background)] p-4 text-slate-900 dark:text-slate-100 sm:p-6" id="learner-main-content">
                <div className="mx-auto flex min-h-[calc(100svh-6rem)] max-w-[92rem] flex-col">
                    <Link className="mb-4 inline-flex w-fit items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)]" to="/home"><ArrowLeft className="size-4" />Learning desk</Link>
                    <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Learning Support</p>
                    <h1 className="mt-2 text-3xl font-semibold">Learner messages</h1>
                    <section className="mt-5 grid min-h-0 flex-1 gap-4 border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
                        <aside className="border border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-2">
                            <p className="px-3 py-2 text-xs font-semibold tracking-wide text-[var(--settings-muted-text)] uppercase">Message topics</p>
                            <nav aria-label="Message topics" className="grid gap-2">
                                {topics.map((topic) => <button className={`rounded-lg px-3 py-3 text-left text-sm transition ${topic.id === selectedTopicId ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)]'}`} key={topic.id} onClick={() => setSelectedTopicId(topic.id)} type="button"><span className="block font-medium">{topic.map_asset_title} — {topic.title}</span><span className="mt-1 block text-xs opacity-80">{topic.map_title} · {topic.request_count} {topic.request_count === 1 ? 'message' : 'messages'}</span></button>)}
                            </nav>
                        </aside>
                        <section className="min-w-0 overflow-y-auto p-1 sm:p-2">
                            {loading ? <p className="py-8 text-sm text-[var(--settings-muted-text)]">Loading messages...</p> : null}
                            {error ? <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
                            {!loading && !error && document ? <>
                                <header className="border-b border-[var(--settings-border-color)] pb-5"><div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]"><MessageSquareText className="size-5" /><p className="text-xs font-medium tracking-[0.18em] uppercase">Learner messages</p></div><h2 className="text-2xl font-semibold">{document.topic.map_asset_title}</h2><p className="mt-2 text-sm text-[var(--settings-muted-text)]">{document.topic.map_title} · {document.topic.title}</p></header>
                                <div className="mt-4 grid gap-3">{document.requests.map((message) => <article className="border-b border-[var(--settings-border-color)] px-1 py-4 first:pt-0" key={message.id}><p className="font-semibold">{message.author.email}</p><p className="mt-1 text-xs text-[var(--settings-muted-text)]">{new Date(message.created_at).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p><div className="mt-4 grid gap-2 rounded-lg border border-[var(--settings-border-color)] p-3"><label className="text-xs font-semibold tracking-wide text-[var(--settings-muted-text)] uppercase" htmlFor={`support-reply-${message.id}`}>Private reply</label><textarea className="min-h-24 rounded-md border border-[var(--settings-border-color)] bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--settings-accent)]" id={`support-reply-${message.id}`} maxLength={280} onChange={(event) => setReplyBodies((current) => ({ ...current, [message.id]: event.target.value }))} value={replyBodies[message.id] ?? ''} /><button className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={savingId === message.id || (replyBodies[message.id]?.trim().length ?? 0) < 2} onClick={() => void saveReply(message.id)} type="button"><Send className="size-4" />{savingId === message.id ? 'Saving…' : 'Save private reply'}</button></div>{message.responses.length ? <div className="mt-3 grid gap-2">{message.responses.map((reply) => <div className="rounded-md bg-[var(--settings-active-background)] p-3 text-sm" key={reply.id}><p className="text-xs text-[var(--settings-muted-text)]">{reply.author.email}</p><p className="mt-1 whitespace-pre-wrap">{reply.body}</p></div>)}</div> : null}</article>)}</div>
                                {document.pagination.last_page > 1 ? <nav aria-label="Message pages" className="mt-5 flex items-center justify-between text-sm"><button disabled={document.pagination.current_page === 1} onClick={() => void changePage(document.pagination.current_page - 1)} type="button">Previous</button><span>Page {document.pagination.current_page} of {document.pagination.last_page}</span><button disabled={document.pagination.current_page === document.pagination.last_page} onClick={() => void changePage(document.pagination.current_page + 1)} type="button">Next</button></nav> : null}
                            </> : null}
                        </section>
                    </section>
                </div>
            </main>
        </div>
    );
}

const settingsStyle = {
    '--settings-accent': '#0f766e',
    '--settings-active-background': '#ccfbf1',
    '--settings-border-color': '#cbd5e1',
    '--settings-content-background': '#f8fafc',
    '--settings-muted-text': '#475569',
    '--settings-nested-sidebar-background': '#ffffff',
} as React.CSSProperties;
