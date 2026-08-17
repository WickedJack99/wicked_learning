import {
    BookOpenText,
    Braces,
    Check,
    Clipboard,
    Send,
    TerminalSquare,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    SettingsNestedWorkspace,
    SettingsPanelHeader,
    SettingsSectionNavigation,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { executeContentApiRequest } from '@/features/content-api/content-api-client';
import type {
    ContentApiConsoleResponse,
    ContentApiMethod,
} from '@/features/content-api/content-api-client';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export type ContentApiSection = 'console' | 'documentation';

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
    authentication: {
        description: string;
        type: string;
    };
    basePath: string;
    contentPlan: {
        humanApprovalRequired: boolean;
        placementDefaults: {
            positionX: number;
            positionY: number;
            width: number;
        };
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

type ContractResponse = { data: ContentApiContract };

export function ContentApiPanel() {
    const t = usePlatformTranslation();
    const [section, setSection] = useState<ContentApiSection>(() =>
        readSectionFromUrl(),
    );
    const [contract, setContract] = useState<ContentApiContract | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedOperationId, setSelectedOperationId] = useState('');
    const [path, setPath] = useState('');
    const [requestBody, setRequestBody] = useState('');
    const [response, setResponse] = useState<ContentApiConsoleResponse | null>(
        null,
    );
    const [requestError, setRequestError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [copied, setCopied] = useState(false);
    const sections = useMemo(
        () =>
            [
                {
                    description: t(
                        'settings.api.console.description',
                        'Build and send requests against documented authoring operations.',
                    ),
                    icon: TerminalSquare,
                    key: 'console',
                    label: t('settings.api.console.title', 'API Console'),
                },
                {
                    description: t(
                        'settings.api.documentation.description',
                        'Read the versioned contract used by administrators and AI tools.',
                    ),
                    icon: BookOpenText,
                    key: 'documentation',
                    label: t(
                        'settings.api.documentation.title',
                        'API Documentation',
                    ),
                },
            ] satisfies SettingsNavigationItem<ContentApiSection>[],
        [t],
    );

    useEffect(() => {
        const controller = new AbortController();

        void fetch('/api/content/v1/contract', {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal: controller.signal,
        })
            .then(async (result) => {
                if (!result.ok) {
                    throw new Error(`HTTP ${result.status}`);
                }

                return result.json() as Promise<ContractResponse>;
            })
            .then(({ data }) => {
                setContract(data);
                const initialOperation =
                    data.operations.find(
                        (operation) => operation.id === 'maps.index',
                    ) ?? data.operations[0];

                if (initialOperation) {
                    selectOperation(initialOperation);
                }
            })
            .catch((error: unknown) => {
                if (
                    error instanceof DOMException &&
                    error.name === 'AbortError'
                ) {
                    return;
                }

                setLoadError(
                    t(
                        'settings.api.load_error',
                        'The Content API contract could not be loaded.',
                    ),
                );
            });

        return () => controller.abort();
    }, [t]);

    const selectedOperation = contract?.operations.find(
        (operation) => operation.id === selectedOperationId,
    );
    const activeSection =
        sections.find((item) => item.key === section) ?? sections[0];

    function changeSection(nextSection: ContentApiSection) {
        setSection(nextSection);
        const url = new URL(window.location.href);
        url.searchParams.set('panel', 'admin-api');
        url.searchParams.set('api', nextSection);
        window.history.pushState({ panel: 'admin-api' }, '', url);
    }

    function selectOperation(operation: ContentApiOperation) {
        setSelectedOperationId(operation.id);
        setPath(operation.path);
        setRequestBody(
            operation.requestExample
                ? JSON.stringify(operation.requestExample, null, 2)
                : '',
        );
        setRequestError(null);
        setResponse(null);
    }

    async function sendRequest() {
        if (!selectedOperation) {
            return;
        }

        setRequestError(null);
        setResponse(null);
        let body: unknown = null;

        if (selectedOperation.method !== 'GET') {
            try {
                body = requestBody.trim() === '' ? {} : JSON.parse(requestBody);
            } catch {
                setRequestError(
                    t(
                        'settings.api.console.invalid_json',
                        'The request body is not valid JSON.',
                    ),
                );

                return;
            }
        }

        setIsSending(true);

        try {
            setResponse(
                await executeContentApiRequest(
                    selectedOperation.method,
                    path,
                    body,
                ),
            );
        } catch (error) {
            setRequestError(
                error instanceof Error
                    ? error.message
                    : t(
                          'settings.api.console.request_failed',
                          'The request could not be sent.',
                      ),
            );
        } finally {
            setIsSending(false);
        }
    }

    async function copyContract() {
        if (!contract) {
            return;
        }

        await navigator.clipboard.writeText(JSON.stringify(contract, null, 2));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    return (
        <SettingsNestedWorkspace
            contentClassName="p-0 sm:p-0"
            footerAction={
                section === 'console' ? (
                    <Button
                        disabled={
                            isSending ||
                            !selectedOperation ||
                            path.includes('{')
                        }
                        onClick={() => void sendRequest()}
                        type="button"
                    >
                        <Send className="size-4" />
                        {isSending
                            ? t('settings.api.console.sending', 'Sending…')
                            : t('settings.api.console.send', 'Send request')}
                    </Button>
                ) : undefined
            }
            sidebar={
                <SettingsSectionNavigation
                    activeSection={activeSection.key}
                    ariaLabel={t(
                        'settings.api.navigation_label',
                        'Content API sections',
                    )}
                    items={sections}
                    onChange={changeSection}
                />
            }
        >
            {loadError ? <LoadError message={loadError} /> : null}
            {!contract && !loadError ? (
                <LoadingState
                    label={t(
                        'settings.api.loading',
                        'Loading the Content API contract…',
                    )}
                />
            ) : null}
            {contract && section === 'console' ? (
                <ConsoleWorkspace
                    contract={contract}
                    onOperationChange={(operationId) => {
                        const operation = contract.operations.find(
                            (candidate) => candidate.id === operationId,
                        );

                        if (operation) {
                            selectOperation(operation);
                        }
                    }}
                    path={path}
                    requestBody={requestBody}
                    requestError={requestError}
                    response={response}
                    selectedOperation={selectedOperation}
                    selectedOperationId={selectedOperationId}
                    setPath={setPath}
                    setRequestBody={setRequestBody}
                />
            ) : null}
            {contract && section === 'documentation' ? (
                <DocumentationWorkspace
                    contract={contract}
                    copied={copied}
                    onCopy={() => void copyContract()}
                />
            ) : null}
        </SettingsNestedWorkspace>
    );
}

function ConsoleWorkspace({
    contract,
    onOperationChange,
    path,
    requestBody,
    requestError,
    response,
    selectedOperation,
    selectedOperationId,
    setPath,
    setRequestBody,
}: {
    contract: ContentApiContract;
    onOperationChange: (operationId: string) => void;
    path: string;
    requestBody: string;
    requestError: string | null;
    response: ContentApiConsoleResponse | null;
    selectedOperation: ContentApiOperation | undefined;
    selectedOperationId: string;
    setPath: (path: string) => void;
    setRequestBody: (body: string) => void;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
                <SettingsPanelHeader
                    description={t(
                        'settings.api.console.header_description',
                        'Choose a documented operation, replace path parameters and inspect the exact JSON response.',
                    )}
                    icon={TerminalSquare}
                    title={t('settings.api.console.title', 'API Console')}
                />
            </div>
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2">
                <section className="grid auto-rows-max gap-5 border-b border-[var(--settings-border-color)] p-4 sm:p-5 lg:border-r lg:border-b-0">
                    <Field
                        label={t('settings.api.console.operation', 'Operation')}
                    >
                        <select
                            className="h-10 w-full rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 text-sm text-slate-950 outline-none focus:border-[var(--settings-accent)] dark:text-white"
                            onChange={(event) =>
                                onOperationChange(event.target.value)
                            }
                            value={selectedOperationId}
                        >
                            {contract.operations.map((operation) => (
                                <option key={operation.id} value={operation.id}>
                                    {operation.method} · {operation.summary}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {selectedOperation ? (
                        <p className="text-sm leading-6 text-[var(--settings-muted-text)]">
                            {selectedOperation.description}
                        </p>
                    ) : null}
                    <Field
                        label={t('settings.api.console.path', 'Request path')}
                    >
                        <div className="flex gap-2">
                            <MethodBadge
                                method={selectedOperation?.method ?? 'GET'}
                            />
                            <Input
                                className="font-mono text-xs"
                                onChange={(event) =>
                                    setPath(event.target.value)
                                }
                                value={path}
                            />
                        </div>
                    </Field>
                    {selectedOperation?.method !== 'GET' ? (
                        <Field
                            label={t(
                                'settings.api.console.request_body',
                                'JSON request body',
                            )}
                        >
                            <textarea
                                className="min-h-80 w-full resize-y rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] p-3 font-mono text-xs leading-5 text-slate-950 outline-none focus:border-[var(--settings-accent)] dark:text-white"
                                onChange={(event) =>
                                    setRequestBody(event.target.value)
                                }
                                spellCheck={false}
                                value={requestBody}
                            />
                        </Field>
                    ) : null}
                    {path.includes('{') ? (
                        <p className="text-sm text-amber-600 dark:text-amber-300">
                            {t(
                                'settings.api.console.replace_path_parameters',
                                'Replace every path parameter in braces before sending.',
                            )}
                        </p>
                    ) : null}
                    {requestError ? (
                        <p className="text-sm text-red-600 dark:text-red-300">
                            {requestError}
                        </p>
                    ) : null}
                </section>
                <ResponsePane response={response} />
            </div>
        </div>
    );
}

function ResponsePane({
    response,
}: {
    response: ContentApiConsoleResponse | null;
}) {
    const t = usePlatformTranslation();

    return (
        <section className="min-h-[24rem] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    {t('settings.api.console.response', 'Response')}
                </h3>
                {response ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--settings-muted-text)]">
                        <span
                            className={cn(
                                'font-semibold',
                                response.ok
                                    ? 'text-emerald-600 dark:text-emerald-300'
                                    : 'text-red-600 dark:text-red-300',
                            )}
                        >
                            HTTP {response.status}
                        </span>
                        <span>{response.durationMs} ms</span>
                    </div>
                ) : null}
            </div>
            <pre className="min-h-72 overflow-auto border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                {response
                    ? JSON.stringify(response.body, null, 2)
                    : t(
                          'settings.api.console.empty_response',
                          'Send a request to inspect its status and JSON body.',
                      )}
            </pre>
        </section>
    );
}

function DocumentationWorkspace({
    contract,
    copied,
    onCopy,
}: {
    contract: ContentApiContract;
    copied: boolean;
    onCopy: () => void;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-5">
            <SettingsPanelHeader
                action={
                    <Button onClick={onCopy} type="button" variant="secondary">
                        {copied ? (
                            <Check className="size-4" />
                        ) : (
                            <Clipboard className="size-4" />
                        )}
                        {copied
                            ? t('settings.api.documentation.copied', 'Copied')
                            : t(
                                  'settings.api.documentation.copy_contract',
                                  'Copy AI contract',
                              )}
                    </Button>
                }
                description={t(
                    'settings.api.documentation.header_description',
                    'This page and the machine-readable endpoint use the same source, so examples cannot silently drift apart.',
                )}
                icon={Braces}
                title={`${contract.name} v${contract.version}`}
            />

            <div className="grid gap-8 pt-6">
                <section className="grid gap-3">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                        {t('settings.api.documentation.access', 'Access')}
                    </h3>
                    <p className="max-w-4xl text-sm leading-6 text-[var(--settings-muted-text)]">
                        {contract.authentication.description}
                    </p>
                    <code className="w-fit bg-[var(--settings-input-background)] px-2 py-1 font-mono text-xs">
                        {contract.basePath}
                    </code>
                </section>

                <section className="grid gap-3">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                        {t(
                            'settings.api.documentation.ai_rules',
                            'AI authoring rules',
                        )}
                    </h3>
                    <ol className="grid max-w-4xl list-decimal gap-2 pl-5 text-sm leading-6 text-[var(--settings-muted-text)]">
                        {contract.aiInstructions.map((instruction) => (
                            <li key={instruction}>{instruction}</li>
                        ))}
                    </ol>
                </section>

                <section className="grid gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                            {t(
                                'settings.api.documentation.content_plan',
                                'AI ContentPlan',
                            )}{' '}
                            v{contract.contentPlan.version}
                        </h3>
                        <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--settings-muted-text)]">
                            {contract.contentPlan.purpose}
                        </p>
                    </div>
                    <p className="text-sm font-medium text-[var(--settings-accent)]">
                        {contract.contentPlan.humanApprovalRequired
                            ? t(
                                  'settings.api.documentation.approval_required',
                                  'Explicit administrator approval is required before content is created.',
                              )
                            : null}
                    </p>
                    <CodeExample
                        label={t(
                            'settings.api.documentation.content_plan_schema',
                            'Structured draft schema',
                        )}
                        value={contract.contentPlan.schema}
                    />
                </section>

                <section className="grid gap-4">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                        {t(
                            'settings.api.documentation.operations',
                            'Operations',
                        )}
                    </h3>
                    <div className="divide-y divide-[var(--settings-border-color)] border-y border-[var(--settings-border-color)]">
                        {contract.operations.map((operation) => (
                            <OperationDocumentation
                                key={operation.id}
                                operation={operation}
                            />
                        ))}
                    </div>
                </section>

                <section className="grid gap-3">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                        {t(
                            'settings.api.documentation.activity_types',
                            'Activity types',
                        )}
                    </h3>
                    <div className="divide-y divide-[var(--settings-border-color)] border-y border-[var(--settings-border-color)]">
                        {contract.activityTypes.map((activityType) => (
                            <div
                                className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)]"
                                key={activityType.key}
                            >
                                <code className="font-mono text-xs text-[var(--settings-accent)]">
                                    {activityType.key}
                                </code>
                                <div>
                                    <p className="text-sm font-medium text-slate-950 dark:text-white">
                                        {activityType.label}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">
                                        {activityType.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

function OperationDocumentation({
    operation,
}: {
    operation: ContentApiOperation;
}) {
    const t = usePlatformTranslation();

    return (
        <article className="grid gap-4 py-5">
            <div className="flex flex-wrap items-center gap-3">
                <MethodBadge method={operation.method} />
                <code className="font-mono text-xs text-slate-800 dark:text-slate-200">
                    {operation.path}
                </code>
            </div>
            <div>
                <h4 className="font-semibold text-slate-950 dark:text-white">
                    {operation.summary}
                </h4>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {operation.description}
                </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
                {operation.requestExample ? (
                    <CodeExample
                        label={t(
                            'settings.api.documentation.request_example',
                            'Request example',
                        )}
                        value={operation.requestExample}
                    />
                ) : null}
                <CodeExample
                    label={t(
                        'settings.api.documentation.response_example',
                        'Response example',
                    )}
                    value={operation.responseExample}
                />
            </div>
        </article>
    );
}

function CodeExample({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="min-w-0">
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--settings-muted-text)] uppercase">
                {label}
            </p>
            <pre className="max-h-80 overflow-auto border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] p-3 font-mono text-xs leading-5 text-slate-800 dark:text-slate-200">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}

function MethodBadge({ method }: { method: ContentApiMethod }) {
    return (
        <span
            className={cn(
                'inline-flex h-8 min-w-16 items-center justify-center rounded-md px-2 font-mono text-xs font-semibold',
                method === 'GET'
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
            )}
        >
            {method}
        </span>
    );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
    return (
        <label className="grid gap-2 text-sm font-medium text-slate-950 dark:text-white">
            {label}
            {children}
        </label>
    );
}

function LoadingState({ label }: { label: string }) {
    return (
        <div className="grid h-full place-items-center p-6 text-sm text-[var(--settings-muted-text)]">
            {label}
        </div>
    );
}

function LoadError({ message }: { message: string }) {
    return (
        <div className="grid h-full place-items-center p-6 text-sm text-red-600 dark:text-red-300">
            {message}
        </div>
    );
}

function readSectionFromUrl(): ContentApiSection {
    if (typeof window === 'undefined') {
        return 'console';
    }

    return new URL(window.location.href).searchParams.get('api') ===
        'documentation'
        ? 'documentation'
        : 'console';
}
