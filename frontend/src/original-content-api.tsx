import {
    Braces,
    Check,
    Clipboard,
    Send,
    TerminalSquare,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { getCsrfToken } from './api/client';
import { ContentApiSettingsShell } from './extracted-content-api-navigation';
import type { OriginalAppearance } from './original-appearance';

type ContentApiMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST';

type ContentApiOperation = {
    description: string;
    id: string;
    method: ContentApiMethod;
    path: string;
    requestExample: Record<string, unknown> | null;
    responseExample: unknown;
    summary: string;
};

type ContentApiContract = {
    activityTypes: Array<{
        description: string;
        key: string;
        label: string;
    }>;
    aiInstructions: string[];
    authentication: { description: string; type: string };
    basePath: string;
    contentPlan: {
        humanApprovalRequired: boolean;
        purpose: string;
        schema: Record<string, unknown>;
        supportedActivityTypes: string[];
        version: string;
    };
    errors: Record<string, string>;
    name: string;
    operations: ContentApiOperation[];
    version: string;
};

type ConsoleResponse = {
    body: unknown;
    durationMs: number;
    ok: boolean;
    status: number;
};

type Section = 'console' | 'documentation';

/**
 * Source-adapted Content API console. The live Rust contract is the only
 * operation catalogue; this component cannot invent a path or bypass session
 * and CSRF checks.
 */
export function OriginalContentApiPage({ appearance, onSignedOut, settingsAccess }: { appearance: OriginalAppearance; onSignedOut: () => void; settingsAccess: Record<string, boolean> }) {
    const location = useLocation();
    const [contract, setContract] = useState<ContentApiContract | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [section, setSection] = useState<Section>(() => sectionFromSearch(location.search));
    const [selectedId, setSelectedId] = useState('');
    const [path, setPath] = useState('');
    const [body, setBody] = useState('');
    const [response, setResponse] = useState<ConsoleResponse | null>(null);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setSection(sectionFromSearch(location.search));
    }, [location.search]);

    useEffect(() => {
        const controller = new AbortController();

        void loadContract(controller.signal)
            .then((loaded) => {
                setContract(loaded);
                const initial = loaded.operations.find((operation) => operation.id === 'maps.index') ?? loaded.operations[0];
                if (initial) {
                    selectOperation(initial);
                }
            })
            .catch((loadError: unknown) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') {
                    return;
                }
                setError(errorMessage(loadError, 'The Content API contract could not be loaded.'));
            });

        return () => controller.abort();
    }, []);

    const selectedOperation = useMemo(
        () => contract?.operations.find((operation) => operation.id === selectedId),
        [contract, selectedId],
    );

    function selectOperation(operation: ContentApiOperation): void {
        setSelectedId(operation.id);
        setPath(operation.path);
        setBody(operation.requestExample ? JSON.stringify(operation.requestExample, null, 2) : '');
        setRequestError(null);
        setResponse(null);
    }

    async function send(): Promise<void> {
        if (!selectedOperation) {
            return;
        }

        if (!matchesDocumentedPath(path, selectedOperation.path)) {
            setRequestError('The request path must match the selected documented operation.');
            return;
        }

        let requestBody: unknown = null;
        if (hasJsonRequestBody(selectedOperation.method)) {
            try {
                requestBody = body.trim() === '' ? {} : JSON.parse(body);
            } catch {
                setRequestError('The request body is not valid JSON.');
                return;
            }
        }

        setRequestError(null);
        setResponse(null);
        setSending(true);

        try {
            setResponse(await executeContractRequest(selectedOperation.method, path, requestBody));
        } catch (sendError) {
            setRequestError(errorMessage(sendError, 'The request could not be sent.'));
        } finally {
            setSending(false);
        }
    }

    async function copyContract(): Promise<void> {
        if (!contract) {
            return;
        }
        try {
            await navigator.clipboard.writeText(JSON.stringify(contract, null, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setRequestError('The contract could not be copied.');
        }
    }

    return (
        <ContentApiSettingsShell activeSection={section} appearance={appearance} onSignedOut={onSignedOut} settingsAccess={settingsAccess}>
            <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-5" data-wl-id="settings.content-api">
                <header className="mb-5 border-b border-[var(--settings-border-color)] pb-5">
                    <p className="mt-4 text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Administration</p>
                    <h1 className="mt-2 text-3xl font-semibold">Content API</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Interactive, session-scoped access to the versioned authoring contract. The console offers only Rust-advertised operations and does not replace map scope or explicit approval.</p>
                </header>

                {error ? <Message kind="error">{error}</Message> : null}
                {!contract && !error ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950 dark:text-slate-300">Loading the Content API contract…</p> : null}
                {contract && section === 'console' ? (
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950" data-wl-id="settings.content-api.console">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-white/10">
                            <div>
                                <div className="flex items-center gap-2"><TerminalSquare className="size-5 text-[var(--settings-accent)]" /><h2 className="text-xl font-semibold">API Console</h2></div>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Choose a documented operation, replace path parameters and inspect the exact JSON response.</p>
                            </div>
                            <button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={sending || !selectedOperation || path.includes('{')} onClick={() => void send()} type="button"><Send className="size-4" />{sending ? 'Sending…' : 'Send request'}</button>
                        </div>
                        <div className="grid min-h-[34rem] lg:grid-cols-2">
                            <section className="grid auto-rows-max content-start gap-5 border-b border-slate-200 p-5 dark:border-white/10 lg:border-r lg:border-b-0">
                                <Field label="Operation">
                                    <select aria-label="Operation" className={inputClass} onChange={(event) => { const next = contract.operations.find((operation) => operation.id === event.currentTarget.value); if (next) { selectOperation(next); } }} value={selectedId}>
                                        {contract.operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.method} · {operation.summary}</option>)}
                                    </select>
                                </Field>
                                {selectedOperation ? <p className="text-sm leading-6 text-[var(--settings-muted-text)]">{selectedOperation.description}</p> : null}
                                <Field label="Request path">
                                    <div className="flex gap-2"><MethodBadge method={selectedOperation?.method ?? 'GET'} /><input aria-label="Request path" className={`${inputClass} min-w-0 flex-1 font-mono text-xs`} onChange={(event) => setPath(event.currentTarget.value)} value={path} /></div>
                                </Field>
                                {selectedOperation && hasJsonRequestBody(selectedOperation.method) ? <Field label="JSON request body"><textarea aria-label="JSON request body" className="min-h-80 w-full resize-y rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] p-3 font-mono text-xs leading-5 outline-none focus:border-[var(--settings-accent)]" onChange={(event) => setBody(event.currentTarget.value)} spellCheck={false} value={body} /></Field> : null}
                                {path.includes('{') ? <Message kind="warning">Replace every path parameter in braces before sending.</Message> : null}
                                {requestError ? <Message kind="error">{requestError}</Message> : null}
                            </section>
                            <ResponsePane response={response} />
                        </div>
                    </section>
                ) : null}
                {contract && section === 'documentation' ? <Documentation contract={contract} copied={copied} onCopy={() => void copyContract()} /> : null}
            </div>
        </ContentApiSettingsShell>
    );
}

