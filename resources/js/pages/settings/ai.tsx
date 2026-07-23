import { Head, router } from '@inertiajs/react';
import {
    Bot,
    BrainCircuit,
    Download,
    KeyRound,
    Plus,
    Save,
    Send,
    ShieldCheck,
    Trash2,
    Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
    SettingsConfigurationLayout,
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    buildAgentInstructionMarkdown,
    downloadAgentInstructionFile,
    instructionFilename,
    parseAgentInstructionFile,
} from '@/features/ai/agent-instruction-files';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export type AiSection = 'providers' | 'templates' | 'guardrails';

export type Option = {
    description?: string;
    label: string;
    value: string;
};

export type ProviderCredential = {
    apiKeyLastFour: string | null;
    baseUrl: string | null;
    enabled: boolean;
    hasApiKey: boolean;
    id: number;
    label: string;
    monthlyCostLimitCents: number | null;
    monthlyTokenLimit: number | null;
    notes: string | null;
    organization: string | null;
    provider: string;
    updatedAt: string | null;
};

export type AgentTemplate = {
    aiProviderCredentialId: number | null;
    concurrencyLimit: number;
    createdByName: string | null;
    enabled: boolean;
    guardedContext: boolean;
    id: number;
    maxOutputTokens: number | null;
    model: string | null;
    monthlyTokenLimit: number | null;
    name: string;
    providerLabel: string | null;
    purpose: string;
    slug: string;
    systemPrompt: string | null;
    taskPrompt: string | null;
    temperature: number;
    updatedAt: string | null;
};

type ProviderForm = {
    api_key: string;
    base_url: string;
    enabled: boolean;
    label: string;
    monthly_cost_limit_cents: string;
    monthly_token_limit: string;
    notes: string;
    organization: string;
    provider: string;
};

type TemplateForm = {
    ai_provider_credential_id: string;
    concurrency_limit: string;
    enabled: boolean;
    guarded_context: boolean;
    max_output_tokens: string;
    model: string;
    monthly_token_limit: string;
    name: string;
    purpose: string;
    slug: string;
    system_prompt: string;
    task_prompt: string;
    temperature: string;
};

export type AiSettingsProps = {
    activeSection?: AiSection;
    agentTemplates: AgentTemplate[];
    embedded?: boolean;
    guardrailNotes: string[];
    onSelectSection?: (section: AiSection) => void;
    providerCredentials: ProviderCredential[];
    providerOptions: Option[];
    purposeOptions: Option[];
};

type AgentTemplateTestResult = {
    model: string;
    provider: string;
    responseId: string | null;
    text: string;
    usage: {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
    };
};

type JsonErrorPayload = {
    errors?: Record<string, string[]>;
    message?: string;
};

const sectionItems = [
    {
        key: 'providers',
        labelKey: 'settings.ai.sections.providers',
        labelFallback: 'Provider keys',
        descriptionKey: 'settings.ai.sections.providers.description',
        descriptionFallback:
            'Encrypted API credentials and provider-level budgets.',
        icon: KeyRound,
    },
    {
        key: 'templates',
        labelKey: 'settings.ai.sections.templates',
        labelFallback: 'Agent templates',
        descriptionKey: 'settings.ai.sections.templates.description',
        descriptionFallback:
            'Reusable task behaviors for design, assets and feedback.',
        icon: BrainCircuit,
    },
    {
        key: 'guardrails',
        labelKey: 'settings.ai.sections.guardrails',
        labelFallback: 'Guardrails',
        descriptionKey: 'settings.ai.sections.guardrails.description',
        descriptionFallback:
            'How sensitive context and limits should be handled.',
        icon: ShieldCheck,
    },
] satisfies {
    descriptionFallback: string;
    descriptionKey: string;
    icon: LucideIcon;
    key: AiSection;
    labelFallback: string;
    labelKey: string;
}[];

function blankProviderForm(defaultProvider = 'openai'): ProviderForm {
    return {
        api_key: '',
        base_url: '',
        enabled: true,
        label: '',
        monthly_cost_limit_cents: '',
        monthly_token_limit: '',
        notes: '',
        organization: '',
        provider: defaultProvider,
    };
}

