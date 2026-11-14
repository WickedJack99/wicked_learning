import {
    Background,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Bot,
    ChevronLeft,
    ChevronRight,
    Link2,
    Pencil,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { Navigate, useLocation } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import {
    LearningCompanionSettingsShell,
    type LearningCompanionSection,
} from './extracted-learning-companion-navigation';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

type Settings = components['schemas']['AdminLearningCompanionSettings'];
type SettingsRequest =
    components['schemas']['UpdateAdminLearningCompanionSettingsRequest'];
type DialogueSummary =
    components['schemas']['AdminLearningCompanionDialogueSummary'];
type DialogueResponse = components['schemas']['AdminLearningCompanionDialogue'];
type AssignmentTarget =
    components['schemas']['AdminLearningCompanionAssignmentTarget'];
type Assignment = components['schemas']['AdminLearningCompanionAssignment'];
type NodeType = 'ai' | 'choice' | 'end' | 'message';

type DialogueChoice = {
    action?: string;
    key: string;
    label: string;
    next?: string;
};
type DialogueNode = {
    capabilities?: string[];
    choices?: DialogueChoice[];
    id: string;
    instruction?: string;
    message?: string;
    next?: string;
    position?: { x: number; y: number };
    prompt?: string;
    response_mode?: 'choice' | 'message';
    title?: string;
    type: NodeType;
};
type DialogueGraph = { nodes: DialogueNode[]; start: string; version: 1 };
type DialogueFlowNode = Node<
    { node?: DialogueNode; start?: boolean },
    'dialogue' | 'start'
>;

const capabilities = [
    ['current-context', 'Current place and activity'],
    ['topic-context', 'Topic context'],
    ['route-context', 'Route context'],
    ['nearby-places', 'Nearby places'],
    ['navigation-alternatives', 'Navigation alternatives'],
    ['revisit-options', 'Revisit options'],
] as const;
const actions = [
    ['current-map', 'Current map'],
    ['learning-desk', 'Learning desk'],
    ['topics', 'Topics'],
    ['continue-exploring', 'Continue exploring'],
] as const;
const input =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-white/15 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-teal-200';

/** Source-adapted Learning Companion settings. The client only edits bounded
 * platform fields and authored graphs; scope authorization stays in Rust. */
export function OriginalLearningCompanionSettingsPage({
    appearance,
    onSignedOut,
    settingsAccess,
}: {
    appearance: OriginalAppearance;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
    const location = useLocation();
    const t = usePlatformTranslation();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [draft, setDraft] = useState<SettingsRequest | null>(null);
    const [error, setError] = useState('');
    const [forbidden, setForbidden] = useState(false);
    const [saving, setSaving] = useState(false);
    const section =
        new URLSearchParams(location.search).get('companion') === 'dialogues'
            ? 'dialogues'
            : 'identity';

    const load = useCallback(async () => {
        const { data, response } = await apiClient.GET(
            '/admin/learning-companion',
        );
        if (response.status === 403 || response.status === 404) {
            setForbidden(true);
            return;
        }
        if (!response.ok || !data) {
            throw new Error(
                'Learning Companion settings are temporarily unavailable.',
            );
        }
        setSettings(data);
        setDraft(toSettingsRequest(data));
    }, []);

    useEffect(() => {
        void load().catch((reason) =>
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Learning Companion settings are temporarily unavailable.',
            ),
        );
    }, [load]);

    const save = async () => {
        if (!draft) return;
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/learning-companion',
                {
                    body: draft,
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data)
                throw new Error('The companion settings could not be saved.');
            setSettings(data);
            setDraft(toSettingsRequest(data));
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The companion settings could not be saved.',
            );
        } finally {
            setSaving(false);
        }
    };

    if (forbidden) return <Navigate replace to="/home" />;
    return (
        <LearningCompanionSettingsShell
            activeSection={section as LearningCompanionSection}
            appearance={appearance}
            onSignedOut={onSignedOut}
            settingsAccess={settingsAccess}
        >
            <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-5" data-wl-id="admin.learning-companion.settings">
                <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[var(--settings-border-color)] pb-5">
                    <div><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">{t('settings.learning_companion.administration', 'Administration')}</p><h1 className="mt-2 text-3xl font-semibold">{t('settings.learning_companion.title', 'Learning Companion')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.learning_companion.description', 'Configure the optional source guide, its bounded AI policy, and reusable authored dialogue graphs.')}</p></div>
                    {section === 'identity' ? <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!draft || saving} onClick={() => void save()} type="button"><Save className="size-4" />{saving ? t('settings.learning_companion.saving', 'Saving…') : t('settings.learning_companion.save_changes', 'Save changes')}</button> : null}
                </header>
                {error ? (
                    <p
                        className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                {!draft || !settings ? (
                    <p className="py-6 text-sm text-[var(--settings-muted-text)]">
                        {t('settings.learning_companion.loading', 'Loading Learning Companion settings…')}
                    </p>
                ) : (
                    <div className="pt-5">
                        {section === 'identity' ? <IdentityEditor draft={draft} onChange={setDraft} settings={settings} /> : <DialogueWorkspace />}
                    </div>
                )}
            </div>
        </LearningCompanionSettingsShell>
    );
}