function Documentation({ contract, copied, onCopy }: { contract: ContentApiContract; copied: boolean; onCopy: () => void }) {
    return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950" data-wl-id="settings.content-api.documentation">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Braces className="size-5 text-[var(--settings-accent)]" /><h2 className="text-xl font-semibold">{contract.name} v{contract.version}</h2></div><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">This view and the machine-readable endpoint use the same live source, so examples cannot silently drift apart.</p></div><button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" onClick={onCopy} type="button">{copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}{copied ? 'Copied' : 'Copy AI contract'}</button></header>
        <div className="grid gap-8 pt-6">
            <DocSection title="Access"><p className="max-w-4xl text-sm leading-6 text-[var(--settings-muted-text)]">{contract.authentication.description}</p><code className="w-fit bg-[var(--settings-input-background)] px-2 py-1 font-mono text-xs">{contract.basePath}</code></DocSection>
            <DocSection title="AI authoring rules"><ol className="grid max-w-4xl list-decimal gap-2 pl-5 text-sm leading-6 text-[var(--settings-muted-text)]">{contract.aiInstructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></DocSection>
            <DocSection title={`AI ContentPlan v${contract.contentPlan.version}`}><p className="max-w-4xl text-sm leading-6 text-[var(--settings-muted-text)]">{contract.contentPlan.purpose}</p>{contract.contentPlan.humanApprovalRequired ? <p className="text-sm font-medium text-[var(--settings-accent)]">Explicit administrator approval is required before content is created.</p> : null}<CodeExample label="Structured draft schema" value={contract.contentPlan.schema} /></DocSection>
            <DocSection title="Operations"><div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">{contract.operations.map((operation) => <article className="grid gap-4 py-5" key={operation.id}><div className="flex flex-wrap items-center gap-3"><MethodBadge method={operation.method} /><code className="font-mono text-xs">{operation.path}</code></div><div><h3 className="font-semibold">{operation.summary}</h3><p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--settings-muted-text)]">{operation.description}</p></div><div className="grid gap-4 xl:grid-cols-2">{operation.requestExample ? <CodeExample label="Request example" value={operation.requestExample} /> : null}<CodeExample label="Response example" value={operation.responseExample} /></div></article>)}</div></DocSection>
            <DocSection title="Activity types"><div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">{contract.activityTypes.map((activity) => <div className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)]" key={activity.key}><code className="font-mono text-xs text-[var(--settings-accent)]">{activity.key}</code><div><p className="text-sm font-medium">{activity.label}</p><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">{activity.description}</p></div></div>)}</div></DocSection>
        </div>
    </section>;
}

