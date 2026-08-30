import {
    Link2,
    LoaderCircle,
    Plus,
    Save,
    Search,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import { SettingsPanelHeader } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { readJsonResponse } from '@/lib/json-response';

type JsonPayload = {
    errors?: Record<string, string[]>;
    message?: string;
};

type PageMeta = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

type DialogueSummary = {
    assignmentsCount: number;
    id: number;
    name: string;
    updatedAt: string | null;
};

type Dialogue = DialogueSummary & {
    dialogueGraph: Record<string, unknown>;
};

type DialogueListResponse = {
    items: DialogueSummary[];
    pagination: PageMeta;
} & JsonPayload;

type DialogueResponse = Dialogue & JsonPayload;

type AssignmentTarget = {
    context: string;
    id: number;
    label: string;
    scopeType: string;
    selected: boolean;
};

type AssignmentResponse = {
    items: AssignmentTarget[];
    pagination: PageMeta;
    selected: string[];
} & JsonPayload;

const DIALOGUE_ENDPOINT = '/settings/companion/dialogues';

async function requestDialogueJson<T extends JsonPayload>(
    url: string,
    options: RequestInit = {},
): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers,
        },
    });

    return readJsonResponse<T>(response, 'The companion dialogue request failed.');
}

export function LearningCompanionDialoguesPanel() {
    const t = usePlatformTranslation();
    const [dialogues, setDialogues] = useState<DialogueSummary[]>([]);
    const [pagination, setPagination] = useState<PageMeta>({
        currentPage: 1,
        lastPage: 1,
        perPage: 6,
        total: 0,
    });
    const [listPage, setListPage] = useState(1);
    const [listSearch, setListSearch] = useState('');
    const [listSearchInput, setListSearchInput] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedDialogue, setSelectedDialogue] = useState<Dialogue | null>(
        null,
    );
    const [name, setName] = useState('');
    const [graphJson, setGraphJson] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [assignmentOpen, setAssignmentOpen] = useState(false);

    const loadDialogues = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                page: String(page),
                per_page: '6',
            });

            if (search) {
                params.set('search', search);
            }

            const payload = await requestDialogueJson<DialogueListResponse>(
                `${DIALOGUE_ENDPOINT}?${params.toString()}`,
            );
            setDialogues(payload.items);
            setPagination(payload.pagination);
            setSelectedId((current) =>
                payload.items.some((item) => item.id === current)
                    ? current
                    : (payload.items[0]?.id ?? null),
            );
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : t(
                          'settings.companion.dialogues.load_error',
                          'The dialogue graphs could not be loaded.',
                      ),
            );
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        // Loading the paginated collection synchronizes local state with the API.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDialogues(listPage, listSearch);
    }, [listPage, listSearch, loadDialogues]);

    useEffect(() => {
        if (selectedId === null) {
            return;
        }

        let cancelled = false;
        // Clear the previous request error before loading the selected record.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError('');
        void requestDialogueJson<DialogueResponse>(
            `${DIALOGUE_ENDPOINT}/${selectedId}`,
        )
            .then((payload) => {
                if (cancelled) {
                    return;
                }

                setSelectedDialogue(payload);
                setName(payload.name);
                setGraphJson(JSON.stringify(payload.dialogueGraph, null, 2));
            })
            .catch((requestError: unknown) => {
                if (!cancelled) {
                    setError(
                        requestError instanceof Error
                            ? requestError.message
                            : t(
                                  'settings.companion.dialogues.detail_error',
                                  'The selected dialogue graph could not be loaded.',
                              ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedId, t]);

    const createDialogue = async () => {
        setSaving(true);
        setError('');

        try {
            const payload = await requestDialogueJson<DialogueResponse>(
                DIALOGUE_ENDPOINT,
                {
                    body: JSON.stringify({
                        name: t(
                            'settings.companion.dialogues.new_name',
                            'New companion dialogue',
                        ),
                    }),
                    method: 'POST',
                },
            );
            setSelectedDialogue(payload);
            setName(payload.name);
            setGraphJson(JSON.stringify(payload.dialogueGraph, null, 2));
            setListPage(1);
            await loadDialogues(1, listSearch);
            setSelectedId(payload.id);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : '');
        } finally {
            setSaving(false);
        }
    };

    const saveDialogue = async () => {
        if (!selectedDialogue) {
            return;
        }

        let dialogueGraph: Record<string, unknown>;

        try {
            dialogueGraph = JSON.parse(graphJson) as Record<string, unknown>;
        } catch {
            setError(
                t(
                    'settings.companion.dialogues.invalid_json',
                    'The graph definition must be valid JSON.',
                ),
            );

            return;
        }

        setSaving(true);
        setError('');

        try {
            const payload = await requestDialogueJson<DialogueResponse>(
                `${DIALOGUE_ENDPOINT}/${selectedDialogue.id}`,
                {
                    body: JSON.stringify({ name, dialogue_graph: dialogueGraph }),
                    method: 'PATCH',
                },
            );
            setSelectedDialogue(payload);
            setName(payload.name);
            setGraphJson(JSON.stringify(payload.dialogueGraph, null, 2));
            await loadDialogues(listPage, listSearch);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : '');
        } finally {
            setSaving(false);
        }
    };

    const deleteDialogue = async () => {
        if (!selectedDialogue || !window.confirm('Delete this dialogue graph?')) {
            return;
        }

        setSaving(true);
        setError('');

        try {
            await requestDialogueJson<JsonPayload>(
                `${DIALOGUE_ENDPOINT}/${selectedDialogue.id}`,
                { method: 'DELETE' },
            );
            setSelectedDialogue(null);
            setSelectedId(null);
            await loadDialogues(listPage, listSearch);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : '');
        } finally {
            setSaving(false);
        }
    };

    const submitSearch = () => {
        setListPage(1);
        setListSearch(listSearchInput.trim());
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-5">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
                <SettingsPanelHeader
                    description={t(
                        'settings.companion.dialogues.description',
                        'Create bounded dialogue graphs and decide which authored learning surfaces may use each one.',
                    )}
                    eyebrow={t(
                        'settings.companion.dialogues.eyebrow',
                        'Learning Companion',
                    )}
                    icon={Link2}
                    title={t(
                        'settings.companion.dialogues.title',
                        'Dialogues',
                    )}
                />
                <Button disabled={saving} onClick={() => void createDialogue()}>
                    <Plus className="size-4" />
                    {t('settings.companion.dialogues.create', 'New graph')}
                </Button>
            </div>

            {error ? (
                <p className="shrink-0 rounded-md border border-red-400/40 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                    {error}
                </p>
            ) : null}

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(20rem,0.9fr)_minmax(24rem,1.1fr)]">
                <section className="flex min-h-0 flex-col rounded-xl border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4">
                    <div className="flex shrink-0 items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">
                                {t(
                                    'settings.companion.dialogues.selected',
                                    'Selected graph',
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-[var(--settings-muted-text)]">
                                {t(
                                    'settings.companion.dialogues.selected_description',
                                    'Edit its name and safe graph definition, then assign it to authored pages.',
                                )}
                            </p>
                        </div>
                        {selectedDialogue ? (
                            <Button
                                aria-label={t(
                                    'settings.companion.dialogues.delete',
                                    'Delete graph',
                                )}
                                disabled={saving}
                                onClick={() => void deleteDialogue()}
                                size="icon"
                                variant="destructive"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        ) : null}
                    </div>

                    {selectedDialogue ? (
                        <div className="mt-5 grid min-h-0 gap-4 overflow-auto pr-1">
                            <div className="grid gap-2">
                                <Label htmlFor="companion-dialogue-name">
                                    {t(
                                        'settings.companion.dialogues.name',
                                        'Graph name',
                                    )}
                                </Label>
                                <Input
                                    id="companion-dialogue-name"
                                    maxLength={120}
                                    onChange={(event) => setName(event.target.value)}
                                    value={name}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="companion-dialogue-graph">
                                    {t(
                                        'settings.companion.dialogues.definition',
                                        'Graph definition (JSON)',
                                    )}
                                </Label>
                                <textarea
                                    className="min-h-52 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                                    id="companion-dialogue-graph"
                                    onChange={(event) => setGraphJson(event.target.value)}
                                    value={graphJson}
                                />
                                <p className="text-xs leading-5 text-[var(--settings-muted-text)]">
                                    {t(
                                        'settings.companion.dialogues.definition_description',
                                        'The server validates node limits, targets, AI capabilities and navigation actions before a graph can be used.',
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button disabled={saving} onClick={() => void saveDialogue()}>
                                    <Save className="size-4" />
                                    {t('common.save', 'Save')}
                                </Button>
                                <Button
                                    disabled={saving}
                                    onClick={() => setAssignmentOpen(true)}
                                    variant="secondary"
                                >
                                    <Link2 className="size-4" />
                                    {t(
                                        'settings.companion.dialogues.assign',
                                        'Assign pages',
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-[var(--settings-muted-text)]">
                                {t(
                                    'settings.companion.dialogues.assignment_count',
                                    `${selectedDialogue.assignmentsCount} authored pages assigned`,
                                    { count: selectedDialogue.assignmentsCount },
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className="grid min-h-0 flex-1 place-items-center text-center text-sm text-[var(--settings-muted-text)]">
                            <p>
                                {loading
                                    ? t(
                                          'settings.companion.dialogues.loading',
                                          'Loading dialogue graphs...',
                                      )
                                    : t(
                                          'settings.companion.dialogues.empty',
                                          'Create a graph to give the companion an authored conversation.',
                                      )}
                            </p>
                        </div>
                    )}
                </section>

                <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-xl border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4">
                    <form
                        className="flex shrink-0 gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            submitSearch();
                        }}
                    >
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--settings-muted-text)]" />
                            <Input
                                aria-label={t(
                                    'settings.companion.dialogues.search',
                                    'Search dialogue graphs',
                                )}
                                className="pl-9"
                                onChange={(event) =>
                                    setListSearchInput(event.target.value)
                                }
                                placeholder={t(
                                    'settings.companion.dialogues.search_placeholder',
                                    'Search graphs',
                                )}
                                value={listSearchInput}
                            />
                        </div>
                        <Button type="submit" variant="secondary">
                            {t('common.search', 'Search')}
                        </Button>
                    </form>

                    <div className="min-h-0 py-4">
                        {loading ? (
                            <div className="grid h-full place-items-center text-sm text-[var(--settings-muted-text)]">
                                <LoaderCircle className="size-5 animate-spin" />
                            </div>
                        ) : dialogues.length > 0 ? (
                            <div className="grid content-start gap-2">
                                {dialogues.map((dialogue) => (
                                    <button
                                        className={`min-h-16 rounded-lg border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] ${
                                            selectedId === dialogue.id
                                                ? 'border-[var(--settings-accent)] bg-[var(--settings-active-background)]'
                                                : 'border-[var(--settings-border-color)] hover:border-[var(--settings-accent)]/60'
                                        }`}
                                        key={dialogue.id}
                                        onClick={() => setSelectedId(dialogue.id)}
                                        type="button"
                                    >
                                        <span className="flex items-center justify-between gap-3">
                                            <span className="min-w-0 truncate text-sm font-semibold">
                                                {dialogue.name}
                                            </span>
                                            <span className="shrink-0 text-xs text-[var(--settings-muted-text)]">
                                                {dialogue.assignmentsCount} {t(
                                                    'settings.companion.dialogues.assigned_short',
                                                    'assigned',
                                                )}
                                            </span>
                                        </span>
                                        <span className="mt-1 block text-xs text-[var(--settings-muted-text)]">
                                            {dialogue.updatedAt
                                                ? new Intl.DateTimeFormat(undefined, {
                                                      dateStyle: 'medium',
                                                  }).format(new Date(dialogue.updatedAt))
                                                : t('common.not_set', 'Not set')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="grid h-full place-items-center text-center text-sm text-[var(--settings-muted-text)]">
                                {t(
                                    'settings.companion.dialogues.no_results',
                                    'No dialogue graphs match this search.',
                                )}
                            </div>
                        )}
                    </div>

                    <PaginationControls
                        className="shrink-0 border-t border-[var(--settings-border-color)] pt-3 text-xs text-[var(--settings-muted-text)]"
                        currentPage={pagination.currentPage}
                        label={t(
                            'settings.companion.dialogues.pagination',
                            'Dialogue graph pagination',
                        )}
                        nextLabel={t(
                            'settings.companion.dialogues.next',
                            'Next graph page',
                        )}
                        onPageChange={setListPage}
                        pageCount={pagination.lastPage}
                        previousLabel={t(
                            'settings.companion.dialogues.previous',
                            'Previous graph page',
                        )}
                        showSinglePage
                    />
                </section>
            </div>

            {selectedDialogue ? (
                <CompanionAssignmentDialog
                    dialogue={selectedDialogue}
                    onOpenChange={setAssignmentOpen}
                    onSaved={(assignmentsCount) => {
                        setSelectedDialogue((current) =>
                            current ? { ...current, assignmentsCount } : current,
                        );
                        void loadDialogues(listPage, listSearch);
                    }}
                    open={assignmentOpen}
                />
            ) : null}
        </div>
    );
}

function CompanionAssignmentDialog({
    dialogue,
    onOpenChange,
    onSaved,
    open,
}: {
    dialogue: Dialogue;
    onOpenChange: (open: boolean) => void;
    onSaved: (assignmentsCount: number) => void;
    open: boolean;
}) {
    const t = usePlatformTranslation();
    const [items, setItems] = useState<AssignmentTarget[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [initialized, setInitialized] = useState(false);
    const [pagination, setPagination] = useState<PageMeta>({
        currentPage: 1,
        lastPage: 1,
        perPage: 6,
        total: 0,
    });
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) {
            return;
        }

        // The fetch effect synchronizes local loading state with an external request.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError('');
        const params = new URLSearchParams({
            page: String(page),
            per_page: '6',
        });

        if (search) {
            params.set('search', search);
        }

        void requestDialogueJson<AssignmentResponse>(
            `${DIALOGUE_ENDPOINT}/${dialogue.id}/assignments?${params.toString()}`,
        )
            .then((payload) => {
                setItems(payload.items);
                setPagination(payload.pagination);

                if (!initialized) {
                    setSelected(new Set(payload.selected));
                    setInitialized(true);
                }
            })
            .catch((requestError) =>
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : t(
                              'settings.companion.dialogues.assignments_load_error',
                              'The assignment targets could not be loaded.',
                          ),
                ),
            )
            .finally(() => setLoading(false));
    }, [dialogue.id, initialized, open, page, search, t]);

    useEffect(() => {
        if (!open) {
            // Reset the dialog's transient selection when its external open state changes.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setInitialized(false);
            setPage(1);
            setSearch('');
            setSearchInput('');
            setSelected(new Set());
        }
    }, [open]);

    const toggle = (key: string) => {
        setSelected((current) => {
            const next = new Set(current);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        setError('');

        try {
            const assignments = Array.from(selected).map((key) => {
                const [scope_type, scope_id] = key.split(':');

                return { scope_id: Number(scope_id), scope_type };
            });
            const payload = await requestDialogueJson<{
                assignmentsCount: number;
            } & JsonPayload>(`${DIALOGUE_ENDPOINT}/${dialogue.id}/assignments`, {
                body: JSON.stringify({ assignments }),
                method: 'PUT',
            });
            onSaved(payload.assignmentsCount);
            onOpenChange(false);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : '');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-h-[calc(100svh-3rem)] overflow-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            'settings.companion.dialogues.assign_title',
                            'Assign authored pages',
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'settings.companion.dialogues.assign_description',
                            'Choose the worlds, maps, places or activities where this companion graph may be used.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex shrink-0 gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setPage(1);
                        setSearch(searchInput.trim());
                    }}
                >
                    <Input
                        aria-label={t(
                            'settings.companion.dialogues.assign_search',
                            'Search authored pages',
                        )}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder={t(
                            'settings.companion.dialogues.assign_search_placeholder',
                            'Search worlds, maps, places or activities',
                        )}
                        value={searchInput}
                    />
                    <Button type="submit" variant="secondary">
                        <Search className="size-4" />
                        {t('common.search', 'Search')}
                    </Button>
                </form>
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
                <div className="grid min-h-0 gap-2 py-1">
                    {loading ? (
                        <div className="grid min-h-48 place-items-center">
                            <LoaderCircle className="size-5 animate-spin" />
                        </div>
                    ) : items.length > 0 ? (
                        items.map((item) => {
                            const key = `${item.scopeType}:${item.id}`;

                            return (
                                <label
                                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-[var(--settings-border-color)] px-3 py-2 hover:border-[var(--settings-accent)]/60"
                                    key={key}
                                >
                                    <input
                                        checked={selected.has(key)}
                                        className="size-4 accent-[var(--settings-accent)]"
                                        onChange={() => toggle(key)}
                                        type="checkbox"
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                            {item.label}
                                        </span>
                                        <span className="block truncate text-xs text-[var(--settings-muted-text)]">
                                            {item.scopeType} · {item.context}
                                        </span>
                                    </span>
                                </label>
                            );
                        })
                    ) : (
                        <p className="min-h-48 py-10 text-center text-sm text-[var(--settings-muted-text)]">
                            {t(
                                'settings.companion.dialogues.assign_empty',
                                'No authored pages match this search.',
                            )}
                        </p>
                    )}
                </div>
                <PaginationControls
                    className="shrink-0 border-t border-[var(--settings-border-color)] pt-3 text-xs text-[var(--settings-muted-text)]"
                    currentPage={pagination.currentPage}
                    label={t(
                        'settings.companion.dialogues.assign_pagination',
                        'Assignment target pagination',
                    )}
                    nextLabel={t(
                        'settings.companion.dialogues.assign_next',
                        'Next assignment page',
                    )}
                    onPageChange={setPage}
                    pageCount={pagination.lastPage}
                    previousLabel={t(
                        'settings.companion.dialogues.assign_previous',
                        'Previous assignment page',
                    )}
                    showSinglePage
                />
                <DialogFooter>
                    <Button disabled={saving} onClick={() => void save()}>
                        <Save className="size-4" />
                        {saving
                            ? t('common.saving', 'Saving...')
                            : t('settings.companion.dialogues.save_assignments', 'Save assignments')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