function IdentityEditor({
    draft,
    onChange,
    settings,
}: {
    draft: SettingsRequest;
    onChange: (draft: SettingsRequest) => void;
    settings: Settings;
}) {
    const t = usePlatformTranslation();
    const update = <K extends keyof SettingsRequest>(
        key: K,
        value: SettingsRequest[K],
    ) => onChange({ ...draft, [key]: value });
    return (
        <section
            className="mx-auto grid max-w-4xl gap-6"
            data-wl-id="admin.learning-companion.identity"
        >
            <header>
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    {t('settings.learning_companion.identity.eyebrow', 'Learner experience')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                    {t('settings.learning_companion.identity.title', 'Identity and policy')}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {t('settings.learning_companion.identity.description', 'The companion is optional. It can offer authored context and safe destinations, but never acts for a learner.')}
                </p>
            </header>
            <fieldset className="grid gap-5 rounded-xl border border-[var(--settings-border-color)] p-5">
                <label className="flex cursor-pointer items-start gap-3">
                    <input
                        checked={draft.enabled}
                        className="mt-1 size-4 accent-teal-700"
                        onChange={(event) =>
                            update('enabled', event.target.checked)
                        }
                        type="checkbox"
                    />
                    <span>
                        <span className="block text-sm font-semibold">
                            {t('settings.learning_companion.identity.enabled_label', 'Show the companion to learners')}
                        </span>
                        <span className="mt-1 block text-sm text-[var(--settings-muted-text)]">
                            {t('settings.learning_companion.identity.enabled_description', 'Learners may open it while exploring or during an activity. It never blocks the current flow.')}
                        </span>
                    </span>
                </label>
                <Field label={t('settings.learning_companion.identity.display_name', 'Display name')}>
                    <input
                        className={input}
                        maxLength={80}
                        onChange={(event) =>
                            update('display_name', event.target.value)
                        }
                        value={draft.display_name}
                    />
                </Field>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="grid gap-4">
                        <Field label={t('settings.learning_companion.identity.avatar_url', 'Avatar image URL (optional)')}>
                            <input
                                className={input}
                                onChange={(event) =>
                                    update(
                                        'avatar_url',
                                        nullable(event.target.value),
                                    )
                                }
                                placeholder={t('settings.learning_companion.identity.avatar_url_placeholder', 'https://… or a managed media URL')}
                                value={draft.avatar_url ?? ''}
                            />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <RangeField
                                disabled={!draft.avatar_url}
                                label={t('settings.learning_companion.identity.avatar_position_x', 'Horizontal position')}
                                max={100}
                                min={0}
                                onChange={(value) =>
                                    update('avatar_position_x', value)
                                }
                                value={draft.avatar_position_x}
                            />
                            <RangeField
                                disabled={!draft.avatar_url}
                                label={t('settings.learning_companion.identity.avatar_position_y', 'Vertical position')}
                                max={100}
                                min={0}
                                onChange={(value) =>
                                    update('avatar_position_y', value)
                                }
                                value={draft.avatar_position_y}
                            />
                            <RangeField
                                disabled={!draft.avatar_url}
                                label={t('settings.learning_companion.identity.avatar_scale', 'Image size')}
                                max={200}
                                min={80}
                                onChange={(value) =>
                                    update('avatar_scale', value)
                                }
                                value={draft.avatar_scale}
                            />
                        </div>
                    </div>
                    <div className="grid content-start gap-3 rounded-xl border border-[var(--settings-border-color)] p-4">
                        <p className="text-sm font-semibold">{t('settings.learning_companion.identity.avatar_preview', 'Avatar preview')}</p>
                        <div
                            className="grid size-28 place-items-center overflow-hidden rounded-full border-2"
                            style={{
                                backgroundColor: draft.avatar_color,
                                borderColor: draft.avatar_color,
                            }}
                        >
                            <Avatar settings={draft} />
                        </div>
                        <Field label={t('settings.learning_companion.identity.avatar_color', 'Avatar color')}>
                            <div className="flex items-center gap-3">
                                <input
                                    aria-label={t('settings.learning_companion.identity.avatar_color', 'Avatar color')}
                                    className="size-10 rounded border border-[var(--settings-border-color)] bg-transparent p-1"
                                    onChange={(event) =>
                                        update(
                                            'avatar_color',
                                            event.target.value,
                                        )
                                    }
                                    type="color"
                                    value={draft.avatar_color}
                                />
                                <span className="font-mono text-sm text-[var(--settings-muted-text)]">
                                    {draft.avatar_color}
                                </span>
                            </div>
                        </Field>
                    </div>
                </div>
                <Field label={t('settings.learning_companion.identity.orientation_message', 'Orientation message')}>
                    <textarea
                        className={`${input} min-h-32`}
                        maxLength={1200}
                        onChange={(event) =>
                            update('welcome_message', event.target.value)
                        }
                        value={draft.welcome_message}
                    />
                </Field>
            </fieldset>
            <fieldset className="grid gap-4 rounded-xl border border-[var(--settings-border-color)] p-5">
                <legend className="px-1 text-base font-semibold">
                    {t('settings.learning_companion.identity.ai_turns', 'AI companion turns')}
                </legend>
                <label className="flex cursor-pointer items-start gap-3">
                    <input
                        checked={draft.ai_enabled}
                        className="mt-1 size-4 accent-teal-700"
                        onChange={(event) =>
                            update('ai_enabled', event.target.checked)
                        }
                        type="checkbox"
                    />
                    <span>
                        <span className="block text-sm font-semibold">
                            {t('settings.learning_companion.identity.ai_enabled_label', 'Allow authored AI nodes')}
                        </span>
                        <span className="mt-1 block text-sm text-[var(--settings-muted-text)]">
                            {t('settings.learning_companion.identity.ai_enabled_description', 'Only authored instructions and the listed context are available. The provider cannot navigate or change learning content.')}
                        </span>
                    </span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                        label={t('settings.learning_companion.identity.ai_mode', 'AI mode')}
                        onChange={(value) =>
                            update('mode', value as SettingsRequest['mode'])
                        }
                        options={[
                            ['scripted', t('settings.learning_companion.identity.ai_modes.scripted', 'Scripted only')],
                            ['guided_ai', t('settings.learning_companion.identity.ai_modes.guided', 'Guided AI')],
                            ['open_ai', t('settings.learning_companion.identity.ai_modes.open', 'Open AI')],
                        ]}
                        value={draft.mode}
                    />
                    <SelectField
                        label={t('settings.learning_companion.identity.ai_template', 'Guarded template')}
                        onChange={(value) =>
                            update('ai_template_id', nullable(value))
                        }
                        options={[
                            ['', t('settings.learning_companion.identity.ai_template_empty', 'No template selected')],
                            ...settings.ai_template_options.map(
                                (template) =>
                                    [
                                        template.id,
                                        `${template.name}${template.enabled ? '' : t('settings.learning_companion.identity.ai_template_disabled', ' (disabled)')}`,
                                    ] as [string, string],
                            ),
                        ]}
                        value={draft.ai_template_id ?? ''}
                    />
                </div>
                <div>
                    <p className="text-sm font-semibold">{t('settings.learning_companion.identity.allowed_context', 'Allowed context')}</p>
                    <p className="mt-1 text-sm text-[var(--settings-muted-text)]">
                        {t('settings.learning_companion.identity.allowed_context_description', 'Choose at most three source-defined capabilities. The server intersects these with each authored AI node.')}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {capabilities.map(([value, label]) => (
                            <label
                                className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm"
                                key={value}
                            >
                                <input
                                    checked={draft.ai_capabilities.includes(
                                        value,
                                    )}
                                    disabled={
                                        !draft.ai_capabilities.includes(
                                            value,
                                        ) && draft.ai_capabilities.length >= 3
                                    }
                                    onChange={(event) =>
                                        update(
                                            'ai_capabilities',
                                            event.target.checked
                                                ? [
                                                      ...draft.ai_capabilities,
                                                      value,
                                                  ]
                                                : draft.ai_capabilities.filter(
                                                      (item) => item !== value,
                                                  ),
                                        )
                                    }
                                    type="checkbox"
                                />
                                {t(`settings.learning_companion.identity.capabilities.${value}`, label)}
                            </label>
                        ))}
                    </div>
                </div>
            </fieldset>
        </section>
    );
}

function DialogueWorkspace() {
    const t = usePlatformTranslation();
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<DialogueSummary[]>([]);
    const [lastPage, setLastPage] = useState(1);
    const [selected, setSelected] = useState<DialogueResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [assignmentOpen, setAssignmentOpen] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data, response } = await apiClient.GET(
                '/admin/learning-companion/dialogues',
                {
                    params: {
                        query: {
                            page,
                            per_page: 6,
                            search: search || undefined,
                        },
                    },
                },
            );
            if (!response.ok || !data)
                throw new Error('The dialogue graphs could not be loaded.');
            setItems(data.items);
            setLastPage(data.pagination.last_page);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The dialogue graphs could not be loaded.',
            );
        } finally {
            setLoading(false);
        }
    }, [page, search]);
    useEffect(() => {
        void load();
    }, [load]);
    const choose = async (id: string) => {
        setError('');
        try {
            const { data, response } = await apiClient.GET(
                '/admin/learning-companion/dialogues/{dialogue_id}',
                { params: { path: { dialogue_id: id } } },
            );
            if (!response.ok || !data)
                throw new Error('The dialogue graph could not be loaded.');
            setSelected(data);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The dialogue graph could not be loaded.',
            );
        }
    };
    const create = async () => {
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/learning-companion/dialogues',
                {
                    body: {
                        name: 'New companion dialogue',
                        dialogue_graph:
                            defaultGraph() as unknown as components['schemas']['LearningCompanionDialogueGraph'],
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data)
                throw new Error('The dialogue graph could not be created.');
            setSelected(data);
            setEditorOpen(true);
            await load();
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The dialogue graph could not be created.',
            );
        } finally {
            setSaving(false);
        }
    };
    const remove = async () => {
        if (!selected || !window.confirm(`Delete ${selected.name}?`)) return;
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/learning-companion/dialogues/{dialogue_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { dialogue_id: selected.id },
                    },
                },
            );
            if (!response.ok) throw new Error();
            setSelected(null);
            await load();
        } catch {
            setError('The dialogue graph could not be deleted.');
        } finally {
            setSaving(false);
        }
    };
    return (
        <section
            className="flex min-h-[38rem] flex-col"
            data-wl-id="admin.learning-companion.dialogues"
        >
            <header className="mb-5">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    {t('settings.learning_companion.dialogues.eyebrow', 'Learning Companion')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{t('settings.learning_companion.dialogues.title', 'Dialogues')}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {t('settings.learning_companion.dialogues.description', 'Create bounded message, choice, AI and end nodes, then assign each graph only to content you may author.')}
                </p>
            </header>
            {error ? (
                <p
                    className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="flex min-h-0 flex-col rounded-xl border border-[var(--settings-border-color)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="font-semibold">
                                {selected?.name ?? t('settings.learning_companion.dialogues.selected_graph', 'Selected graph')}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--settings-muted-text)]">
                                {selected
                                    ? t('settings.learning_companion.dialogues.selection_summary', ':nodes nodes · :assignments assignments', { assignments: selected.assignments_count, nodes: graphOf(selected).nodes.length })
                                    : t('settings.learning_companion.dialogues.selection_empty', 'Select a graph or create one to begin.')}
                            </p>
                        </div>
                        {selected ? (
                            <button
                                aria-label={t('settings.learning_companion.dialogues.delete_graph', 'Delete graph')}
                                className="rounded-md p-2 text-red-700 hover:bg-red-500/10 dark:text-red-300"
                                disabled={saving}
                                onClick={() => void remove()}
                                type="button"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        ) : null}
                    </div>
                    {selected ? (
                        <div className="mt-auto grid gap-3">
                            <div className="rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)]/40 p-4">
                                <p className="text-sm leading-6 text-[var(--settings-muted-text)]">
                                    {t('settings.learning_companion.dialogues.selection_description', 'The graph stays authored and transient: navigation keys are resolved by Rust, and AI runs use only their bounded server context.')}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950"
                                    onClick={() => setEditorOpen(true)}
                                    type="button"
                                >
                                    <Pencil className="size-4" />
                                    {t('settings.learning_companion.dialogues.open_editor', 'Open graph editor')}
                                </button>
                                <button
                                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium"
                                    onClick={() => setAssignmentOpen(true)}
                                    type="button"
                                >
                                    <Link2 className="size-4" />
                                    {t('settings.learning_companion.dialogues.assign_pages', 'Assign pages')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="m-auto text-center text-sm text-[var(--settings-muted-text)]">
                            {loading
                                ? t('settings.learning_companion.dialogues.loading', 'Loading dialogue graphs…')
                                : t('settings.learning_companion.dialogues.empty', 'Create a graph to give the companion an authored conversation.')}
                        </p>
                    )}
                </section>
                <section className="flex min-h-0 flex-col rounded-xl border border-[var(--settings-border-color)] p-4">
                    <div className="flex gap-2">
                        <form
                            className="flex min-w-0 flex-1 gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                setPage(1);
                                setSearch(searchInput.trim());
                            }}
                        >
                            <input
                                aria-label={t('settings.learning_companion.dialogues.search_label', 'Search dialogue graphs')}
                                className={input}
                                onChange={(event) =>
                                    setSearchInput(event.target.value)
                                }
                                placeholder={t('settings.learning_companion.dialogues.search_placeholder', 'Search graphs')}
                                value={searchInput}
                            />
                            <button
                                className="rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm"
                                type="submit"
                            >
                                {t('settings.learning_companion.dialogues.search', 'Search')}
                            </button>
                        </form>
                        <button
                            aria-label={t('settings.learning_companion.dialogues.new_graph', 'New graph')}
                            className="rounded-md bg-[var(--settings-accent)] p-2 text-slate-950 disabled:opacity-50"
                            disabled={saving}
                            onClick={() => void create()}
                            type="button"
                        >
                            <Plus className="size-5" />
                        </button>
                    </div>
                    <div className="mt-4 grid content-start gap-2">
                        {items.map((item) => (
                            <button
                                className={`rounded-lg border px-3 py-3 text-left ${selected?.id === item.id ? 'border-[var(--settings-accent)] bg-[var(--settings-active-background)]' : 'border-[var(--settings-border-color)] hover:border-[var(--settings-accent)]/60'}`}
                                key={item.id}
                                onClick={() => void choose(item.id)}
                                type="button"
                            >
                                <span className="block truncate text-sm font-semibold">
                                    {item.name}
                                </span>
                                <span className="mt-1 block text-xs text-[var(--settings-muted-text)]">
                                    {t('settings.learning_companion.dialogues.assignments_count', ':count assigned', { count: item.assignments_count })} ·{' '}
                                    {new Date(
                                        item.updated_at,
                                    ).toLocaleDateString()}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-[var(--settings-border-color)] pt-3 text-sm">
                        <button
                            aria-label={t('settings.learning_companion.dialogues.previous_page', 'Previous graph page')}
                            className="rounded p-2 disabled:opacity-40"
                            disabled={page <= 1}
                            onClick={() => setPage((value) => value - 1)}
                            type="button"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <span>
                            {t('settings.learning_companion.dialogues.page', 'Page :page of :lastPage', { lastPage, page })}
                        </span>
                        <button
                            aria-label={t('settings.learning_companion.dialogues.next_page', 'Next graph page')}
                            className="rounded p-2 disabled:opacity-40"
                            disabled={page >= lastPage}
                            onClick={() => setPage((value) => value + 1)}
                            type="button"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </section>
            </div>
            {editorOpen && selected ? (
                <DialogueEditor
                    dialogue={selected}
                    onClose={() => setEditorOpen(false)}
                    onSaved={(next) => {
                        setSelected(next);
                        void load();
                    }}
                />
            ) : null}
            {assignmentOpen && selected ? (
                <AssignmentDialog
                    dialogue={selected}
                    onClose={() => setAssignmentOpen(false)}
                    onSaved={(assignments_count) => {
                        setSelected((current) =>
                            current
                                ? { ...current, assignments_count }
                                : current,
                        );
                        void load();
                    }}
                />
            ) : null}
        </section>
    );
}

function DialogueEditor({
    dialogue,
    onClose,
    onSaved,
}: {
    dialogue: DialogueResponse;
    onClose: () => void;
    onSaved: (dialogue: DialogueResponse) => void;
}) {
    const t = usePlatformTranslation();
    const [name, setName] = useState(dialogue.name);
    const [graph, setGraph] = useState(graphOf(dialogue));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/learning-companion/dialogues/{dialogue_id}',
                {
                    body: {
                        name: name.trim(),
                        dialogue_graph:
                            graph as unknown as components['schemas']['LearningCompanionDialogueGraph'],
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { dialogue_id: dialogue.id },
                    },
                },
            );
            if (!response.ok || !data)
                throw new Error('The dialogue graph could not be saved.');
            onSaved(data);
            onClose();
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The dialogue graph could not be saved.',
            );
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal label={t('settings.learning_companion.dialogue_editor.modal_label', 'Companion dialogue graph editor')} onClose={onClose}>
            <div className="flex min-h-0 flex-1 flex-col gap-4">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-200">
                            {t('settings.learning_companion.dialogue_editor.eyebrow', 'Dialogue graph')}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold">
                            {t('settings.learning_companion.dialogue_editor.title', 'Graph editor')}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {t('settings.learning_companion.dialogue_editor.description', 'Connect source-shaped nodes through their configured next step or choice target.')}
                        </p>
                    </div>
                    <button
                        aria-label={t('settings.learning_companion.dialogue_editor.close', 'Close graph editor')}
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </header>
                <Field label={t('settings.learning_companion.dialogue_editor.graph_name', 'Graph name')}>
                    <input
                        className={input}
                        maxLength={120}
                        onChange={(event) => setName(event.target.value)}
                        value={name}
                    />
                </Field>
                {error ? (
                    <p
                        className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-200"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                <GraphEditor graph={graph} onChange={setGraph} />
                <footer className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="min-h-11 rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-teal-300 dark:text-slate-950"
                        disabled={busy || !name.trim()}
                        onClick={() => void save()}
                        type="button"
                    >
                        <Save className="size-4" />
                        {busy ? t('settings.learning_companion.saving', 'Saving…') : t('settings.learning_companion.dialogue_editor.save', 'Save graph')}
                    </button>
                </footer>
            </div>
        </Modal>
    );
}

function GraphEditor({
    graph,
    onChange,
}: {
    graph: DialogueGraph;
    onChange: (graph: DialogueGraph) => void;
}) {
    const t = usePlatformTranslation();
    const [editing, setEditing] = useState<DialogueNode | null>(null);
    const [adding, setAdding] = useState(false);
    const [pending, setPending] = useState<DialogueNode | null>(null);
    const nodes = useMemo<DialogueFlowNode[]>(
        () => [
            {
                id: 'start',
                type: 'start',
                data: { start: true },
                position: { x: 20, y: 145 },
            },
            ...graph.nodes.map((node, index) => ({
                id: node.id,
                type: 'dialogue' as const,
                data: { node },
                position: node.position ?? {
                    x: 250 + (index % 3) * 280,
                    y: 45 + Math.floor(index / 3) * 190,
                },
            })),
        ],
        [graph.nodes],
    );
    const edges = useMemo<Edge[]>(() => {
        const result: Edge[] = graph.start
            ? [
                  {
                      id: `start-${graph.start}`,
                      source: 'start',
                      target: graph.start,
                      markerEnd: { type: MarkerType.ArrowClosed },
                      style: { stroke: '#0f766e', strokeWidth: 2 },
                  },
              ]
            : [];
        graph.nodes.forEach((node) => {
            if (node.next) result.push(edge(node.id, node.next, 'next'));
            node.choices?.forEach((choice, index) => {
                if (choice.next)
                    result.push(edge(node.id, choice.next, `choice-${index}`));
            });
        });
        return result;
    }, [graph]);
    const saveNode = (node: DialogueNode) => {
        const exists = graph.nodes.some((item) => item.id === node.id);
        if (!node.id || !node.title || (!exists && graph.nodes.length >= 24))
            return;
        onChange({
            ...graph,
            nodes: exists
                ? graph.nodes.map((item) => (item.id === node.id ? node : item))
                : [
                      ...graph.nodes,
                      {
                          ...node,
                          position: node.position ?? {
                              x: 250 + (graph.nodes.length % 3) * 280,
                              y: 45 + Math.floor(graph.nodes.length / 3) * 190,
                          },
                      },
                  ],
            start: graph.start || node.id,
        });
        setEditing(null);
        setAdding(false);
    };
    const deleteNode = () => {
        if (!pending || graph.nodes.length <= 1) return;
        const nodes = graph.nodes
            .filter((node) => node.id !== pending.id)
            .map((node) => ({
                ...node,
                next: node.next === pending.id ? undefined : node.next,
                choices: node.choices?.map((choice) =>
                    choice.next === pending.id
                        ? { ...choice, next: undefined }
                        : choice,
                ),
            }));
        onChange({
            ...graph,
            nodes,
            start: graph.start === pending.id ? nodes[0].id : graph.start,
        });
        setPending(null);
    };
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold">{t('settings.learning_companion.dialogue_editor.flow_title', 'Conversation flow')}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {t('settings.learning_companion.dialogue_editor.flow_description', 'The canvas reflects authored flow. Select a card to edit its content, capabilities and outgoing targets.')}
                    </p>
                </div>
                <button
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 dark:border-teal-200 dark:text-teal-100"
                    onClick={() => {
                        setEditing(blankNode(graph.nodes.length));
                        setAdding(true);
                    }}
                    type="button"
                >
                    <Plus className="size-4" />
                    {t('settings.learning_companion.dialogue_editor.add_node', 'Add node')}
                </button>
            </div>
            <div className="relative min-h-[25rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
                <ReactFlow
                    edges={edges}
                    fitView
                    minZoom={0.25}
                    nodeTypes={{ dialogue: DialogueCard, start: StartCard }}
                    nodes={nodes}
                    onNodeClick={(_, node) => {
                        if (node.id !== 'start' && node.data.node)
                            setEditing(node.data.node);
                    }}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background gap={20} />
                    <Controls />
                </ReactFlow>
            </div>
            {editing ? (
                <NodeDialog
                    editing={!adding}
                    graph={graph}
                    node={editing}
                    onClose={() => {
                        setEditing(null);
                        setAdding(false);
                    }}
                    onDelete={() => {
                        setPending(editing);
                        setEditing(null);
                        setAdding(false);
                    }}
                    onSave={saveNode}
                />
            ) : null}
            {pending ? (
                <ConfirmDelete
                    title={pending.title ?? pending.id}
                    onCancel={() => setPending(null)}
                    onConfirm={deleteNode}
                />
            ) : null}
        </div>
    );
}

