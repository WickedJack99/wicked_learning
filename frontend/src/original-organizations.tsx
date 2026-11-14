import {
    ArrowLeft,
    ArrowRight,
    Building2,
    Check,
    Crown,
    EyeOff,
    Flag,
    LogOut,
    MessageSquareText,
    Plus,
    Save,
    Search,
    Send,
    Shuffle,
    Trash2,
    Upload,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalLearnerHeader } from './original-learner-header';

type Detail = components['schemas']['OrganizationDetail'];
type Directory = components['schemas']['OrganizationDirectory'];
type Response = components['schemas']['OrganizationResponse'];
type PageProps = { isAuthenticationLoading: boolean; isAuthenticated: boolean; onSignedOut: () => void; userEmail: string };
type Section = 'leader-controls' | 'chat' | 'membership' | 'join-requests' | 'members' | 'report-icon';

const actionButton = 'inline-flex items-center justify-center gap-2 rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10';
const field = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100';

/**
 * Directly adapted from Laravel's organizations index and show pages. The
 * source layout and interactions remain intact; only Inertia navigation and
 * form transports are replaced with the Rust API client.
 */
export function OriginalOrganizationsPage({ slug, ...props }: PageProps & { slug?: string }) {
    return slug ? <OrganizationShow {...props} slug={slug} /> : <OrganizationIndex {...props} />;
}

