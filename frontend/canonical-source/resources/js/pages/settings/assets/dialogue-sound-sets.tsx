import { Head, router } from '@inertiajs/react';
import { Check, Music, RefreshCw, Save, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DialogueSoundSetSummary } from '@/features/settings/assets-world-objects-panel';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { cn } from '@/lib/utils';

type SoundSetForm = {
    isDefault: boolean;
    name: string;
    slug: string;
    tags: string;
};

const PAGE_SIZE = 6;
const LETTER_PAGE_SIZE = 6;
const LETTERS = Array.from({ length: 26 }, (_, index) =>
    String.fromCharCode(97 + index),
);

export default function AdminDialogueSoundSetsPage({
    embedded = false,
    soundSets,
}: {
    embedded?: boolean;
    soundSets: DialogueSoundSetSummary[];
}) {
    const selectedFromUrl = readSelectedSetId();
    const [selectedId, setSelectedId] = useState<number | 'new'>(
        () => selectedFromUrl ?? soundSets[0]?.id ?? 'new',
    );
    const selectedSet =
        selectedId === 'new'
            ? null
            : (soundSets.find((set) => set.id === selectedId) ?? null);
    const [form, setForm] = useState<SoundSetForm>(() =>
        formFromSet(selectedSet),
    );
    const [files, setFiles] = useState<File[]>([]);
    const [page, setPage] = useState(1);
    const [letterPage, setLetterPage] = useState(1);
    const wholeSetInput = useRef<HTMLInputElement>(null);
    const hasChanges = useDirtyState(form, formFromSet(selectedSet));
    const pageCount = Math.max(1, Math.ceil(soundSets.length / PAGE_SIZE));
    const visibleSets = useMemo(
        () => soundSets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [page, soundSets],
    );

    const selectSet = (set: DialogueSoundSetSummary) => {
        setSelectedId(set.id);
        setForm(formFromSet(set));
        setFiles([]);
        setLetterPage(1);
    };

    const startCreate = () => {
        setSelectedId('new');
        setForm(formFromSet(null));
        setFiles([]);
        setLetterPage(1);
        wholeSetInput.current?.focus();
    };

    const saveMetadata = () => {
        if (!hasChanges || !selectedSet) {
            return;
        }

        router.patch(
            `/settings/assets/dialogue-sound-sets/${selectedSet.id}`,
            metadataPayload(form),
            { preserveScroll: true },
        );
    };

    const submitWholeSet = () => {
        if (!hasAllLetters(files)) {
            return;
        }

        const formData = new FormData();
        files.forEach((file) => formData.append('files[]', file));

        if (selectedSet) {
            router.post(
                `/settings/assets/dialogue-sound-sets/${selectedSet.id}/replace`,
                formData,
                { forceFormData: true, preserveScroll: true },
            );

            return;
        }

        appendMetadata(formData, form);
        router.post('/settings/assets/dialogue-sound-sets', formData, {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const replaceLetter = (letter: string, file: File | undefined) => {
        if (!selectedSet || !file) {
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        router.post(
            `/settings/assets/dialogue-sound-sets/${selectedSet.id}/sounds/${letter}`,
            formData,
            { forceFormData: true, preserveScroll: true },
        );
    };

    return (
        <>
            {!embedded ? <Head title="Dialogue typing sounds" /> : null}
            <main className="h-full overflow-hidden text-slate-950 dark:text-slate-100">
                <div className="flex h-full min-h-0 flex-col gap-4 p-5">
                    <header className="flex shrink-0 items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                Dialogue typing
                            </p>
                            <h2 className="mt-1 text-xl font-semibold">
                                Letter sound sets
                            </h2>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Give speech bubbles an optional voice-like
                                rhythm. Each set contains one WAV file for every
                                letter from A to Z.
                            </p>
                        </div>
                        <Button onClick={startCreate} type="button">
                            <Music className="size-4" />
                            New set
                        </Button>
                    </header>

                    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)]">
                        <section className="flex min-h-0 flex-col rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-3">
                            <div className="min-h-0 flex-1 space-y-2">
                                {visibleSets.map((set) => (
                                    <button
                                        className={cn(
                                            'w-full rounded-md border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--settings-accent)]',
                                            set.id === selectedId
                                                ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)]'
                                                : 'border-[var(--settings-border-color)] hover:border-[var(--settings-accent)]',
                                        )}
                                        key={set.id}
                                        onClick={() => selectSet(set)}
                                        type="button"
                                    >
                                        <span className="flex items-center justify-between gap-2 text-sm font-medium">
                                            {set.name}
                                            {set.isDefault ? (
                                                <Check className="size-4 text-[var(--settings-accent)]" />
                                            ) : null}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {set.soundCount}/26 letters
                                        </span>
                                    </button>
                                ))}
                                {visibleSets.length === 0 ? (
                                    <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
                                        No sets yet.
                                    </p>
                                ) : null}
                            </div>
                            <PaginationControls
                                className="mt-3 border-t border-[var(--settings-border-color)] pt-3 text-xs text-[var(--settings-muted-text)]"
                                currentPage={page}
                                nextLabel="Next sound-set page"
                                onPageChange={setPage}
                                pageCount={pageCount}
                                previousLabel="Previous sound-set page"
                            />
                        </section>

                        <section className="min-h-0 overflow-hidden rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4">
                            <div className="flex h-full min-h-0 flex-col gap-4">
                                <div className="grid shrink-0 gap-4 md:grid-cols-2">
                                    <Field
                                        label="Name"
                                        onChange={(name) =>
                                            setForm((current) => ({
                                                ...current,
                                                name,
                                            }))
                                        }
                                        value={form.name}
                                    />
                                    <Field
                                        label="Slug"
                                        onChange={(slug) =>
                                            setForm((current) => ({
                                                ...current,
                                                slug,
                                            }))
                                        }
                                        value={form.slug}
                                    />
                                    <Field
                                        label="Tags (comma separated)"
                                        onChange={(tags) =>
                                            setForm((current) => ({
                                                ...current,
                                                tags,
                                            }))
                                        }
                                        value={form.tags}
                                    />
                                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                                        <Checkbox
                                            checked={form.isDefault}
                                            onCheckedChange={(isDefault) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    isDefault:
                                                        isDefault === true,
                                                }))
                                            }
                                        />
                                        Use as default set
                                    </label>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-y border-[var(--settings-border-color)] py-3">
                                    <div>
                                        <p className="text-sm font-medium">
                                            {selectedSet
                                                ? 'Replace sound files'
                                                : 'Create from WAV files'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Select exactly 26 files named a.wav
                                            through z.wav.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <input
                                            accept=".wav,audio/wav"
                                            className="sr-only"
                                            multiple
                                            onChange={(event) =>
                                                setFiles(
                                                    Array.from(
                                                        event.target.files ??
                                                            [],
                                                    ),
                                                )
                                            }
                                            ref={wholeSetInput}
                                            type="file"
                                        />
                                        <Button
                                            onClick={() =>
                                                wholeSetInput.current?.click()
                                            }
                                            type="button"
                                            variant="outline"
                                        >
                                            <Upload className="size-4" />
                                            Choose 26 WAVs
                                        </Button>
                                        <Button
                                            disabled={!hasAllLetters(files)}
                                            onClick={submitWholeSet}
                                            type="button"
                                        >
                                            <RefreshCw className="size-4" />
                                            {selectedSet
                                                ? 'Replace set'
                                                : 'Create set'}
                                        </Button>
                                        {selectedSet ? (
                                            <Button
                                                disabled={!hasChanges}
                                                onClick={saveMetadata}
                                                type="button"
                                                variant="secondary"
                                            >
                                                <Save className="size-4" />
                                                Save details
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1">
                                    {selectedSet ? (
                                        <div className="flex h-full min-h-0 flex-col gap-2">
                                            <div className="grid flex-none grid-cols-2 content-start gap-2 sm:grid-cols-3">
                                                {LETTERS.slice(
                                                    (letterPage - 1) *
                                                        LETTER_PAGE_SIZE,
                                                    letterPage *
                                                        LETTER_PAGE_SIZE,
                                                ).map((letter) => (
                                                    <LetterRow
                                                        key={letter}
                                                        letter={letter}
                                                        onReplace={
                                                            replaceLetter
                                                        }
                                                        present={selectedSet.letters.includes(
                                                            letter,
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <PaginationControls
                                                className="min-h-7 shrink-0 border-t border-[var(--settings-border-color)] pt-2 text-xs text-[var(--settings-muted-text)]"
                                                currentPage={letterPage}
                                                label="Dialogue letter pagination"
                                                nextLabel="Next letter page"
                                                onPageChange={setLetterPage}
                                                pageCount={Math.ceil(
                                                    LETTERS.length /
                                                        LETTER_PAGE_SIZE,
                                                )}
                                                previousLabel="Previous letter page"
                                            />
                                        </div>
                                    ) : (
                                        <div className="grid h-full place-items-center rounded-md border border-dashed border-[var(--settings-border-color)] p-6 text-center">
                                            <p className="max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                                                Choose the 26 files above to
                                                create a complete set. Runtime
                                                punctuation uses a random
                                                available letter sound; spaces
                                                stay quiet.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </>
    );
}

function Field({
    label,
    onChange,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.target.value)}
                value={value}
            />
        </div>
    );
}

function LetterRow({
    letter,
    onReplace,
    present,
}: {
    letter: string;
    onReplace: (letter: string, file: File | undefined) => void;
    present: boolean;
}) {
    const inputId = `dialogue-sound-${letter}`;

    return (
        <div className="flex h-7 min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--settings-border-color)] px-2.5 py-0">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase">
                {letter}
                {present ? (
                    <Check className="size-3.5 text-[var(--settings-accent)]" />
                ) : null}
            </span>
            <input
                accept=".wav,audio/wav"
                className="sr-only"
                id={inputId}
                onChange={(event) => onReplace(letter, event.target.files?.[0])}
                type="file"
            />
            <Button asChild size="sm" type="button" variant="ghost">
                <label
                    className="h-6 cursor-pointer px-1.5 text-xs"
                    htmlFor={inputId}
                >
                    Replace
                </label>
            </Button>
        </div>
    );
}

function formFromSet(set: DialogueSoundSetSummary | null): SoundSetForm {
    return {
        isDefault: set?.isDefault ?? false,
        name: set?.name ?? '',
        slug: set?.slug ?? '',
        tags: set?.tags.join(', ') ?? 'dialogue, typing',
    };
}

function metadataPayload(form: SoundSetForm) {
    return {
        ...form,
        tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
    };
}

function appendMetadata(formData: FormData, form: SoundSetForm) {
    formData.append('name', form.name);
    formData.append('slug', form.slug);
    formData.append('is_default', form.isDefault ? '1' : '0');
    form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => formData.append('tags[]', tag));
}

function hasAllLetters(files: File[]): boolean {
    const letters = new Set(
        files.map((file) => file.name.replace(/\.wav$/i, '').toLowerCase()),
    );

    return (
        files.length === 26 && LETTERS.every((letter) => letters.has(letter))
    );
}

function readSelectedSetId(): number | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const value = Number(
        new URL(window.location.href).searchParams.get('dialogueSoundSet'),
    );

    return Number.isInteger(value) && value > 0 ? value : null;
}