function ResponsePane({ response }: { response: ConsoleResponse | null }) {
    return <section className="min-h-[24rem] p-5"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Response</h3>{response ? <div className="flex gap-2 text-xs text-[var(--settings-muted-text)]"><span className={response.ok ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-semibold text-red-700 dark:text-red-300'}>HTTP {response.status}</span><span>{response.durationMs} ms</span></div> : null}</div><pre className="min-h-72 overflow-auto border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-slate-800 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">{response ? JSON.stringify(response.body, null, 2) : 'Send a request to inspect its status and JSON body.'}</pre></section>;
}

function MethodBadge({ method }: { method: ContentApiMethod }) {
    const color = method === 'GET'
        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
        : method === 'POST'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : method === 'PATCH'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                : 'bg-red-500/15 text-red-700 dark:text-red-300';

    return <span className={`inline-flex h-10 min-w-16 items-center justify-center rounded-md px-2 font-mono text-xs font-semibold ${color}`}>{method}</span>;
}

function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>; }
function DocSection({ children, title }: { children: ReactNode; title: string }) { return <section className="grid gap-3"><h3 className="text-lg font-semibold">{title}</h3>{children}</section>; }
function CodeExample({ label, value }: { label: string; value: unknown }) { return <div className="min-w-0"><p className="mb-2 text-xs font-medium tracking-wide text-[var(--settings-muted-text)] uppercase">{label}</p><pre className="max-h-80 overflow-auto border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 dark:border-white/10 dark:bg-black/20">{JSON.stringify(value, null, 2)}</pre></div>; }
function Message({ children, kind }: { children: ReactNode; kind: 'error' | 'warning' }) { return <p className={`rounded-md border p-3 text-sm ${kind === 'error' ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200' : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-950/30 dark:text-amber-100'}`}>{children}</p>; }

const inputClass = 'h-10 w-full rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 text-sm outline-none focus:border-[var(--settings-accent)]';

async function loadContract(signal: AbortSignal): Promise<ContentApiContract> {
    const response = await fetch('/api/content/v1/contract', { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal });
    if (!response.ok) { throw new Error(`The Content API contract could not be loaded (HTTP ${response.status}).`); }
    return parseContract((await response.json() as { data?: unknown }).data);
}

async function executeContractRequest(method: ContentApiMethod, path: string, body: unknown): Promise<ConsoleResponse> {
    if (!path.startsWith('/api/content/v1/')) { throw new Error('Only documented Content API v1 paths are allowed.'); }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') { headers['X-CSRF-Token'] = await getCsrfToken(); }
    if (hasJsonRequestBody(method)) { headers['Content-Type'] = 'application/json'; }
    const startedAt = performance.now();
    const response = await fetch(path, { body: hasJsonRequestBody(method) ? JSON.stringify(body) : undefined, credentials: 'same-origin', headers, method });
    const text = await response.text();
    return { body: parseResponseBody(text), durationMs: Math.round(performance.now() - startedAt), ok: response.ok, status: response.status };
}

function parseContract(data: unknown): ContentApiContract {
    if (!isRecord(data) || !Array.isArray(data.operations) || !Array.isArray(data.activityTypes) || !isRecord(data.authentication) || !isRecord(data.contentPlan) || !Array.isArray(data.aiInstructions) || typeof data.name !== 'string' || typeof data.version !== 'string' || typeof data.basePath !== 'string') { throw new Error('The Content API returned an invalid contract.'); }
    const operations = data.operations.map(parseOperation);
    const activityTypes = data.activityTypes.map((activity): ContentApiContract['activityTypes'][number] => { if (!isRecord(activity) || typeof activity.key !== 'string' || typeof activity.label !== 'string' || typeof activity.description !== 'string') { throw new Error('The Content API returned an invalid activity type.'); } return { key: activity.key, label: activity.label, description: activity.description }; });
    if (typeof data.authentication.description !== 'string' || typeof data.authentication.type !== 'string' || typeof data.contentPlan.version !== 'string' || typeof data.contentPlan.purpose !== 'string' || typeof data.contentPlan.humanApprovalRequired !== 'boolean' || !isRecord(data.contentPlan.schema) || !Array.isArray(data.contentPlan.supportedActivityTypes)) { throw new Error('The Content API returned an invalid contract.'); }
    return { activityTypes, aiInstructions: data.aiInstructions.filter((instruction): instruction is string => typeof instruction === 'string'), authentication: { description: data.authentication.description, type: data.authentication.type }, basePath: data.basePath, contentPlan: { humanApprovalRequired: data.contentPlan.humanApprovalRequired, purpose: data.contentPlan.purpose, schema: data.contentPlan.schema, supportedActivityTypes: data.contentPlan.supportedActivityTypes.filter((type): type is string => typeof type === 'string'), version: data.contentPlan.version }, errors: isRecord(data.errors) ? Object.fromEntries(Object.entries(data.errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}, name: data.name, operations, version: data.version };
}

function parseOperation(operation: unknown): ContentApiOperation { if (!isRecord(operation) || typeof operation.id !== 'string' || !isContentApiMethod(operation.method) || typeof operation.path !== 'string' || typeof operation.summary !== 'string' || typeof operation.description !== 'string') { throw new Error('The Content API returned an invalid operation.'); } return { description: operation.description, id: operation.id, method: operation.method, path: operation.path, requestExample: isRecord(operation.requestExample) ? operation.requestExample : null, responseExample: operation.responseExample, summary: operation.summary }; }
function isContentApiMethod(value: unknown): value is ContentApiMethod { return value === 'DELETE' || value === 'GET' || value === 'PATCH' || value === 'POST'; }
function hasJsonRequestBody(method: ContentApiMethod): boolean { return method === 'PATCH' || method === 'POST'; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function parseResponseBody(text: string): unknown { if (text.trim() === '') { return null; } try { return JSON.parse(text) as unknown; } catch { return text; } }
function sectionFromSearch(search: string): Section { return new URLSearchParams(search).get('api') === 'documentation' ? 'documentation' : 'console'; }
function errorMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message !== '' ? error.message : fallback; }
function matchesDocumentedPath(path: string, documentedPath: string): boolean {
    const actualSegments = path.split('/');
    const documentedSegments = documentedPath.split('/');

    return actualSegments.length === documentedSegments.length && documentedSegments.every((segment, index) => {
        const actual = actualSegments[index];
        return /^\{[^}]+\}$/.test(segment) ? actual !== '' : actual === segment;
    });
}