function providerFormFromCredential(
    credential: ProviderCredential,
): ProviderForm {
    return {
        api_key: '',
        base_url: credential.baseUrl ?? '',
        enabled: credential.enabled,
        label: credential.label,
        monthly_cost_limit_cents:
            credential.monthlyCostLimitCents?.toString() ?? '',
        monthly_token_limit: credential.monthlyTokenLimit?.toString() ?? '',
        notes: credential.notes ?? '',
        organization: credential.organization ?? '',
        provider: credential.provider,
    };
}

function blankTemplateForm(defaultPurpose = 'sdt_design'): TemplateForm {
    return {
        ai_provider_credential_id: '',
        concurrency_limit: '1',
        enabled: true,
        guarded_context: true,
        max_output_tokens: '',
        model: '',
        monthly_token_limit: '',
        name: '',
        purpose: defaultPurpose,
        slug: '',
        system_prompt: '',
        task_prompt: '',
        temperature: '0.7',
    };
}

function templateFormFromTemplate(template: AgentTemplate): TemplateForm {
    return {
        ai_provider_credential_id:
            template.aiProviderCredentialId?.toString() ?? '',
        concurrency_limit: template.concurrencyLimit.toString(),
        enabled: template.enabled,
        guarded_context: template.guardedContext,
        max_output_tokens: template.maxOutputTokens?.toString() ?? '',
        model: template.model ?? '',
        monthly_token_limit: template.monthlyTokenLimit?.toString() ?? '',
        name: template.name,
        purpose: template.purpose,
        slug: template.slug,
        system_prompt: template.systemPrompt ?? '',
        task_prompt: template.taskPrompt ?? '',
        temperature: template.temperature.toString(),
    };
}

async function postSettingsJson<T>(
    url: string,
    payload: Record<string, unknown>,
): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error(await jsonErrorMessage(response));
    }

    return response.json() as Promise<T>;
}

async function jsonErrorMessage(response: Response): Promise<string> {
    const fallback = `Request failed with status ${response.status}`;

    try {
        const data = (await response.json()) as JsonErrorPayload;
        const firstError = data.errors
            ? Object.values(data.errors).flat()[0]
            : null;

        return firstError ?? data.message ?? fallback;
    } catch {
        return fallback;
    }
}

export default function AiSettings({
    activeSection: controlledSection,
    agentTemplates,
    embedded = false,
    guardrailNotes,
    onSelectSection,
    providerCredentials,
    providerOptions,
    purposeOptions,
}: AiSettingsProps) {
    const t = usePlatformTranslation();
    const [localSection, setLocalSection] = useState<AiSection>('providers');
    const activeSection = controlledSection ?? localSection;
    const selectSection = (section: AiSection) => {
        setLocalSection(section);
        onSelectSection?.(section);
    };

    const action = (
        <Button asChild variant="secondary">
            <a
                href="https://github.com/laravel/ai"
                rel="noreferrer"
                target="_blank"
            >
                {t('settings.ai.actions.open_laravel_ai_sdk', 'Laravel AI SDK')}
            </a>
        </Button>
    );

    const sidebar = (
        <SettingsSidebar>
            {sectionItems.map((item) => (
                <SettingsSectionButton
                    active={activeSection === item.key}
                    description={t(
                        item.descriptionKey,
                        item.descriptionFallback,
                    )}
                    icon={item.icon}
                    id={item.key}
                    key={item.key}
                    label={t(item.labelKey, item.labelFallback)}
                    onSelect={selectSection}
                />
            ))}
        </SettingsSidebar>
    );

    const content = (
        <SettingsContentPane>
            {activeSection === 'providers' ? (
                <ProviderCredentialsPanel
                    providerCredentials={providerCredentials}
                    providerOptions={providerOptions}
                />
            ) : null}
            {activeSection === 'templates' ? (
                <AgentTemplatesPanel
                    agentTemplates={agentTemplates}
                    providerCredentials={providerCredentials}
                    purposeOptions={purposeOptions}
                />
            ) : null}
            {activeSection === 'guardrails' ? (
                <GuardrailsPanel notes={guardrailNotes} />
            ) : null}
        </SettingsContentPane>
    );

    if (embedded) {
        return (
            <SettingsConfigurationLayout className="h-full" sidebar={sidebar}>
                {content}
            </SettingsConfigurationLayout>
        );
    }

    return (
        <>
            <Head title={t('settings.ai.title', 'AI support')} />
            <SettingsConfigurationShell
                action={action}
                eyebrow={t('settings.ai.eyebrow', 'Administration')}
                sidebar={sidebar}
                title={t('settings.ai.title', 'AI support')}
            >
                {content}
            </SettingsConfigurationShell>
        </>
    );
}

