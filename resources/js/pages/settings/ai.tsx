import { Head, router } from '@inertiajs/react';
import {
    Bot,
    BrainCircuit,
    Download,
    KeyRound,
    type LucideIcon,
    Plus,
    Save,
    ShieldCheck,
    Trash2,
    Upload,
} from 'lucide-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
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
import { cn } from '@/lib/utils';

type AiSection = 'providers' | 'templates' | 'guardrails';

type Option = {
    description?: string;
    label: string;
    value: string;
};

type ProviderCredential = {
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

type AgentTemplate = {
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

type AiSettingsProps = {
    agentTemplates: AgentTemplate[];
    guardrailNotes: string[];
    providerCredentials: ProviderCredential[];
    providerOptions: Option[];
    purposeOptions: Option[];
};

const sectionItems = [
    {
        key: 'providers',
        label: 'Provider keys',
        description: 'Encrypted API credentials and provider-level budgets.',
        icon: KeyRound,
    },
    {
        key: 'templates',
        label: 'Agent templates',
        description: 'Reusable task behaviors for design, assets and feedback.',
        icon: BrainCircuit,
    },
    {
        key: 'guardrails',
        label: 'Guardrails',
        description: 'How sensitive context and limits should be handled.',
        icon: ShieldCheck,
    },
] satisfies {
    description: string;
    icon: LucideIcon;
    key: AiSection;
    label: string;
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

export default function AiSettings({
    agentTemplates,
    guardrailNotes,
    providerCredentials,
    providerOptions,
    purposeOptions,
}: AiSettingsProps) {
    const [activeSection, setActiveSection] = useState<AiSection>('providers');

    return (
        <>
            <Head title="AI support" />
            <SettingsConfigurationShell
                action={
                    <Button asChild variant="secondary">
                        <a
                            href="https://github.com/laravel/ai"
                            rel="noreferrer"
                            target="_blank"
                        >
                            Laravel AI SDK
                        </a>
                    </Button>
                }
                eyebrow="Administration"
                sidebar={
                    <SettingsSidebar>
                        {sectionItems.map((item) => (
                            <SettingsSectionButton
                                active={activeSection === item.key}
                                description={item.description}
                                icon={item.icon}
                                id={item.key}
                                key={item.key}
                                label={item.label}
                                onSelect={setActiveSection}
                            />
                        ))}
                    </SettingsSidebar>
                }
                title="AI support"
            >
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
                        eyebrow="Provider"
                        title={selectedCredential?.label ?? 'New provider key'}
                        description="Store encrypted credentials and coarse budgets for one AI provider account."
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Field label="Label">
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
                        <Field label="Provider">
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
                        <Field label="Base URL">
                            <Input
                                placeholder="Optional for local or compatible providers"
                                value={form.base_url}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        base_url: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Organization">
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
                        <Field label="API key">
                            <Input
                                autoComplete="off"
                                placeholder={
                                    selectedCredential?.hasApiKey
                                        ? `Stored key ending in ${selectedCredential.apiKeyLastFour}`
                                        : 'Paste a key to store it encrypted'
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
                        <Field label="Monthly token limit">
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
                        <Field label="Monthly cost limit in cents">
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
                            Provider may be used by enabled templates
                        </label>
                    </div>
                    <Field label="Notes">
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
                    addLabel="New provider"
                    emptyLabel="No providers yet"
                    onAdd={() => selectCredential(null)}
                >
                    {providerCredentials.map((credential) => (
                        <ListButton
                            active={credential.id === selectedId}
                            key={credential.id}
                            meta={`${credential.provider}${credential.enabled ? '' : ' - disabled'}`}
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
                name: form.name || selectedTemplate?.name || 'Untitled agent',
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
                    'The selected instruction file could not be read. Use Markdown with "## System prompt" and "## Task prompt" sections, or a JSON file with systemPrompt and taskPrompt fields.',
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
                        eyebrow="Agent template"
                        title={selectedTemplate?.name ?? 'New agent template'}
                        description="Define a reusable behavior. Runtime jobs can later execute these templates with guarded context."
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Field label="Name">
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
                        <Field label="Slug">
                            <Input
                                placeholder="Generated from the name when empty"
                                value={form.slug}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        slug: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Purpose">
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
                        <Field label="Provider key">
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
                                <option value="">No provider selected</option>
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
                        <Field label="Model">
                            <Input
                                placeholder="gpt-4.1, gpt-5, local-model..."
                                value={form.model}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        model: event.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Temperature">
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
                        <Field label="Max output tokens">
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
                        <Field label="Concurrency limit">
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
                        <Field label="Monthly token limit">
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
                                    Agent instructions
                                </h3>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                                    Download these prompts as a Markdown file,
                                    edit them elsewhere, or upload a prepared
                                    instruction set. Shared examples live in{' '}
                                    <code>agent-instruction-sets/</code>.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={downloadInstructions}
                                >
                                    <Download className="size-4" />
                                    Download instructions
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() =>
                                        instructionInputRef.current?.click()
                                    }
                                >
                                    <Upload className="size-4" />
                                    Upload instructions
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

                    <Field label="System prompt">
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
                    <Field label="Task prompt">
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
                            Template may be used by future runtime jobs
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
                            Requires explicit guarded learner context
                        </label>
                    </div>
                    <EditorActions
                        deleteDisabled={!selectedTemplate}
                        onDelete={destroy}
                        onSave={submit}
                    />
                </section>
            }
            list={
                <ItemList
                    addLabel="New template"
                    emptyLabel="No templates yet"
                    onAdd={() => selectTemplate(null)}
                >
                    {agentTemplates.map((template) => (
                        <ListButton
                            active={template.id === selectedId}
                            key={template.id}
                            meta={`${template.purpose.replace('_', ' ')}${template.enabled ? '' : ' - disabled'}`}
                            onClick={() => selectTemplate(template)}
                            title={template.name}
                        />
                    ))}
                </ItemList>
            }
        />
    );
}

function GuardrailsPanel({ notes }: { notes: string[] }) {
    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <PanelHeader
                icon={ShieldCheck}
                eyebrow="Guardrails"
                title="Recommended AI structure"
                description="Use separate templates by responsibility. A single provider key can be shared when trust and limits match, but learner feedback should stay guarded."
            />
            <div className="grid gap-4 lg:grid-cols-3">
                <GuardrailCard
                    title="Admin design helper"
                    body="Reviews platform and activity design through the Self-Determination Theory lens without seeing private learner journal content."
                />
                <GuardrailCard
                    title="Asset helper"
                    body="Generates prompts or visual concepts. It usually needs no learner data and can safely use a separate cheaper model."
                />
                <GuardrailCard
                    title="Feedback helper"
                    body="Handles learner reflections only through explicit activity runs, with guarded context and stricter quotas."
                />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#050816]">
                <h3 className="text-sm font-semibold">Implementation notes</h3>
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
    return (
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-white/10">
                <h3 className="text-sm font-semibold">Configured</h3>
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
    return (
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <Button
                disabled={deleteDisabled}
                type="button"
                variant="destructive"
                onClick={onDelete}
            >
                <Trash2 className="size-4" />
                Delete
            </Button>
            <Button type="button" onClick={onSave}>
                <Save className="size-4" />
                Save
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
