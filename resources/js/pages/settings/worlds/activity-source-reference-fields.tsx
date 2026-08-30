import {
    ChevronLeft,
    ChevronRight,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type {
    ActivityForm,
    EditableSourceRecord,
    SourceRecordVersion,
    SourceRecordVersionPage,
    SourceReferenceForm,
} from './edit-node-activity-types';

const emptyReference = (): SourceReferenceForm => ({
    anchor: '',
    excerpt: '',
    publishedAt: '',
    publisher: '',
    rights: '',
    title: '',
    url: '',
});

export function ActivitySourceReferenceFields({
    errors,
    form,
    onChange,
    onDeleteSourceRecord,
    onLoadSourceRecordVersions,
    onRestoreSourceRecordVersion,
    onSaveSourceRecord,
    onUpdateSourceRecord,
    sourceRecords,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onDeleteSourceRecord: (id: number) => Promise<void>;
    onLoadSourceRecordVersions: (
        id: number,
        page: number,
    ) => Promise<SourceRecordVersionPage>;
    onRestoreSourceRecordVersion: (
        sourceId: number,
        versionId: number,
    ) => Promise<EditableSourceRecord>;
    onSaveSourceRecord: (reference: SourceReferenceForm) => Promise<void>;
    onUpdateSourceRecord: (
        id: number,
        reference: SourceReferenceForm,
    ) => Promise<void>;
    sourceRecords: EditableSourceRecord[];
}) {
    const t = usePlatformTranslation();
    const [selectedSourceId, setSelectedSourceId] = useState('');
    const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
    const [catalogForm, setCatalogForm] = useState<SourceReferenceForm | null>(
        null,
    );
    const [catalogBusy, setCatalogBusy] = useState(false);
    const [catalogError, setCatalogError] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState(false);
    const [sourceHistory, setSourceHistory] =
        useState<SourceRecordVersionPage | null>(null);
    const [restoringVersionId, setRestoringVersionId] = useState<number | null>(
        null,
    );
    const [savingIndex, setSavingIndex] = useState<number | null>(null);
    const [saveError, setSaveError] = useState(false);

    function addReference() {
        if (form.source_references.length >= 5) {
            return;
        }

        onChange((current) => ({
            ...current,
            source_references: [...current.source_references, emptyReference()],
        }));
    }

    function removeReference(index: number) {
        onChange((current) => ({
            ...current,
            source_references: current.source_references.filter(
                (_, referenceIndex) => referenceIndex !== index,
            ),
        }));
    }

    function updateReference(
        index: number,
        field: keyof SourceReferenceForm,
        value: string,
    ) {
        onChange((current) => ({
            ...current,
            source_references: current.source_references.map(
                (reference, referenceIndex) =>
                    referenceIndex === index
                        ? { ...reference, [field]: value }
                        : reference,
            ),
        }));
    }

    function addSavedSource() {
        const source = sourceRecords.find(
            (candidate) => candidate.id.toString() === selectedSourceId,
        );

        if (!source || form.source_references.length >= 5) {
            return;
        }

        onChange((current) => ({
            ...current,
            source_references: [
                ...current.source_references,
                {
                    anchor: source.anchor ?? '',
                    excerpt: source.excerpt ?? '',
                    publishedAt: source.publishedAt ?? '',
                    publisher: source.publisher ?? '',
                    rights: source.rights ?? '',
                    title: source.title,
                    url: source.url,
                },
            ],
        }));
        setSelectedSourceId('');
    }

    function beginEditingSource() {
        const source = sourceRecords.find(
            (candidate) => candidate.id.toString() === selectedSourceId,
        );

        if (!source) {
            return;
        }

        setEditingSourceId(source.id);
        setCatalogForm(sourceFormFromRecord(source));
        setCatalogError(false);
        setSourceHistory(null);
        setHistoryLoading(true);
        setHistoryError(false);
        void onLoadSourceRecordVersions(source.id, 1)
            .then(setSourceHistory)
            .catch(() => setHistoryError(true))
            .finally(() => setHistoryLoading(false));
    }

    function cancelEditingSource() {
        setEditingSourceId(null);
        setCatalogForm(null);
        setCatalogError(false);
        setSourceHistory(null);
        setHistoryError(false);
        setHistoryLoading(false);
        setRestoringVersionId(null);
    }

    async function restoreSourceVersion(version: SourceRecordVersion) {
        if (
            editingSourceId === null ||
            !window.confirm(
                t(
                    'settings.activity_sources.restore_confirm',
                    'Restore this version? The current source will be preserved in history.',
                ),
            )
        ) {
            return;
        }

        setRestoringVersionId(version.id);
        setCatalogError(false);

        try {
            const source = await onRestoreSourceRecordVersion(
                editingSourceId,
                version.id,
            );
            setCatalogForm(sourceFormFromRecord(source));
            await loadSourceHistoryPage(sourceHistory?.pagination.page ?? 1);
        } catch {
            setCatalogError(true);
        } finally {
            setRestoringVersionId(null);
        }
    }

    async function loadSourceHistoryPage(page: number) {
        if (editingSourceId === null) {
            return;
        }

        setHistoryLoading(true);
        setHistoryError(false);

        try {
            setSourceHistory(
                await onLoadSourceRecordVersions(editingSourceId, page),
            );
        } catch {
            setHistoryError(true);
        } finally {
            setHistoryLoading(false);
        }
    }

    function updateCatalogField(
        field: keyof SourceReferenceForm,
        value: string,
    ) {
        setCatalogForm((current) =>
            current ? { ...current, [field]: value } : current,
        );
    }

    async function updateSavedSource() {
        if (
            editingSourceId === null ||
            !catalogForm ||
            !catalogForm.title.trim() ||
            !catalogForm.url.trim()
        ) {
            return;
        }

        setCatalogBusy(true);
        setCatalogError(false);

        try {
            await onUpdateSourceRecord(editingSourceId, catalogForm);
            cancelEditingSource();
        } catch {
            setCatalogError(true);
        } finally {
            setCatalogBusy(false);
        }
    }

    async function deleteSavedSource() {
        const source = sourceRecords.find(
            (candidate) => candidate.id.toString() === selectedSourceId,
        );

        if (
            !source ||
            !window.confirm(
                t(
                    'settings.activity_sources.delete_confirm',
                    'Delete this saved source? Existing activity references will not change.',
                ),
            )
        ) {
            return;
        }

        setCatalogBusy(true);
        setCatalogError(false);

        try {
            await onDeleteSourceRecord(source.id);
            cancelEditingSource();
            setSelectedSourceId('');
        } catch {
            setCatalogError(true);
        } finally {
            setCatalogBusy(false);
        }
    }

    async function saveReference(
        reference: SourceReferenceForm,
        index: number,
    ) {
        if (!reference.title.trim() || !reference.url.trim()) {
            return;
        }

        setSavingIndex(index);
        setSaveError(false);

        try {
            await onSaveSourceRecord(reference);
        } catch {
            setSaveError(true);
        } finally {
            setSavingIndex(null);
        }
    }

    return (
        <div className="grid gap-4">
            <div className="flex items-start justify-between gap-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-white/15 dark:bg-slate-950/30">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Add up to five references that learners can inspect while
                    working through this activity. These references support
                    provenance; they are not learner evidence or grades.
                </p>
                <Button
                    aria-label="Add source reference"
                    className="shrink-0"
                    disabled={form.source_references.length >= 5}
                    onClick={addReference}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <Plus className="size-4" />
                    Add source
                </Button>
            </div>

            {sourceRecords.length > 0 ? (
                <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-white/10">
                    <Label htmlFor="saved-source-record">
                        {t(
                            'settings.activity_sources.reuse_label',
                            'Reuse a saved source',
                        )}
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            aria-label="Saved source records"
                            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            id="saved-source-record"
                            onChange={(event) =>
                                setSelectedSourceId(event.target.value)
                            }
                            value={selectedSourceId}
                        >
                            <option value="">
                                {t(
                                    'settings.activity_sources.choose',
                                    'Choose a source',
                                )}
                            </option>
                            {sourceRecords.map((source) => (
                                <option key={source.id} value={source.id}>
                                    {source.title}
                                </option>
                            ))}
                        </select>
                        <Button
                            disabled={
                                selectedSourceId === '' ||
                                form.source_references.length >= 5
                            }
                            onClick={addSavedSource}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            <Plus className="size-4" />
                            {t(
                                'settings.activity_sources.add',
                                'Add saved source',
                            )}
                        </Button>
                        <Button
                            aria-label={t(
                                'settings.activity_sources.edit',
                                'Edit saved source',
                            )}
                            disabled={selectedSourceId === '' || catalogBusy}
                            onClick={beginEditingSource}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            <Pencil className="size-4" />
                            {t(
                                'settings.activity_sources.edit',
                                'Edit saved source',
                            )}
                        </Button>
                        <Button
                            aria-label={t(
                                'settings.activity_sources.delete',
                                'Delete saved source',
                            )}
                            disabled={selectedSourceId === '' || catalogBusy}
                            onClick={deleteSavedSource}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            <Trash2 className="size-4" />
                            {t(
                                'settings.activity_sources.delete',
                                'Delete saved source',
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.activity_sources.helper',
                            'This copies the saved metadata into the activity. Later edits to the catalog do not rewrite existing learner evidence snapshots.',
                        )}
                    </p>
                    {editingSourceId !== null && catalogForm ? (
                        <div className="grid gap-3 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    {t(
                                        'settings.activity_sources.editing',
                                        'Editing saved source',
                                    )}
                                </p>
                                <Button
                                    disabled={catalogBusy}
                                    onClick={cancelEditingSource}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    {t(
                                        'settings.activity_sources.cancel_edit',
                                        'Cancel',
                                    )}
                                </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <SourceField
                                    id="saved-source-title"
                                    label="Title"
                                    onChange={(value) =>
                                        updateCatalogField('title', value)
                                    }
                                    value={catalogForm.title}
                                />
                                <SourceField
                                    id="saved-source-url"
                                    label="URL"
                                    onChange={(value) =>
                                        updateCatalogField('url', value)
                                    }
                                    type="url"
                                    value={catalogForm.url}
                                />
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="saved-source-excerpt">
                                        Short excerpt or location note
                                        (optional)
                                    </Label>
                                    <textarea
                                        className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                                        id="saved-source-excerpt"
                                        maxLength={800}
                                        onChange={(event) =>
                                            updateCatalogField(
                                                'excerpt',
                                                event.target.value,
                                            )
                                        }
                                        rows={3}
                                        value={catalogForm.excerpt}
                                    />
                                </div>
                                <SourceField
                                    id="saved-source-publisher"
                                    label="Publisher"
                                    onChange={(value) =>
                                        updateCatalogField('publisher', value)
                                    }
                                    value={catalogForm.publisher}
                                />
                                <SourceField
                                    id="saved-source-published-at"
                                    label="Published date"
                                    onChange={(value) =>
                                        updateCatalogField('publishedAt', value)
                                    }
                                    type="date"
                                    value={catalogForm.publishedAt}
                                />
                                <SourceField
                                    id="saved-source-rights"
                                    label="Rights or licence"
                                    onChange={(value) =>
                                        updateCatalogField('rights', value)
                                    }
                                    value={catalogForm.rights}
                                />
                                <SourceField
                                    id="saved-source-anchor"
                                    label="Stable anchor (optional)"
                                    onChange={(value) =>
                                        updateCatalogField('anchor', value)
                                    }
                                    value={catalogForm.anchor}
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    disabled={
                                        catalogBusy ||
                                        !catalogForm.title.trim() ||
                                        !catalogForm.url.trim()
                                    }
                                    onClick={updateSavedSource}
                                    size="sm"
                                    type="button"
                                >
                                    <Save className="size-4" />
                                    {catalogBusy
                                        ? t(
                                              'settings.activity_sources.updating',
                                              'Updating…',
                                          )
                                        : t(
                                              'settings.activity_sources.update',
                                              'Update saved source',
                                          )}
                                </Button>
                            </div>
                            <SourceHistory
                                history={sourceHistory}
                                loading={historyLoading}
                                error={historyError}
                                onPageChange={loadSourceHistoryPage}
                                onRestore={restoreSourceVersion}
                                restoringVersionId={restoringVersionId}
                            />
                        </div>
                    ) : null}
                    {catalogError ? (
                        <p
                            aria-live="polite"
                            className="text-sm text-red-600 dark:text-red-300"
                            role="status"
                        >
                            {t(
                                'settings.activity_sources.catalog_error',
                                'The saved source could not be changed. Try again.',
                            )}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {form.source_references.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    No sources attached yet.
                </p>
            ) : (
                form.source_references.map((reference, index) => (
                    <div
                        className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-white/10"
                        key={`source-reference-${index}`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                Source {index + 1}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    aria-label={`Save source ${index + 1} to library`}
                                    disabled={
                                        savingIndex !== null ||
                                        !reference.title.trim() ||
                                        !reference.url.trim()
                                    }
                                    onClick={() =>
                                        saveReference(reference, index)
                                    }
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    <Save className="size-4" />
                                    {savingIndex === index
                                        ? t(
                                              'settings.activity_sources.saving',
                                              'Saving…',
                                          )
                                        : t(
                                              'settings.activity_sources.save',
                                              'Save to library',
                                          )}
                                </Button>
                                <Button
                                    aria-label={`Remove source ${index + 1}`}
                                    onClick={() => removeReference(index)}
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <SourceField
                                error={
                                    errors[`source_references.${index}.title`]
                                }
                                id={`source-reference-${index}-title`}
                                label="Title"
                                onChange={(value) =>
                                    updateReference(index, 'title', value)
                                }
                                value={reference.title}
                            />
                            <SourceField
                                error={errors[`source_references.${index}.url`]}
                                id={`source-reference-${index}-url`}
                                label="URL"
                                onChange={(value) =>
                                    updateReference(index, 'url', value)
                                }
                                type="url"
                                value={reference.url}
                            />
                            <div className="grid gap-2 md:col-span-2">
                                <Label
                                    htmlFor={`source-reference-${index}-excerpt`}
                                >
                                    Short excerpt or location note (optional)
                                </Label>
                                <textarea
                                    className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                                    id={`source-reference-${index}-excerpt`}
                                    maxLength={800}
                                    onChange={(event) =>
                                        updateReference(
                                            index,
                                            'excerpt',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="A short passage or a precise place to look"
                                    rows={3}
                                    value={reference.excerpt}
                                />
                                <InputError
                                    message={
                                        errors[
                                            `source_references.${index}.excerpt`
                                        ]
                                    }
                                />
                            </div>
                            <SourceField
                                error={
                                    errors[
                                        `source_references.${index}.publisher`
                                    ]
                                }
                                id={`source-reference-${index}-publisher`}
                                label="Publisher"
                                onChange={(value) =>
                                    updateReference(index, 'publisher', value)
                                }
                                value={reference.publisher}
                            />
                            <SourceField
                                error={
                                    errors[
                                        `source_references.${index}.publishedAt`
                                    ]
                                }
                                id={`source-reference-${index}-published-at`}
                                label="Published date"
                                onChange={(value) =>
                                    updateReference(index, 'publishedAt', value)
                                }
                                type="date"
                                value={reference.publishedAt}
                            />
                            <SourceField
                                error={
                                    errors[`source_references.${index}.rights`]
                                }
                                id={`source-reference-${index}-rights`}
                                label="Rights or licence"
                                onChange={(value) =>
                                    updateReference(index, 'rights', value)
                                }
                                value={reference.rights}
                            />
                            <SourceField
                                error={
                                    errors[`source_references.${index}.anchor`]
                                }
                                id={`source-reference-${index}-anchor`}
                                label="Stable anchor (optional)"
                                onChange={(value) =>
                                    updateReference(index, 'anchor', value)
                                }
                                value={reference.anchor}
                            />
                        </div>
                    </div>
                ))
            )}
            {saveError ? (
                <p
                    aria-live="polite"
                    className="text-sm text-red-600 dark:text-red-300"
                    role="status"
                >
                    {t(
                        'settings.activity_sources.error',
                        'The source could not be saved. Try again.',
                    )}
                </p>
            ) : null}
        </div>
    );
}

function SourceField({
    error,
    id,
    label,
    onChange,
    type = 'text',
    value,
}: {
    error?: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    type?: 'date' | 'text' | 'url';
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.target.value)}
                type={type}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function SourceHistory({
    error,
    history,
    loading,
    onPageChange,
    onRestore,
    restoringVersionId,
}: {
    error: boolean;
    history: SourceRecordVersionPage | null;
    loading: boolean;
    onPageChange: (page: number) => void;
    onRestore: (version: SourceRecordVersion) => void;
    restoringVersionId: number | null;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="grid min-h-48 gap-3 rounded-md border border-slate-200/80 bg-slate-950/20 p-3 dark:border-white/10">
            <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {t(
                        'settings.activity_sources.history',
                        'Previous versions',
                    )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.activity_sources.history_helper',
                        'Earlier metadata is kept so authors can inspect what an activity could have pointed to at the time.',
                    )}
                </p>
            </div>

            {loading ? (
                <p
                    aria-live="polite"
                    className="text-sm text-slate-500 dark:text-slate-400"
                    role="status"
                >
                    {t(
                        'settings.activity_sources.history_loading',
                        'Loading source history…',
                    )}
                </p>
            ) : error ? (
                <p
                    aria-live="polite"
                    className="text-sm text-red-600 dark:text-red-300"
                    role="status"
                >
                    {t(
                        'settings.activity_sources.history_error',
                        'The source history could not be loaded. Try again.',
                    )}
                </p>
            ) : history && history.items.length > 0 ? (
                <div className="grid gap-2">
                    {history.items.map((version) => (
                        <div
                            className="grid gap-1 rounded-md border border-slate-200/80 p-2 dark:border-white/10"
                            key={version.id}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    {version.title}
                                </p>
                                <time
                                    className="text-xs text-slate-500 dark:text-slate-400"
                                    dateTime={version.createdAt ?? undefined}
                                >
                                    {formatVersionDate(version.createdAt)}
                                </time>
                            </div>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {version.url}
                            </p>
                            {version.excerpt ? (
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {version.excerpt}
                                </p>
                            ) : null}
                            <div className="flex justify-end">
                                <Button
                                    disabled={
                                        loading || restoringVersionId !== null
                                    }
                                    onClick={() => void onRestore(version)}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    <RotateCcw className="size-4" />
                                    {restoringVersionId === version.id
                                        ? t(
                                              'settings.activity_sources.restoring',
                                              'Restoring…',
                                          )
                                        : t(
                                              'settings.activity_sources.restore',
                                              'Restore this version',
                                          )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.activity_sources.history_empty',
                        'No earlier versions yet. The first update will create one.',
                    )}
                </p>
            )}

            {history && history.pagination.lastPage > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 pt-2 dark:border-white/10">
                    <Button
                        disabled={loading || history.pagination.page <= 1}
                        onClick={() =>
                            onPageChange(history.pagination.page - 1)
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <ChevronLeft className="size-4" />
                        {t(
                            'settings.activity_sources.history_previous',
                            'Previous',
                        )}
                    </Button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.activity_sources.history_page', 'Page')}{' '}
                        {history.pagination.page}{' '}
                        {t('settings.activity_sources.history_of', 'of')}{' '}
                        {history.pagination.lastPage}
                    </span>
                    <Button
                        disabled={
                            loading ||
                            history.pagination.page >=
                                history.pagination.lastPage
                        }
                        onClick={() =>
                            onPageChange(history.pagination.page + 1)
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        {t('settings.activity_sources.history_next', 'Next')}
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function formatVersionDate(value: string | null): string {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(date);
}

function sourceFormFromRecord(
    source: EditableSourceRecord,
): SourceReferenceForm {
    return {
        anchor: source.anchor ?? '',
        excerpt: source.excerpt ?? '',
        publishedAt: source.publishedAt ?? '',
        publisher: source.publisher ?? '',
        rights: source.rights ?? '',
        title: source.title,
        url: source.url,
    };
}