function AssignmentDialog({
    dialogue,
    onClose,
    onSaved,
}: {
    dialogue: DialogueResponse;
    onClose: () => void;
    onSaved: (count: number) => void;
}) {
    const t = usePlatformTranslation();
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<AssignmentTarget[]>([]);
    const [selected, setSelected] = useState<Assignment[]>([]);
    const [lastPage, setLastPage] = useState(1);
    const [busy, setBusy] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        setBusy(true);
        try {
            const { data, response } = await apiClient.GET(
                '/admin/learning-companion/dialogues/{dialogue_id}/assignments',
                {
                    params: {
                        path: { dialogue_id: dialogue.id },
                        query: {
                            page,
                            per_page: 6,
                            search: search || undefined,
                        },
                    },
                },
            );
            if (!response.ok || !data)
                throw new Error('The assignment targets could not be loaded.');
            setItems(data.items);
            setLastPage(data.pagination.last_page);
            setSelected(data.selected);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The assignment targets could not be loaded.',
            );
        } finally {
            setBusy(false);
        }
    }, [dialogue.id, page, search]);
    useEffect(() => {
        void load();
    }, [load]);
    const toggle = (target: AssignmentTarget) =>
        setSelected((current) =>
            current.some(
                (item) =>
                    item.scope_id === target.scope_id &&
                    item.scope_type === target.scope_type,
            )
                ? current.filter(
                      (item) =>
                          item.scope_id !== target.scope_id ||
                          item.scope_type !== target.scope_type,
                  )
                : [
                      ...current,
                      {
                          scope_id: target.scope_id,
                          scope_type: target.scope_type,
                      },
                  ],
        );
    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PUT(
                '/admin/learning-companion/dialogues/{dialogue_id}/assignments',
                {
                    body: { assignments: selected },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { dialogue_id: dialogue.id },
                    },
                },
            );
            if (!response.ok || !data)
                throw new Error('The assignments could not be saved.');
            onSaved(data.assignments_count);
            onClose();
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The assignments could not be saved.',
            );
        } finally {
            setSaving(false);
        }
    };
    return (
        <Modal label={t('settings.learning_companion.dialogue_assignment.modal_label', 'Assign companion dialogue')} onClose={onClose}>
            <div className="flex min-h-0 flex-1 flex-col">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold">
                            {t('settings.learning_companion.dialogue_assignment.title', 'Assign authored pages')}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {t('settings.learning_companion.dialogue_assignment.description', 'Choose only the worlds, maps, places or activities where this graph may be used.')}
                        </p>
                    </div>
                    <button
                        aria-label={t('settings.learning_companion.dialogue_assignment.close', 'Close assignments')}
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </header>
                <form
                    className="mt-5 flex gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setPage(1);
                        setSearch(searchInput.trim());
                    }}
                >
                    <input
                        aria-label={t('settings.learning_companion.dialogue_assignment.search_label', 'Search authored pages')}
                        className={input}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder={t('settings.learning_companion.dialogue_assignment.search_placeholder', 'Search worlds, maps, places or activities')}
                        value={searchInput}
                    />
                    <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-white/15"
                        type="submit"
                    >
                        {t('settings.learning_companion.dialogues.search', 'Search')}
                    </button>
                </form>
                {error ? (
                    <p
                        className="mt-3 text-sm text-red-700 dark:text-red-300"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
                    {busy ? (
                        <p className="py-8 text-center text-sm text-slate-500">
                            {t('settings.learning_companion.dialogue_assignment.loading', 'Loading assignment targets…')}
                        </p>
                    ) : (
                        items.map((item) => {
                            const checked = selected.some(
                                (value) =>
                                    value.scope_id === item.scope_id &&
                                    value.scope_type === item.scope_type,
                            );
                            return (
                                <label
                                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:border-teal-600 dark:border-white/10 dark:hover:border-teal-200"
                                    key={`${item.scope_type}:${item.scope_id}`}
                                >
                                    <input
                                        checked={checked}
                                        className="size-4 accent-teal-700"
                                        onChange={() => toggle(item)}
                                        type="checkbox"
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                            {item.label}
                                        </span>
                                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                            {item.scope_type} · {item.context}
                                        </span>
                                    </span>
                                </label>
                            );
                        })
                    )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-white/10">
                    <button
                        aria-label={t('settings.learning_companion.dialogue_assignment.previous_page', 'Previous assignment page')}
                        className="rounded p-2 disabled:opacity-40"
                        disabled={page <= 1}
                        onClick={() => setPage((value) => value - 1)}
                        type="button"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <span>
                        {t('settings.learning_companion.dialogue_assignment.page', 'Page :page of :lastPage', { lastPage, page })}
                    </span>
                    <button
                        aria-label={t('settings.learning_companion.dialogue_assignment.next_page', 'Next assignment page')}
                        className="rounded p-2 disabled:opacity-40"
                        disabled={page >= lastPage}
                        onClick={() => setPage((value) => value + 1)}
                        type="button"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>
                <footer className="mt-4 flex justify-end border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-teal-300 dark:text-slate-950"
                        disabled={saving}
                        onClick={() => void save()}
                        type="button"
                    >
                        <Save className="size-4" />
                        {saving ? t('settings.learning_companion.saving', 'Saving…') : t('settings.learning_companion.dialogue_assignment.save', 'Save assignments')}
                    </button>
                </footer>
            </div>
        </Modal>
    );
}

function DialogueCard({ data }: { data: { node?: DialogueNode } }) {
    const t = usePlatformTranslation();
    const node = data.node;
    if (!node) return null;
    return (
        <div className="w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-slate-900">
            <Handle
                className="!size-3 !bg-teal-700"
                position={Position.Left}
                type="target"
            />
            <Handle
                className="!size-3 !bg-teal-700"
                position={Position.Right}
                type="source"
            />
            <p className="text-xs font-medium tracking-[0.14em] text-teal-700 uppercase dark:text-teal-200">
                {node.type}
            </p>
            <h4 className="mt-1 text-sm font-semibold">{node.title}</h4>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {node.message ??
                    node.prompt ??
                    node.instruction ??
                    t('settings.learning_companion.graph.no_text', 'No text yet.')}
            </p>
        </div>
    );
}
function StartCard() {
    const t = usePlatformTranslation();
    return (
        <div className="w-32 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-lg dark:border-white/10 dark:bg-slate-900">
            <Handle
                className="!size-3 !bg-teal-700"
                position={Position.Right}
                type="source"
            />
            <p className="text-sm font-semibold">{t('settings.learning_companion.graph.start', 'Start')}</p>
        </div>
    );
}
function NodeDialog({
    editing,
    graph,
    node,
    onClose,
    onDelete,
    onSave,
}: {
    editing: boolean;
    graph: DialogueGraph;
    node: DialogueNode;
    onClose: () => void;
    onDelete: () => void;
    onSave: (node: DialogueNode) => void;
}) {
    const t = usePlatformTranslation();
    const [draft, setDraft] = useState(node);
    const update = <K extends keyof DialogueNode>(
        key: K,
        value: DialogueNode[K],
    ) => setDraft((current) => ({ ...current, [key]: value }));
    const targets = graph.nodes
        .filter((candidate) => candidate.id !== node.id)
        .map(
            (candidate) =>
                [candidate.id, candidate.title ?? candidate.id] as [
                    string,
                    string,
                ],
        );
    const updateChoice = (index: number, next: DialogueChoice) =>
        update(
            'choices',
            (draft.choices ?? []).map((choice, choiceIndex) =>
                choiceIndex === index ? next : choice,
            ),
        );
    return (
        <Modal
            label={
                editing
                    ? t('settings.learning_companion.node_editor.edit_modal', 'Edit companion dialogue node')
                    : t('settings.learning_companion.node_editor.add_modal', 'Add companion dialogue node')
            }
            onClose={onClose}
        >
            <div className="flex min-h-0 flex-1 flex-col">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold">
                            {editing
                                ? t('settings.learning_companion.node_editor.edit_title', 'Edit dialogue node')
                                : t('settings.learning_companion.node_editor.add_title', 'Add dialogue node')}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {t('settings.learning_companion.node_editor.description', 'Each node has a bounded type and source-defined flow.')}
                        </p>
                    </div>
                    {editing ? (
                        <button
                            className="inline-flex items-center gap-2 text-sm text-red-700 dark:text-red-300"
                            onClick={onDelete}
                            type="button"
                        >
                            <Trash2 className="size-4" />
                            {t('common.delete', 'Delete')}
                        </button>
                    ) : null}
                </header>
                <div className="mt-5 grid gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
                    <SelectField
                        label={t('settings.learning_companion.node_editor.type', 'Node type')}
                        onChange={(value) => update('type', value as NodeType)}
                        options={[
                            ['message', t('settings.learning_companion.node_editor.types.message', 'Message')],
                            ['choice', t('settings.learning_companion.node_editor.types.choice', 'Choice')],
                            ['ai', 'AI'],
                            ['end', t('settings.learning_companion.node_editor.types.end', 'End')],
                        ]}
                        value={draft.type}
                    />
                    <Field label={t('settings.learning_companion.node_editor.id', 'Node id')}>
                        <input
                            className={input}
                            disabled={editing}
                            maxLength={80}
                            onChange={(event) =>
                                update(
                                    'id',
                                    event.target.value.replace(
                                        /[^a-zA-Z0-9_-]/g,
                                        '',
                                    ),
                                )
                            }
                            value={draft.id}
                        />
                    </Field>
                    <Field label={t('settings.learning_companion.node_editor.title', 'Title')}>
                        <input
                            className={input}
                            maxLength={120}
                            onChange={(event) =>
                                update('title', event.target.value)
                            }
                            value={draft.title ?? ''}
                        />
                    </Field>
                    {draft.type === 'choice' ? (
                        <Field label={t('settings.learning_companion.node_editor.prompt', 'Prompt')}>
                            <textarea
                                className={`${input} min-h-24`}
                                maxLength={1200}
                                onChange={(event) =>
                                    update('prompt', event.target.value)
                                }
                                value={draft.prompt ?? ''}
                            />
                        </Field>
                    ) : draft.type === 'ai' ? (
                        <>
                            <Field label={t('settings.learning_companion.node_editor.instruction', 'Authored instruction')}>
                                <textarea
                                    className={`${input} min-h-24`}
                                    maxLength={1200}
                                    onChange={(event) =>
                                        update(
                                            'instruction',
                                            event.target.value,
                                        )
                                    }
                                    value={draft.instruction ?? ''}
                                />
                            </Field>
                            <SelectField
                                label={t('settings.learning_companion.node_editor.response_mode', 'Response mode')}
                                onChange={(value) =>
                                    update(
                                        'response_mode',
                                        value as 'choice' | 'message',
                                    )
                                }
                                options={[
                                    ['message', t('settings.learning_companion.node_editor.types.message', 'Message')],
                                    ['choice', t('settings.learning_companion.node_editor.types.choice', 'Choice')],
                                ]}
                                value={draft.response_mode ?? 'message'}
                            />
                        </>
                    ) : (
                        <Field label={t('settings.learning_companion.node_editor.message', 'Message')}>
                            <textarea
                                className={`${input} min-h-24`}
                                maxLength={1200}
                                onChange={(event) =>
                                    update('message', event.target.value)
                                }
                                value={draft.message ?? ''}
                            />
                        </Field>
                    )}
                    {draft.type === 'message' || draft.type === 'ai' ? (
                        <SelectField
                            label={t('settings.learning_companion.node_editor.continue_to', 'Continue to')}
                            onChange={(value) =>
                                update('next', nullable(value) ?? undefined)
                            }
                            options={[['', t('settings.learning_companion.node_editor.end_path', 'End this path')], ...targets]}
                            value={draft.next ?? ''}
                        />
                    ) : null}
                </div>
                {draft.type === 'ai' ? (
                    <fieldset className="mt-5 grid gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                        <legend className="text-sm font-semibold">
                            {t('settings.learning_companion.node_editor.allowed_capabilities', 'Allowed capabilities')}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {capabilities.map(([value, label]) => (
                                <label
                                    className="flex items-center gap-2 text-sm"
                                    key={value}
                                >
                                    <input
                                        checked={(
                                            draft.capabilities ?? []
                                        ).includes(value)}
                                        onChange={(event) =>
                                            update(
                                                'capabilities',
                                                event.target.checked
                                                    ? [
                                                          ...(draft.capabilities ??
                                                              []),
                                                          value,
                                                      ]
                                                    : (
                                                          draft.capabilities ??
                                                          []
                                                      ).filter(
                                                          (item) =>
                                                              item !== value,
                                                      ),
                                            )
                                        }
                                        type="checkbox"
                                    />
                                    {t(`settings.learning_companion.identity.capabilities.${value}`, label)}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                ) : null}
                {draft.type === 'choice' ? (
                    <section className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{t('settings.learning_companion.node_editor.choices', 'Choices')}</h3>
                            <button
                                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-white/15"
                                onClick={() =>
                                    update('choices', [
                                        ...(draft.choices ?? []),
                                        {
                                            key: `choice-${(draft.choices?.length ?? 0) + 1}`,
                                            label: t('settings.learning_companion.node_editor.new_choice', 'New choice'),
                                        },
                                    ])
                                }
                                type="button"
                            >
                                <Plus className="size-4" />
                                {t('settings.learning_companion.node_editor.add_choice', 'Add choice')}
                            </button>
                        </div>
                        <div className="mt-3 grid gap-3">
                            {(draft.choices ?? []).map((choice, index) => (
                                <div
                                    className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] dark:border-white/10"
                                    key={`${choice.key}-${index}`}
                                >
                                    <input
                                        aria-label={t('settings.learning_companion.node_editor.choice_label', 'Choice :number label', { number: index + 1 })}
                                        className={input}
                                        onChange={(event) =>
                                            updateChoice(index, {
                                                ...choice,
                                                label: event.target.value,
                                            })
                                        }
                                        value={choice.label}
                                    />
                                    <SelectField
                                        label={t('settings.learning_companion.node_editor.destination', 'Destination')}
                                        onChange={(value) =>
                                            updateChoice(index, {
                                                ...choice,
                                                action: undefined,
                                                next:
                                                    nullable(value) ??
                                                    undefined,
                                            })
                                        }
                                        options={[
                                            [
                                                '',
                                                t('settings.learning_companion.node_editor.no_destination', 'Server action / no destination'),
                                            ],
                                            ...targets,
                                        ]}
                                        value={choice.next ?? ''}
                                    />
                                    <button
                                        aria-label={t('settings.learning_companion.node_editor.remove_choice', 'Remove choice :number', { number: index + 1 })}
                                        className="rounded-md p-2 text-red-700 hover:bg-red-500/10 dark:text-red-300"
                                        onClick={() =>
                                            update(
                                                'choices',
                                                (draft.choices ?? []).filter(
                                                    (_, choiceIndex) =>
                                                        choiceIndex !== index,
                                                ),
                                            )
                                        }
                                        type="button"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                    <SelectField
                                        label={t('settings.learning_companion.node_editor.server_action', 'Server action')}
                                        onChange={(value) =>
                                            updateChoice(index, {
                                                ...choice,
                                                action:
                                                    nullable(value) ??
                                                    undefined,
                                                next: undefined,
                                            })
                                        }
                                        options={[
                                            ['', t('settings.learning_companion.node_editor.no_server_action', 'No server action')],
                                            ...actions,
                                        ]}
                                        value={choice.action ?? ''}
                                    />
                                    <input
                                        aria-label={t('settings.learning_companion.node_editor.choice_key', 'Choice :number key', { number: index + 1 })}
                                        className={input}
                                        onChange={(event) =>
                                            updateChoice(index, {
                                                ...choice,
                                                key: event.target.value.replace(
                                                    /[^a-zA-Z0-9_-]/g,
                                                    '',
                                                ),
                                            })
                                        }
                                        value={choice.key}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}
                <footer className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="min-h-11 rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-teal-300 dark:text-slate-950"
                        disabled={!draft.id || !draft.title}
                        onClick={() => onSave(draft)}
                        type="button"
                    >
                        <Save className="size-4" />
                        {t('settings.learning_companion.node_editor.save', 'Save node')}
                    </button>
                </footer>
            </div>
        </Modal>
    );
}
function ConfirmDelete({
    title,
    onCancel,
    onConfirm,
}: {
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const t = usePlatformTranslation();
    return (
        <Modal label={t('settings.learning_companion.node_delete.modal_label', 'Delete companion dialogue node')} onClose={onCancel}>
            <div>
                <h2 className="text-xl font-semibold">{t('settings.learning_companion.node_delete.title', 'Delete :title?', { title })}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {t('settings.learning_companion.node_delete.description', 'Its incoming and outgoing connections will be removed from this graph.')}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        className="min-h-11 rounded-md px-3 py-2 text-sm"
                        onClick={onCancel}
                        type="button"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        className="min-h-11 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white"
                        onClick={onConfirm}
                        type="button"
                    >
                        {t('common.delete', 'Delete')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
function Avatar({
    settings,
}: {
    settings: Pick<
        SettingsRequest,
        | 'avatar_color'
        | 'avatar_position_x'
        | 'avatar_position_y'
        | 'avatar_scale'
        | 'avatar_url'
    >;
}) {
    return settings.avatar_url ? (
        <img
            alt=""
            className="size-full object-cover"
            src={settings.avatar_url}
            style={{
                objectPosition: `${settings.avatar_position_x}% ${settings.avatar_position_y}%`,
                transform: `scale(${settings.avatar_scale / 100})`,
            }}
        />
    ) : (
        <Bot className="size-10 text-white" />
    );
}
function Field({ children, label }: { children: ReactNode; label: string }) {
    return (
        <label className="grid gap-1 text-sm font-medium">
            <span>{label}</span>
            {children}
        </label>
    );
}
function SelectField({
    label,
    onChange,
    options,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    options: readonly (readonly [string, string])[];
    value: string;
}) {
    return (
        <Field label={label}>
            <select
                className={input}
                onChange={(event) => onChange(event.target.value)}
                value={value}
            >
                {options.map(([key, text]) => (
                    <option key={key} value={key}>
                        {text}
                    </option>
                ))}
            </select>
        </Field>
    );
}
function RangeField({
    disabled,
    label,
    max,
    min,
    onChange,
    value,
}: {
    disabled: boolean;
    label: string;
    max: number;
    min: number;
    onChange: (value: number) => void;
    value: number;
}) {
    return (
        <Field label={label}>
            <input
                aria-label={label}
                className="w-full accent-teal-700"
                disabled={disabled}
                max={max}
                min={min}
                onChange={(event) => onChange(Number(event.target.value))}
                type="range"
                value={value}
            />
            <span className="text-xs font-normal text-[var(--settings-muted-text)]">
                {value}%
            </span>
        </Field>
    );
}
function Modal({
    children,
    label,
    onClose,
}: {
    children: ReactNode;
    label: string;
    onClose: () => void;
}) {
    useEffect(() => {
        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-3 sm:p-6">
            <section
                aria-label={label}
                aria-modal="true"
                className="flex max-h-[calc(100svh-1.5rem)] w-full max-w-6xl flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5 dark:border-white/10 dark:bg-slate-950"
                role="dialog"
            >
                {children}
            </section>
        </div>
    );
}
function toSettingsRequest(settings: Settings): SettingsRequest {
    const { ai_template_options: _options, ...request } = settings;
    return request;
}
function nullable(value: string): string | null {
    const trimmed = value.trim();
    return trimmed || null;
}
function graphOf(dialogue: DialogueResponse): DialogueGraph {
    const graph = dialogue.dialogue_graph as unknown as Partial<DialogueGraph>;
    const nodes = Array.isArray(graph.nodes)
        ? graph.nodes.filter((node): node is DialogueNode =>
              Boolean(
                  node &&
                  typeof node === 'object' &&
                  typeof (node as DialogueNode).id === 'string' &&
                  typeof (node as DialogueNode).type === 'string',
              ),
          )
        : [];
    return {
        version: 1,
        start:
            typeof graph.start === 'string'
                ? graph.start
                : (nodes[0]?.id ?? 'welcome'),
        nodes: nodes.length ? nodes : defaultGraph().nodes,
    };
}
function defaultGraph(): DialogueGraph {
    return {
        version: 1,
        start: 'welcome',
        nodes: [
            {
                id: 'welcome',
                type: 'message',
                title: 'Welcome',
                message: 'What would be helpful right now?',
            },
        ],
    };
}
function blankNode(index: number): DialogueNode {
    return {
        id: `node-${index + 1}`,
        type: 'message',
        title: 'New message',
        message: '',
    };
}
function edge(source: string, target: string, kind: string): Edge {
    return {
        id: `${source}-${kind}-${target}`,
        source,
        target,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#0f766e', strokeWidth: 2 },
    };
}