function OrganizationIndex({ isAuthenticationLoading, isAuthenticated, onSignedOut, userEmail }: PageProps) {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [directory, setDirectory] = useState<Directory | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ description: '', governance_type: 'monarchy' as 'monarchy' | 'anarchy' | 'random', name: '', slogan: '' });
    const search = params.get('search') ?? '';
    const page = positive(params.get('page'));
    const [directorySearch, setDirectorySearch] = useState(search);

    useEffect(() => setDirectorySearch(search), [search]);
    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        void apiClient.GET('/organizations', { params: { query: { ...(page > 1 ? { page } : {}), ...(search ? { search } : {}) } } })
            .then(({ data, response }) => {
                if (!active) return;
                if (response.ok && data) setDirectory(data);
                else setError('Organizations are temporarily unavailable.');
            })
            .catch(() => active && setError('Organizations are temporarily unavailable.'));
        return () => { active = false; };
    }, [isAuthenticated, page, search]);

    if (isAuthenticationLoading) return <PageMessage message="Loading organizations…" />;
    if (!isAuthenticated) return <Navigate replace to="/login" />;

    function visit(nextPage: number, nextSearch = search) {
        const next = new URLSearchParams();
        if (nextSearch) next.set('search', nextSearch);
        if (nextPage > 1) next.set('page', String(nextPage));
        setParams(next, { replace: true });
    }
    async function createOrganization(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setSaving(true); setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/organizations', { body: form, params: { header: { 'X-CSRF-Token': token } } });
            if (!response.ok || !data) throw new Error('create failed');
            navigate(`/organizations/${encodeURIComponent(data.organization.slug)}`);
        } catch { setError('The organization could not be created. Check its name and your organization limit.'); }
        finally { setSaving(false); }
    }

    return <main className="min-h-svh bg-[var(--learner-page-background)] text-[var(--learner-heading-text)]"><OriginalLearnerHeader onSignedOut={onSignedOut} userEmail={userEmail} /><div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 pb-24">
        <AccentHeading action={<button className={actionButton} onClick={() => setIsCreating((open) => !open)} type="button"><Plus className="size-4" />New organization</button>} description="Browse public learner organizations, request to join, or create a space for your own project community." eyebrow="Community" title="Organizations" />
        {isCreating ? (
            <form
                className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#111820]"
                onSubmit={(event) => void createOrganization(event)}
            >
                <div className="flex items-center gap-3">
                    <Users className="size-5 text-[var(--learner-action-accent)]" />
                    <h2 className="text-lg font-semibold">Create organization</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Name">
                        <input
                            className={field}
                            onChange={(event) =>
                                setForm({ ...form, name: event.target.value })
                            }
                            value={form.name}
                        />
                    </Field>
                    <Field label="Slogan">
                        <input
                            className={field}
                            maxLength={180}
                            onChange={(event) =>
                                setForm({ ...form, slogan: event.target.value })
                            }
                            value={form.slogan}
                        />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea
                        className={`${field} min-h-28`}
                        onChange={(event) =>
                            setForm({ ...form, description: event.target.value })
                        }
                        value={form.description}
                    />
                </Field>
                <fieldset className="grid gap-2">
                    <legend className="text-sm font-medium">Organization type</legend>
                    <div className="grid gap-3 md:grid-cols-3">
                        {governanceOptions.map((option) => {
                            const Icon = option.icon;
                            const selected = form.governance_type === option.value;

                            return (
                                <label
                                    className={[
                                        'grid cursor-pointer gap-2 rounded-lg border p-3 text-sm transition',
                                        selected
                                            ? 'border-[var(--learner-action-accent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_12%,transparent)]'
                                            : 'border-slate-200 bg-slate-50 hover:border-[color-mix(in_srgb,var(--learner-action-accent)_42%,transparent)] dark:border-white/10 dark:bg-white/5',
                                    ].join(' ')}
                                    key={option.value}
                                >
                                    <input
                                        checked={selected}
                                        className="sr-only"
                                        name="governance_type"
                                        onChange={() =>
                                            setForm({
                                                ...form,
                                                governance_type: option.value,
                                            })
                                        }
                                        type="radio"
                                    />
                                    <span className="flex items-center gap-2 font-semibold">
                                        <Icon className="size-4 text-[var(--learner-action-accent)]" />
                                        {option.label}
                                    </span>
                                    <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        {option.description}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>
                <div className="flex gap-2">
                    <button
                        className={actionButton}
                        disabled={saving}
                        type="submit"
                    >
                        <Save className="size-4" />
                        Create
                    </button>
                    <button
                        className={secondaryButton}
                        onClick={() => setIsCreating(false)}
                        type="button"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        ) : null}
        <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111820]" onSubmit={(event) => { event.preventDefault(); visit(1, directorySearch.trim()); }}><div className="min-w-0 flex-1"><label className="mb-2 block text-sm font-medium" htmlFor="organization-directory-search">Find an organization</label><input className={field} id="organization-directory-search" onChange={(event) => setDirectorySearch(event.target.value)} placeholder="Search names, slogans, or descriptions" type="search" value={directorySearch} /></div><button className={actionButton} type="submit"><Search className="size-4" />Search</button>{search ? <button className={secondaryButton} onClick={() => { setDirectorySearch(''); visit(1, ''); }} type="button">Clear</button> : null}</form>
        <section className="grid gap-3">{directory?.organizations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-[#111820] dark:text-slate-400">{search ? 'No organizations match that search.' : 'No organizations exist yet.'}</p> : null}{directory?.organizations.map((organization) => <article className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[5rem_minmax(0,1fr)_max-content] md:items-center dark:border-white/10 dark:bg-[#111820]" key={organization.id}><OrganizationIcon iconUrl={organization.icon_url} name={organization.name} /><div className="min-w-0"><h2 className="text-lg font-semibold">{organization.name}</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{organization.slogan || 'No slogan yet.'}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{organization.member_count} members · {governanceLabel(organization.governance_type)}</p></div><button className={actionButton} onClick={() => navigate(`/organizations/${encodeURIComponent(organization.slug)}`)} type="button">View <ArrowRight className="size-4" /></button></article>)}{directory ? <Pagination pagination={directory.pagination} onPageChange={(next) => visit(next)} /> : null}</section>
        {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
    </div></main>;
}

function OrganizationShow({ isAuthenticationLoading, isAuthenticated, onSignedOut, slug, userEmail }: PageProps & { slug: string }) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [organization, setOrganization] = useState<Detail | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [section, setSection] = useState<Section>('membership');
    const [joinMessage, setJoinMessage] = useState('');
    const [chatBody, setChatBody] = useState('');
    const [reportReason, setReportReason] = useState('');
    const [editForm, setEditForm] = useState({ description: '', name: '', slogan: '' });
    const membersPage = positive(params.get('members_page'));
    const messagesPage = positive(params.get('messages_page'));
    const joinRequestsPage = positive(params.get('join_requests_page'));
    const requestedSection = params.get('section');
    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        void apiClient.GET('/organizations/{slug}', { params: { path: { slug }, query: { ...(membersPage > 1 ? { members_page: membersPage } : {}), ...(messagesPage > 1 ? { messages_page: messagesPage } : {}), ...(joinRequestsPage > 1 ? { join_requests_page: joinRequestsPage } : {}) } } }).then(({ data, response }) => {
            if (!active) return;
            if (!response.ok || !data) { setError('This organization is not available.'); return; }
            setOrganization(data.organization);
            setEditForm({ description: data.organization.description ?? '', name: data.organization.name, slogan: data.organization.slogan ?? '' });
            setSection(sectionFromQuery(requestedSection, data.organization));
        }).catch(() => active && setError('This organization is temporarily unavailable.'));
        return () => { active = false; };
    }, [isAuthenticated, joinRequestsPage, membersPage, messagesPage, requestedSection, slug]);
    if (isAuthenticationLoading) return <PageMessage message="Loading organization…" />;
    if (!isAuthenticated) return <Navigate replace to="/login" />;
    if (!organization) return <PageMessage message={error || 'Loading organization…'} />;
    const isMember = Boolean(organization.viewer_membership);
    const canViewChat = isMember || organization.can_moderate_messages;
    const canLeave = !(organization.is_leader && organization.leader_count <= 1) || (organization.governance_type === 'random' && organization.member_count > 1);
    const sections: { key: Section; label: string; show: boolean }[] = [{ key: 'leader-controls', label: 'Leader controls', show: organization.is_leader }, { key: 'chat', label: 'Chat', show: canViewChat }, { key: 'membership', label: 'Membership', show: true }, { key: 'join-requests', label: `Join requests (${organization.pending_join_requests_pagination?.total ?? 0})`, show: organization.is_leader }, { key: 'members', label: `Members (${organization.member_count})`, show: true }, { key: 'report-icon', label: 'Report icon', show: Boolean(organization.icon_url) && !organization.is_leader }];
    async function command(execute: (token: string) => Promise<{ data?: Response; response: globalThis.Response }>): Promise<boolean> { if (saving) return false; setSaving(true); setError(''); try { const result = await execute(await getCsrfToken()); if (!result.response.ok || !result.data) throw new Error('command failed'); setOrganization(result.data.organization); return true; } catch { setError('This organization action could not be completed. Please try again.'); return false; } finally { setSaving(false); } }
    async function deleteOrganization() {
        if (!window.confirm(`Delete ${organization?.name ?? 'this organization'}?`) || saving) return;
        setSaving(true); setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE('/organizations/{slug}', { params: { header: { 'X-CSRF-Token': token }, path: { slug } } });
            if (!response.ok) throw new Error('delete failed');
            navigate('/organizations');
        } catch { setError('This organization could not be deleted. Please try again.'); }
        finally { setSaving(false); }
    }
    async function uploadIcon(file: File) {
        if (uploading) return;
        setUploading(true); setError('');
        try {
            const token = await getCsrfToken();
            const body = new FormData(); body.set('file', file);
            const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/icon`, { body, credentials: 'same-origin', headers: { 'X-CSRF-Token': token }, method: 'POST' });
            const data = response.ok ? await response.json() as { url: string } : null;
            if (!data?.url) throw new Error('upload failed');
            setOrganization((current) => current ? { ...current, icon_url: data.url } : current);
        } catch { setError('The organization icon could not be uploaded. Choose a supported image no larger than 5 MB.'); }
        finally { setUploading(false); }
    }
    async function reportIcon(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setSaving(true); setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/organizations/{slug}/icon-reports', { body: { reason: reportReason || null }, params: { header: { 'X-CSRF-Token': token }, path: { slug } } });
            if (!response.ok) throw new Error('report failed');
            setReportReason('');
        } catch { setError('The icon report could not be sent. Please try again.'); }
        finally { setSaving(false); }
    }

    return <main className="flex min-h-svh flex-col bg-[var(--learner-page-background)] text-[var(--learner-heading-text)]"><OriginalLearnerHeader onSignedOut={onSignedOut} userEmail={userEmail} /><main className="min-h-0 flex-1 px-4 pt-5 pb-5" id="learner-main-content" tabIndex={-1}><div className="mx-auto flex w-full max-w-[92rem] flex-col"><div className="shrink-0 pb-5"><button className={secondaryButton} onClick={() => navigate('/organizations')} type="button"><ArrowLeft className="size-4" />Organizations</button></div><section className="grid flex-1 gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl lg:grid-cols-[16rem_minmax(0,1fr)] dark:border-white/10 dark:bg-[#111820]"><aside className="grid content-start gap-1 border-b border-slate-200 pb-4 dark:border-white/10 lg:border-r lg:border-b-0 lg:pr-4">{sections.filter((item) => item.show).map((item) => <button className={`rounded-md px-3 py-2 text-left text-sm ${section === item.key ? 'bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] text-[var(--learner-action-accent)]' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`} key={item.key} onClick={() => setSection(item.key)} type="button">{item.label}</button>)}</aside><div className="grid min-w-0 content-start gap-5"><OrganizationSummary organization={organization} />
        {section === 'leader-controls' && organization.is_leader ? <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]"><h2 className="text-lg font-semibold">Leader controls</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Edit details, upload an icon, or delete this organization.</p><form className="mt-5 grid gap-4" onSubmit={(event) => { event.preventDefault(); void command((token) => apiClient.PATCH('/organizations/{slug}', { body: editForm, params: { header: { 'X-CSRF-Token': token }, path: { slug } } })); }}><div className="grid gap-4 md:grid-cols-2"><Field label="Name"><input className={field} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} value={editForm.name} /></Field><Field label="Slogan"><input className={field} maxLength={180} onChange={(event) => setEditForm({ ...editForm, slogan: event.target.value })} value={editForm.slogan} /></Field></div><Field label="Description"><textarea className={`${field} min-h-28`} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} value={editForm.description} /></Field><div className="flex flex-wrap gap-2"><button className={actionButton} disabled={saving} type="submit"><Save className="size-4" />Save</button><label className={secondaryButton}><Upload className="size-4" />{uploading ? 'Uploading…' : 'Upload icon'}<input accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadIcon(file); event.currentTarget.value = ''; }} type="file" /></label><button className={secondaryButton} disabled={saving || uploading} onClick={() => void deleteOrganization()} type="button"><Trash2 className="size-4" />Delete organization</button></div></form></section> : null}
        {section === 'membership' ? <MembershipPanel canLeave={canLeave} isMember={isMember} joinMessage={joinMessage} joinStatus={organization.viewer_join_request?.status ?? null} onJoinMessageChange={setJoinMessage} onLeave={() => void command((token) => apiClient.DELETE('/organizations/{slug}/membership', { params: { header: { 'X-CSRF-Token': token }, path: { slug } } }))} onRequestJoin={() => void command((token) => apiClient.POST('/organizations/{slug}/join-requests', { body: { message: joinMessage }, params: { header: { 'X-CSRF-Token': token }, path: { slug } } })).then((completed) => { if (completed) setJoinMessage(''); })} saving={saving} /> : null}
        {section === 'chat' && canViewChat ? <ChatPanel canSend={organization.can_send_messages} messages={organization.messages} onBodyChange={setChatBody} onDelete={(id) => void command((token) => apiClient.DELETE('/organization-messages/{message_id}', { params: { header: { 'X-CSRF-Token': token }, path: { message_id: id } } }))} onHide={(id) => void command((token) => apiClient.PATCH('/organization-messages/{message_id}/hide', { params: { header: { 'X-CSRF-Token': token }, path: { message_id: id } } }))} onSend={() => void command((token) => apiClient.POST('/organizations/{slug}/messages', { body: { body: chatBody }, params: { header: { 'X-CSRF-Token': token }, path: { slug } } })).then((completed) => { if (completed) setChatBody(''); })} saving={saving} value={chatBody} /> : null}
        {section === 'join-requests' && organization.is_leader ? <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]"><h2 className="text-lg font-semibold">Join requests</h2>{organization.pending_join_requests.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No pending requests.</p> : null}{organization.pending_join_requests.map((request) => <article className="rounded-lg border border-slate-200 p-3 dark:border-white/10" key={request.id}><p className="font-medium">{request.requester.name}</p>{request.message ? <p className="mt-2 text-sm leading-6">{request.message}</p> : null}<div className="mt-3 flex gap-2"><button className={actionButton} disabled={saving} onClick={() => void command((token) => apiClient.PATCH('/organization-join-requests/{request_id}', { body: { approved: true }, params: { header: { 'X-CSRF-Token': token }, path: { request_id: request.id } } }))} type="button"><Check className="size-4" />Approve</button><button className={secondaryButton} disabled={saving} onClick={() => void command((token) => apiClient.PATCH('/organization-join-requests/{request_id}', { body: { approved: false }, params: { header: { 'X-CSRF-Token': token }, path: { request_id: request.id } } }))} type="button"><X className="size-4" />Decline</button></div></article>)}</section> : null}
        {section === 'members' ? <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]"><h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5" />Members</h2>{organization.members.map((member) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10" key={member.id}><div><p className="font-medium">{member.user.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{member.role === 'leader' ? 'Leader' : 'Member'}</p></div>{organization.is_leader && member.id !== organization.viewer_membership?.id ? <div className="flex gap-2">{organization.governance_type === 'monarchy' && member.role !== 'leader' ? <button className={secondaryButton} disabled={saving} onClick={() => void command((token) => apiClient.PATCH('/organization-memberships/{membership_id}/leader', { params: { header: { 'X-CSRF-Token': token }, path: { membership_id: member.id } } }))} type="button">Promote</button> : null}<button className={secondaryButton} disabled={saving} onClick={() => void command((token) => apiClient.DELETE('/organization-memberships/{membership_id}', { params: { header: { 'X-CSRF-Token': token }, path: { membership_id: member.id } } }))} type="button">Remove</button></div> : null}</article>)}</section> : null}
        {section === 'report-icon' && organization.icon_url && !organization.is_leader ? <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5" onSubmit={(event) => void reportIcon(event)}><h2 className="flex items-center gap-2 text-sm font-semibold"><Flag className="size-4 text-red-500" />Report organization icon</h2><textarea className={`${field} min-h-20`} maxLength={1000} onChange={(event) => setReportReason(event.target.value)} placeholder="Why should admins review this icon?" value={reportReason} /><button className={secondaryButton} disabled={saving} type="submit"><Flag className="size-4" />Report icon</button></form> : null}
        {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}</div></section></div></main></main>;
}

function MembershipPanel({ canLeave, isMember, joinMessage, joinStatus, onJoinMessageChange, onLeave, onRequestJoin, saving }: { canLeave: boolean; isMember: boolean; joinMessage: string; joinStatus: string | null; onJoinMessageChange: (value: string) => void; onLeave: () => void; onRequestJoin: () => void; saving: boolean }) { return <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]"><h2 className="text-lg font-semibold">{isMember ? 'Membership' : 'Request to enter'}</h2>{isMember ? <><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">You are a member of this organization.</p>{canLeave ? <button className={`${secondaryButton} mt-4`} disabled={saving} onClick={onLeave} type="button"><LogOut className="size-4" />Leave organization</button> : <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">You are the last leader. Leaving is not available for this organization.</p>}</> : joinStatus === 'pending' ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Your request is pending.</p> : <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); onRequestJoin(); }}><textarea className={`${field} min-h-24`} onChange={(event) => onJoinMessageChange(event.target.value)} placeholder="Optional message to the leaders" value={joinMessage} /><div><button className={actionButton} disabled={saving} type="submit"><UserPlus className="size-4" />Request to enter</button></div></form>}</section>; }
function ChatPanel({ canSend, messages, onBodyChange, onDelete, onHide, onSend, saving, value }: { canSend: boolean; messages: components['schemas']['OrganizationMessage'][]; onBodyChange: (value: string) => void; onDelete: (id: string) => void; onHide: (id: string) => void; onSend: () => void; saving: boolean; value: string }) { return <section className="grid min-h-0 gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]"><h2 className="flex items-center gap-2 text-lg font-semibold"><MessageSquareText className="size-5" />Organization chat</h2><div aria-label="Organization chat messages" className="grid content-start gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">{messages.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No messages yet.</p> : null}{messages.map((message) => <article className={message.hidden_at ? 'rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-slate-700 dark:border-amber-300/40 dark:bg-amber-400/10 dark:text-slate-200' : 'rounded-lg bg-slate-100 p-3 text-sm dark:bg-white/10'} key={message.id}><div className="flex flex-wrap items-baseline justify-between gap-2"><div className="flex items-baseline gap-2"><p className="font-medium">{message.user.name}</p>{message.hidden_at ? <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950">Hidden</span> : null}</div><div className="flex items-center gap-1"><time className="text-xs text-slate-500 dark:text-slate-400">{formatDate(message.created_at)}</time>{message.can_hide ? <button aria-label="Hide message from users" className="p-1" disabled={saving} onClick={() => onHide(message.id)} type="button"><EyeOff className="size-4" /></button> : null}{message.can_delete ? <button className="p-1 text-red-600" disabled={saving} onClick={() => onDelete(message.id)} type="button">Delete</button> : null}</div></div><p className="mt-2 whitespace-pre-wrap leading-6">{message.body}</p></article>)}</div>{canSend ? <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onSend(); }}><input aria-label="Message the organization" className={field} onChange={(event) => onBodyChange(event.target.value)} placeholder="Message the organization" value={value} /><button aria-label="Send message" className={actionButton} disabled={saving || !value.trim()} type="submit"><Send className="size-4" /></button></form> : null}</section>; }
function AccentHeading({ action, description, eyebrow, title }: { action: ReactNode; description: string; eyebrow: string; title: string }) { return <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-action-accent)] uppercase">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1>{description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}</div>{action}</header>; }
function OrganizationSummary({ organization }: { organization: Detail }) { return <header className="grid gap-5 border-b border-slate-200 pb-5 md:grid-cols-[6rem_minmax(0,1fr)] dark:border-white/10"><OrganizationIcon iconUrl={organization.icon_url} name={organization.name} /><div className="min-w-0"><AccentHeading action={null} description="" eyebrow="Organization" title={organization.name} /><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{organization.member_count} members - {governanceLabel(organization.governance_type)}</p>{organization.governance_type === 'random' && organization.leadership_rotated_at ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current leader assigned {formatDate(organization.leadership_rotated_at)}</p> : null}<h2 className="mt-5 text-xl font-semibold">{organization.slogan || 'No slogan yet.'}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{organization.description || 'No description has been added yet.'}</p></div></header>; }
function OrganizationIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) { return <div aria-label={`${name} icon`} className="grid size-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">{iconUrl ? <img alt={`${name} icon`} className="size-full object-cover" draggable={false} src={iconUrl} /> : <span className="grid size-full place-items-center"><Building2 className="size-7" /></span>}</div>; }
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span>{children}</label>; }
function Pagination({ onPageChange, pagination }: { onPageChange: (page: number) => void; pagination: components['schemas']['OrganizationPagination'] }) { if (pagination.last_page <= 1) return null; return <nav aria-label="Organizations" className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-white/10"><button className={secondaryButton} disabled={pagination.current_page <= 1} onClick={() => onPageChange(pagination.current_page - 1)} type="button">Previous</button><span className="text-xs text-slate-500 dark:text-slate-400">Page {pagination.current_page} of {pagination.last_page}</span><button className={secondaryButton} disabled={pagination.current_page >= pagination.last_page} onClick={() => onPageChange(pagination.current_page + 1)} type="button">Next</button></nav>; }
function PageMessage({ message }: { message: string }) { return <main className="grid min-h-svh place-items-center bg-[var(--learner-page-background)] p-6 text-sm text-[var(--learner-muted-text)]">{message}</main>; }
function positive(value: string | null): number { const parsed = Number.parseInt(value ?? '1', 10); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1; }
function sectionFromQuery(requested: string | null, organization: Detail): Section {
    const canViewChat = Boolean(organization.viewer_membership) || organization.can_moderate_messages;
    const defaultSection: Section = organization.is_leader
        ? 'leader-controls'
        : canViewChat
          ? 'chat'
          : 'membership';
    const available = new Set<Section>([
        'membership',
        'members',
        ...(organization.is_leader ? ['leader-controls', 'join-requests'] as Section[] : []),
        ...(canViewChat ? ['chat'] as Section[] : []),
        ...(organization.icon_url && !organization.is_leader ? ['report-icon'] as Section[] : []),
    ]);

    return requested !== null && available.has(requested as Section)
        ? requested as Section
        : defaultSection;
}
function governanceLabel(value: string): string { return value === 'anarchy' ? 'Anarchy' : value === 'random' ? 'Random monthly leader' : 'Monarchy'; }
function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
const governanceOptions = [{ description: 'Leaders stay in place until changed manually.', icon: Crown, label: 'Monarchy', value: 'monarchy' as const }, { description: 'Every accepted member is a leader.', icon: Users, label: 'Anarchy', value: 'anarchy' as const }, { description: 'One random member becomes leader each month.', icon: Shuffle, label: 'Random', value: 'random' as const }];