function ProviderCredentialsPanel({
    providerCredentials,
    providerOptions,
}: {
    providerCredentials: ProviderCredential[];
    providerOptions: Option[];
}) {
    const t = usePlatformTranslation();
    const [selectedId, setSelectedId] = useState<number | 'new'>(
        providerCredentials[0]?.id ?? 'new',
    );
    const selectedCredential = providerCredentials.find(
        (credential) => credential.id === selectedId,
    );
    const [form, setForm] = useState<ProviderForm>(
        selectedCredential
            ? providerFormFromCredential(selectedCredential)
            : blankProviderForm(providerOptions[0]?.value),
    );

    const selectCredential = (credential: ProviderCredential | null) => {
        setSelectedId(credential?.id ?? 'new');
        setForm(
            credential
                ? providerFormFromCredential(credential)
                : blankProviderForm(providerOptions[0]?.value),
        );
    };

    const submit = () => {
        const url =
            selectedCredential === undefined
                ? '/settings/ai/credentials'
                : `/settings/ai/credentials/${selectedCredential.id}`;

        if (selectedCredential === undefined) {
            router.post(url, form, { preserveScroll: true });

            return;
        }

        router.patch(url, form, { preserveScroll: true });
    };

    const destroy = () => {
        if (!selectedCredential) {
            return;
        }

        router.delete(`/settings/ai/credentials/${selectedCredential.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <TwoPaneEditor
            detail={
                <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                    <PanelHeader
                        icon={KeyRound}
                        eyebrow={t('settings.ai.providers.eyebrow', 'Provider')}
                        title={
                            selectedCredential?.label ??
                            t(
                                'settings.ai.providers.new_title',
                                'New provider key',
                            )
                        }
                        description={t(
                            'settings.ai.providers.description',
                            'Store encrypted credentials and coarse budgets for one AI provider account.',
                        )}
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Field
                            label={t(
                                'settings.ai.providers.fields.label',
                                'Label',
                            )}
                        >
                            <Input
                                value={form.label}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        label: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.providers.fields.provider',
                                'Provider',
                            )}
                        >
                            <select
                                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-[#050816]"
                                value={form.provider}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        provider: event.target.value,
                                    })
                                }
                            >
                                {providerOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.providers.fields.base_url',
                                'Base URL',
                            )}
                        >
                            <Input
                                placeholder={t(
                                    'settings.ai.providers.placeholders.base_url',
                                    'Optional for local or compatible providers',
                                )}
                                value={form.base_url}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        base_url: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.providers.fields.organization',
                                'Organization',
                            )}
                        >
                            <Input
                                value={form.organization}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        organization: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.providers.fields.api_key',
                                'API key',
                            )}
                        >
                            <Input
                                autoComplete="off"
                                placeholder={
                                    selectedCredential?.hasApiKey
                                        ? t(
                                              'settings.ai.providers.placeholders.api_key_stored',
                                              'Stored key ending in :lastFour',
                                              {
                                                  lastFour:
                                                      selectedCredential.apiKeyLastFour ??
                                                      '',
                                              },
                                          )
                                        : t(
                                              'settings.ai.providers.placeholders.api_key_new',
                                              'Paste a key to store it encrypted',
                                          )
                                }
                                type="password"
                                value={form.api_key}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        api_key: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.providers.fields.monthly_token_limit',
                                'Monthly token limit',
                            )}
                        >
                            <Input
                                inputMode="numeric"
                                value={form.monthly_token_limit}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        monthly_token_limit: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.providers.fields.monthly_cost_limit',
                                'Monthly cost limit in cents',
                            )}
                        >
                            <Input
                                inputMode="numeric"
                                value={form.monthly_cost_limit_cents}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        monthly_cost_limit_cents:
                                            event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                            <input
                                checked={form.enabled}
                                type="checkbox"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        enabled: event.target.checked,
                                    })
                                }
                            />
                            {t(
                                'settings.ai.providers.enabled_label',
                                'Provider may be used by enabled templates',
                            )}
                        </label>
                    </div>
                    <Field
                        label={t('settings.ai.providers.fields.notes', 'Notes')}
                    >
                        <textarea
                            className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#050816]"
                            value={form.notes}
                            onChange={(event) =>
                                setForm({ ...form, notes: event.target.value })
                            }
                        />
                    </Field>
                    <EditorActions
                        deleteDisabled={!selectedCredential}
                        onDelete={destroy}
                        onSave={submit}
                    />
                </section>
            }
            list={
                <ItemList
                    addLabel={t(
                        'settings.ai.providers.new_button',
                        'New provider',
                    )}
                    emptyLabel={t(
                        'settings.ai.providers.empty',
                        'No providers yet',
                    )}
                    onAdd={() => selectCredential(null)}
                >
                    {providerCredentials.map((credential) => (
                        <ListButton
                            active={credential.id === selectedId}
                            key={credential.id}
                            meta={`${credential.provider}${credential.enabled ? '' : t('settings.ai.common.disabled_suffix', ' - disabled')}`}
                            onClick={() => selectCredential(credential)}
                            title={credential.label}
                        />
                    ))}
                </ItemList>
            }
        />
    );
}

function AgentTemplatesPanel({
    agentTemplates,
    providerCredentials,
    purposeOptions,
}: {
    agentTemplates: AgentTemplate[];
    providerCredentials: ProviderCredential[];
    purposeOptions: Option[];
}) {
    const t = usePlatformTranslation();
    const [selectedId, setSelectedId] = useState<number | 'new'>(
        agentTemplates[0]?.id ?? 'new',
    );
    const selectedTemplate = agentTemplates.find(
        (template) => template.id === selectedId,
    );
    const [form, setForm] = useState<TemplateForm>(
        selectedTemplate
            ? templateFormFromTemplate(selectedTemplate)
            : blankTemplateForm(purposeOptions[0]?.value),
    );
    const instructionInputRef = useRef<HTMLInputElement>(null);
    const selectedPurpose = useMemo(
        () => purposeOptions.find((option) => option.value === form.purpose),
        [form.purpose, purposeOptions],
    );

    const selectTemplate = (template: AgentTemplate | null) => {
        setSelectedId(template?.id ?? 'new');
        setForm(
            template
                ? templateFormFromTemplate(template)
                : blankTemplateForm(purposeOptions[0]?.value),
        );
    };

    const submit = () => {
        const url =
            selectedTemplate === undefined
                ? '/settings/ai/templates'
                : `/settings/ai/templates/${selectedTemplate.id}`;

        if (selectedTemplate === undefined) {
            router.post(url, form, { preserveScroll: true });

            return;
        }

        router.patch(url, form, { preserveScroll: true });
    };

    const destroy = () => {
        if (!selectedTemplate) {
            return;
        }

        router.delete(`/settings/ai/templates/${selectedTemplate.id}`, {
            preserveScroll: true,
        });
    };

    const downloadInstructions = () => {
        downloadAgentInstructionFile(
            instructionFilename(form.name || selectedTemplate?.name || 'agent'),
            buildAgentInstructionMarkdown({
                name:
                    form.name ||
                    selectedTemplate?.name ||
                    t('settings.ai.templates.untitled', 'Untitled agent'),
                purpose: form.purpose,
                systemPrompt: form.system_prompt,
                taskPrompt: form.task_prompt,
            }),
        );
    };

    const uploadInstructions = (file: File | undefined) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            try {
                const parsed = parseAgentInstructionFile(
                    String(reader.result ?? ''),
                );

                setForm((currentForm) => ({
                    ...currentForm,
                    system_prompt: parsed.systemPrompt,
                    task_prompt: parsed.taskPrompt,
                }));
            } catch {
                window.alert(
                    t(
                        'settings.ai.templates.alerts.instructions_parse_failed',
                        'The selected instruction file could not be read. Use Markdown with "## System prompt" and "## Task prompt" sections, or a JSON file with systemPrompt and taskPrompt fields.',
                    ),
                );
            } finally {
                if (instructionInputRef.current) {
                    instructionInputRef.current.value = '';
                }
            }
        };

        reader.readAsText(file);
    };

    return (
        <TwoPaneEditor
            detail={
                <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                    <PanelHeader
                        icon={BrainCircuit}
                        eyebrow={t(
                            'settings.ai.templates.eyebrow',
                            'Agent template',
                        )}
                        title={
                            selectedTemplate?.name ??
                            t(
                                'settings.ai.templates.new_title',
                                'New agent template',
                            )
                        }
                        description={t(
                            'settings.ai.templates.description',
                            'Define a reusable behavior. Runtime jobs can later execute these templates with guarded context.',
                        )}
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Field
                            label={t(
                                'settings.ai.templates.fields.name',
                                'Name',
                            )}
                        >
                            <Input
                                value={form.name}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        name: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.slug',
                                'Slug',
                            )}
                        >
                            <Input
                                placeholder={t(
                                    'settings.ai.templates.placeholders.slug',
                                    'Generated from the name when empty',
                                )}
                                value={form.slug}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        slug: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.purpose',
                                'Purpose',
                            )}
                        >
                            <select
                                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-[#050816]"
                                value={form.purpose}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        purpose: event.target.value,
                                    })
                                }
                            >
                                {purposeOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {selectedPurpose?.description ? (
                                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                    {selectedPurpose.description}
                                </p>
                            ) : null}
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.provider_key',
                                'Provider key',
                            )}
                        >
                            <select
                                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-[#050816]"
                                value={form.ai_provider_credential_id}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        ai_provider_credential_id:
                                            event.target.value,
                                    })
                                }
                            >
                                <option value="">
                                    {t(
                                        'settings.ai.templates.placeholders.provider',
                                        'No provider selected',
                                    )}
                                </option>
                                {providerCredentials.map((credential) => (
                                    <option
                                        key={credential.id}
                                        value={credential.id.toString()}
                                    >
                                        {credential.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.model',
                                'Model',
                            )}
                        >
                            <Input
                                placeholder={t(
                                    'settings.ai.templates.placeholders.model',
                                    'gpt-4.1, gpt-5, local-model...',
                                )}
                                value={form.model}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        model: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.temperature',
                                'Temperature',
                            )}
                        >
                            <Input
                                inputMode="decimal"
                                value={form.temperature}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        temperature: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.max_output_tokens',
                                'Max output tokens',
                            )}
                        >
                            <Input
                                inputMode="numeric"
                                value={form.max_output_tokens}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        max_output_tokens: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.concurrency_limit',
                                'Concurrency limit',
                            )}
                        >
                            <Input
                                inputMode="numeric"
                                value={form.concurrency_limit}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        concurrency_limit: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field
                            label={t(
                                'settings.ai.templates.fields.monthly_token_limit',
                                'Monthly token limit',
                            )}
                        >
                            <Input
                                inputMode="numeric"
                                value={form.monthly_token_limit}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        monthly_token_limit: event.target.value,
                                    })
                                }
                            />
                        </Field>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold">
                                    {t(
                                        'settings.ai.templates.instructions.title',
                                        'Agent instructions',
                                    )}
                                </h3>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                                    {t(
                                        'settings.ai.templates.instructions.description_before_path',
                                        'Download these prompts as a Markdown file, edit them elsewhere, or upload a prepared instruction set. Shared examples live in ',
                                    )}
                                    <code>agent-instruction-sets/</code>.
                                    {t(
                                        'settings.ai.templates.instructions.description_after_path',
                                        '',
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={downloadInstructions}
                                >
                                    <Download className="size-4" />
                                    {t(
                                        'settings.ai.templates.instructions.download',
                                        'Download instructions',
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() =>
                                        instructionInputRef.current?.click()
                                    }
                                >
                                    <Upload className="size-4" />
                                    {t(
                                        'settings.ai.templates.instructions.upload',
                                        'Upload instructions',
                                    )}
                                </Button>
                                <input
                                    accept=".md,.txt,.json,text/markdown,text/plain,application/json"
                                    className="hidden"
                                    ref={instructionInputRef}
                                    type="file"
                                    onChange={(event) =>
                                        uploadInstructions(
                                            event.target.files?.[0],
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <Field
                        label={t(
                            'settings.ai.templates.fields.system_prompt',
                            'System prompt',
                        )}
                    >
                        <textarea
                            className="min-h-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#050816]"
                            value={form.system_prompt}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    system_prompt: event.target.value,
                                })
                            }
                        />
                    </Field>
                    <Field
                        label={t(
                            'settings.ai.templates.fields.task_prompt',
                            'Task prompt',
                        )}
                    >
                        <textarea
                            className="min-h-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#050816]"
                            value={form.task_prompt}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    task_prompt: event.target.value,
                                })
                            }
                        />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                            <input
                                checked={form.enabled}
                                type="checkbox"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        enabled: event.target.checked,
                                    })
                                }
                            />
                            {t(
                                'settings.ai.templates.enabled_label',
                                'Template may be used by future runtime jobs',
                            )}
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                            <input
                                checked={form.guarded_context}
                                type="checkbox"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        guarded_context: event.target.checked,
                                    })
                                }
                            />
                            {t(
                                'settings.ai.templates.guarded_context_label',
                                'Requires explicit guarded learner context',
                            )}
                        </label>
                    </div>
                    <EditorActions
                        deleteDisabled={!selectedTemplate}
                        onDelete={destroy}
                        onSave={submit}
                    />
                    <AgentTemplateTestPanel template={selectedTemplate} />
                </section>
            }
            list={
                <ItemList
                    addLabel={t(
                        'settings.ai.templates.new_button',
                        'New template',
                    )}
                    emptyLabel={t(
                        'settings.ai.templates.empty',
                        'No templates yet',
                    )}
                    onAdd={() => selectTemplate(null)}
                >
                    {agentTemplates.map((template) => (
                        <ListButton
                            active={template.id === selectedId}
                            key={template.id}
                            meta={`${template.purpose.replace('_', ' ')}${template.enabled ? '' : t('settings.ai.common.disabled_suffix', ' - disabled')}`}
                            onClick={() => selectTemplate(template)}
                            title={template.name}
                        />
                    ))}
                </ItemList>
            }
        />
    );
}

function AgentTemplateTestPanel({
    template,
}: {
    template: AgentTemplate | undefined;
}) {
    const t = usePlatformTranslation();
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState<AgentTemplateTestResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    const canSubmit = Boolean(template && prompt.trim() !== '' && !isTesting);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!template || prompt.trim() === '') {
            return;
        }

        setError(null);
        setResult(null);
        setIsTesting(true);

        try {
            setResult(
                await postSettingsJson<AgentTemplateTestResult>(
                    `/settings/ai/templates/${template.id}/test`,
                    { prompt },
                ),
            );
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : t(
                          'settings.ai.templates.test.unknown_error',
                          'The test request failed.',
                      ),
            );
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <form
            className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
            onSubmit={submit}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold">
                        {t('settings.ai.templates.test.title', 'Test request')}
                    </h3>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {template
                            ? t(
                                  'settings.ai.templates.test.saved_notice',
                                  'Uses the saved agent template and its server-side provider key.',
                              )
                            : t(
                                  'settings.ai.templates.test.new_notice',
                                  'Save this agent template before sending a test request.',
                              )}
                    </p>
                </div>
                <Button disabled={!canSubmit} type="submit" variant="secondary">
                    <Send className="size-4" />
                    {isTesting
                        ? t('settings.ai.templates.test.sending', 'Sending')
                        : t('settings.ai.templates.test.send', 'Send test')}
                </Button>
            </div>
            <textarea
                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#050816]"
                disabled={!template || isTesting}
                placeholder={t(
                    'settings.ai.templates.test.placeholder',
                    'Ask a short test question...',
                )}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
            />
            {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </p>
            ) : null}
            {result ? (
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#050816]">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{result.provider}</span>
                        <span>{result.model}</span>
                        {result.usage.totalTokens !== null ? (
                            <span>
                                {t(
                                    'settings.ai.templates.test.total_tokens',
                                    'Tokens',
                                )}
                                : {result.usage.totalTokens}
                            </span>
                        ) : null}
                    </div>
                    <pre className="max-h-80 overflow-auto text-sm leading-6 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                        {result.text ||
                            t(
                                'settings.ai.templates.test.empty_response',
                                'The provider returned no text.',
                            )}
                    </pre>
                </div>
            ) : null}
        </form>
    );
}

function GuardrailsPanel({ notes }: { notes: string[] }) {
    const t = usePlatformTranslation();

    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <PanelHeader
                icon={ShieldCheck}
                eyebrow={t('settings.ai.guardrails.eyebrow', 'Guardrails')}
                title={t(
                    'settings.ai.guardrails.title',
                    'Recommended AI structure',
                )}
                description={t(
                    'settings.ai.guardrails.description',
                    'Use separate templates by responsibility. A single provider key can be shared when trust and limits match, but learner feedback should stay guarded.',
                )}
            />
            <div className="grid gap-4 lg:grid-cols-3">
                <GuardrailCard
                    title={t(
                        'settings.ai.guardrails.admin.title',
                        'Admin design helper',
                    )}
                    body={t(
                        'settings.ai.guardrails.admin.body',
                        'Reviews platform and activity design through the Self-Determination Theory lens without seeing private learner journal content.',
                    )}
                />
                <GuardrailCard
                    title={t(
                        'settings.ai.guardrails.asset.title',
                        'Asset helper',
                    )}
                    body={t(
                        'settings.ai.guardrails.asset.body',
                        'Generates prompts or visual concepts. It usually needs no learner data and can safely use a separate cheaper model.',
                    )}
                />
                <GuardrailCard
                    title={t(
                        'settings.ai.guardrails.feedback.title',
                        'Feedback helper',
                    )}
                    body={t(
                        'settings.ai.guardrails.feedback.body',
                        'Handles learner reflections only through explicit activity runs, with guarded context and stricter quotas.',
                    )}
                />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#050816]">
                <h3 className="text-sm font-semibold">
                    {t(
                        'settings.ai.guardrails.implementation_notes',
                        'Implementation notes',
                    )}
                </h3>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {notes.map((note) => (
                        <li key={note}>- {note}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

function TwoPaneEditor({
    detail,
    list,
}: {
    detail: ReactNode;
    list: ReactNode;
}) {
    return (
        <div className="grid min-h-full gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">{detail}</div>
            {list}
        </div>
    );
}

function ItemList({
    addLabel,
    children,
    emptyLabel,
    onAdd,
}: {
    addLabel: string;
    children: ReactNode;
    emptyLabel: string;
    onAdd: () => void;
}) {
    const t = usePlatformTranslation();

    return (
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-white/10">
                <h3 className="text-sm font-semibold">
                    {t('settings.ai.common.configured', 'Configured')}
                </h3>
                <Button
                    size="icon"
                    type="button"
                    variant="secondary"
                    onClick={onAdd}
                >
                    <Plus className="size-4" />
                </Button>
            </div>
            <div className="grid gap-2 overflow-y-auto p-3">
                {children}
                {Array.isArray(children) && children.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {emptyLabel}
                    </p>
                ) : null}
            </div>
            <div className="border-t border-slate-200 p-3 dark:border-white/10">
                <Button className="w-full" type="button" onClick={onAdd}>
                    <Plus className="size-4" />
                    {addLabel}
                </Button>
            </div>
        </aside>
    );
}

function ListButton({
    active,
    meta,
    onClick,
    title,
}: {
    active: boolean;
    meta: string;
    onClick: () => void;
    title: string;
}) {
    return (
        <button
            className={cn(
                'rounded-xl border p-3 text-left transition',
                active
                    ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)]'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20',
            )}
            type="button"
            onClick={onClick}
        >
            <span className="block text-sm font-semibold">{title}</span>
            <span className="mt-1 block text-xs text-slate-500 capitalize dark:text-slate-400">
                {meta}
            </span>
        </button>
    );
}

function PanelHeader({
    description,
    eyebrow,
    icon: Icon,
    title,
}: {
    description: string;
    eyebrow: string;
    icon: LucideIcon;
    title: string;
}) {
    return (
        <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--settings-accent)_16%,transparent)] text-[var(--settings-accent)]">
                <Icon className="size-5" />
            </span>
            <div>
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    {eyebrow}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </div>
        </div>
    );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function EditorActions({
    deleteDisabled,
    onDelete,
    onSave,
}: {
    deleteDisabled: boolean;
    onDelete: () => void;
    onSave: () => void;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <Button
                disabled={deleteDisabled}
                type="button"
                variant="destructive"
                onClick={onDelete}
            >
                <Trash2 className="size-4" />
                {t('common.delete', 'Delete')}
            </Button>
            <Button type="button" onClick={onSave}>
                <Save className="size-4" />
                {t('common.save', 'Save')}
            </Button>
        </div>
    );
}

function GuardrailCard({ body, title }: { body: string; title: string }) {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#050816]">
            <Bot className="size-5 text-[var(--settings-accent)]" />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {body}
            </p>
        </article>
    );
}
