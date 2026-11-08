import { Check, LoaderCircle, Music, RefreshCw, Save, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type SoundSet = components['schemas']['AdminDialogueTypingSoundSet'];
type Metadata = components['schemas']['AdminDialogueTypingSoundSetMetadataRequest'];
type Assignment = components['schemas']['AdminDialogueTypingSoundAssignment'];

type Form = {
    isDefault: boolean;
    name: string;
    slug: string;
    tags: string;
};

const letters = Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index));
const pageSize = 6;

/**
 * Source-adapted from `settings/assets/dialogue-sound-sets.tsx`: the two-pane
 * set selector, exact A–Z upload requirement, metadata editor and six-letter
 * paging are retained while Inertia requests use the typed Rust contract.
 */
export function OriginalDialogueTypingSoundSetsPage() {
    const [sets, setSets] = useState<SoundSet[]>([]);
    const selectedFromUrl = useRef(readSelectedSetId()).current;
    const hasExplicitSelection = useRef(selectedFromUrl !== null);
    const [selectedId, setSelectedId] = useState<string | 'new'>(selectedFromUrl ?? 'new');
    const [form, setForm] = useState<Form>(blankForm());
    const [files, setFiles] = useState<File[]>([]);
    const [setPage, setSetPage] = useState(0);
    const [letterPage, setLetterPage] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);

    const selected = selectedId === 'new' ? null : sets.find((set) => set.id === selectedId) ?? null;
    const visibleSets = useMemo(() => sets.slice(setPage * pageSize, (setPage + 1) * pageSize), [setPage, sets]);
    const visibleLetters = letters.slice(letterPage * pageSize, (letterPage + 1) * pageSize);

    const load = useCallback(async () => {
        try {
            const { data, response } = await apiClient.GET('/admin/dialogue-typing-sound-sets');
            if (!response.ok || !data) throw new Error('load');
            setSets(data.sets);
            setSelectedId((current) => {
                if (hasExplicitSelection.current) return current;
                if (current !== 'new' && data.sets.some((set) => set.id === current)) return current;
                return data.sets[0]?.id ?? 'new';
            });
        } catch {
            setError('The dialogue typing sound sets could not be loaded. Check your sound-library access and try again.');
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        setForm(formFromSet(selected));
        setFiles([]);
        setLetterPage(0);
        setError(null);
        setNotice(null);
    }, [selectedId]);

    function choose(set: SoundSet): void {
        hasExplicitSelection.current = true;
        setSelectedId(set.id);
        setSetPage(Math.floor(sets.findIndex((candidate) => candidate.id === set.id) / pageSize));
    }

    function startCreate(): void {
        hasExplicitSelection.current = true;
        setSelectedId('new');
        setForm(blankForm());
        setFiles([]);
        setLetterPage(0);
        window.setTimeout(() => input.current?.focus(), 0);
    }

    async function saveMetadata(): Promise<void> {
        if (!selected || !validMetadata(form)) return;
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/dialogue-typing-sound-sets/{set_id}', {
                body: metadata(form),
                params: { header: { 'X-CSRF-Token': token }, path: { set_id: selected.id } },
            });
            if (!response.ok || !data) throw new Error('save metadata');
            replaceSet(data.set);
            setForm(formFromSet(data.set));
            setNotice('Sound-set details saved.');
        } catch {
            setError('The details could not be saved. The slug may already be in use.');
        } finally {
            setBusy(false);
        }
    }

    async function submitWholeSet(): Promise<void> {
        if (!validMetadata(form) || !hasAllLetters(files)) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        let assetIds: string[] = [];
        try {
            assetIds = await uploadFiles(files);
            const assignments = assignmentsFrom(files, assetIds);
            const token = await getCsrfToken();
            if (selected) {
                const { data, response } = await apiClient.PATCH('/admin/dialogue-typing-sound-sets/{set_id}/sounds', {
                    body: assignments,
                    params: { header: { 'X-CSRF-Token': token }, path: { set_id: selected.id } },
                });
                if (!response.ok || !data) throw new Error('replace');
                replaceSet(data.set);
                setNotice('All 26 letter sounds were replaced.');
            } else {
                const { data, response } = await apiClient.POST('/admin/dialogue-typing-sound-sets', {
                    body: { ...metadata(form), sounds: assignments },
                    params: { header: { 'X-CSRF-Token': token } },
                });
                if (!response.ok || !data) throw new Error('create');
                setSets((current) => sortSets([...current, data.set]));
                setSelectedId(data.set.id);
                setNotice('Dialogue typing sound set created.');
            }
            assetIds = [];
            setFiles([]);
        } catch {
            await discardUploads(assetIds);
            setError('The set could not be saved. Choose exactly one WAV named a.wav through z.wav, with each file under 20 MiB.');
        } finally {
            setBusy(false);
            if (input.current) input.current.value = '';
        }
    }

    async function replaceLetter(letter: string, file: File | undefined): Promise<void> {
        if (!selected || !file || !isNamedLetterFile(file, letter)) return;
        setBusy(true);
        setError(null);
        let assetId: string | null = null;
        try {
            assetId = await uploadFile(file);
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/dialogue-typing-sound-sets/{set_id}/sounds/{letter}', {
                body: { asset_id: assetId, letter },
                params: { header: { 'X-CSRF-Token': token }, path: { letter, set_id: selected.id } },
            });
            if (!response.ok || !data) throw new Error('replace letter');
            replaceSet(data.set);
            setNotice(`The ${letter.toUpperCase()} sound was replaced.`);
            assetId = null;
        } catch {
            if (assetId) await discardUploads([assetId]);
            setError(`The ${letter.toUpperCase()} sound could not be replaced. Select that letter's WAV file under 20 MiB.`);
        } finally {
            setBusy(false);
        }
    }

    function replaceSet(next: SoundSet): void {
        setSets((current) => sortSets(current.map((set) => set.id === next.id ? next : set)));
    }

    async function uploadFile(file: File): Promise<string> {
        if (!isWav(file) || file.size <= 0 || file.size > 20 * 1024 * 1024) throw new Error('file');
        const token = await getCsrfToken();
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/v1/admin/dialogue-typing-sound-sets/media', {
            body,
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token },
            method: 'POST',
        });
        if (!response.ok) throw new Error('upload');
        const uploaded = await response.json() as components['schemas']['AdminDialogueTypingSoundMediaUploadResponse'];
        return uploaded.asset_id;
    }

    async function uploadFiles(nextFiles: File[]): Promise<string[]> {
        const uploaded: string[] = [];
        for (const file of nextFiles) uploaded.push(await uploadFile(file));
        return uploaded;
    }

    async function discardUploads(assetIds: string[]): Promise<void> {
        if (!assetIds.length) return;
        try {
            const token = await getCsrfToken();
            await Promise.all(assetIds.map(async (assetId) => {
                await apiClient.DELETE('/admin/dialogue-typing-sound-sets/media/{asset_id}', {
                    params: { header: { 'X-CSRF-Token': token }, path: { asset_id: assetId } },
                });
            }));
        } catch {
            // Failed cancellation leaves only the caller's unattached staged media.
        }
    }

    return <main className="min-h-svh bg-slate-100 px-4 py-5 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100" data-wl-id="settings.assets.dialogue-typing-sounds">
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-[92rem] flex-col gap-4">
            <Link className="inline-flex w-fit items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10" to="/settings?panel=admin-assets&asset=sounds">Sound library</Link>
            <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium tracking-[.18em] text-teal-700 uppercase dark:text-teal-300">Dialogue typing</p><h1 className="mt-1 text-3xl font-semibold">Letter sound sets</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Give speech bubbles an optional voice-like rhythm. Each set contains one managed WAV file for every letter from A to Z.</p></div><button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50" disabled={busy} onClick={startCreate} type="button"><Music className="size-4" />New set</button></header>
            {error ? <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}
            {notice ? <p className="rounded-md border border-teal-300 bg-teal-50 p-3 text-sm text-teal-950 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-100" role="status">{notice}</p> : null}
            <section className="grid min-h-[42rem] flex-1 gap-5 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)]" data-wl-id="settings.assets.dialogue-typing-sounds.workspace">
                <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950" data-wl-id="settings.assets.dialogue-typing-sounds.list"><div className="min-h-0 flex-1 space-y-2">{visibleSets.map((set) => <button className={`w-full rounded-lg border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none ${selected?.id === set.id ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 dark:bg-teal-500/10' : 'border-slate-200 hover:border-teal-400 dark:border-white/10'}`} key={set.id} onClick={() => choose(set)} type="button"><span className="flex items-center justify-between gap-2 text-sm font-medium">{set.name}{set.is_default ? <Check className="size-4 text-teal-700 dark:text-teal-300" /> : null}</span><span className="mt-1 block text-xs text-slate-500">{set.sound_count}/26 letters</span></button>)}{!sets.length ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/20">No sets yet.</p> : null}</div><Pagination current={setPage} count={Math.max(1, Math.ceil(sets.length / pageSize))} label="Sound-set pages" onChange={setSetPage} /></aside>
                <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950" data-wl-id="settings.assets.dialogue-typing-sounds.editor"><div className="flex h-full min-h-0 flex-col gap-5"><div className="grid shrink-0 gap-4 md:grid-cols-2"><Field label="Name"><input aria-label="Name" className={inputClass} onChange={(event) => { const name = event.currentTarget.value; setForm((current) => ({ ...current, name })); }} value={form.name} /></Field><Field label="Slug"><input aria-label="Slug" className={inputClass} onChange={(event) => { const slug = event.currentTarget.value; setForm((current) => ({ ...current, slug })); }} value={form.slug} /></Field><Field label="Tags (comma separated)"><input aria-label="Tags (comma separated)" className={inputClass} onChange={(event) => { const tags = event.currentTarget.value; setForm((current) => ({ ...current, tags })); }} value={form.tags} /></Field><label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10"><input checked={form.isDefault} onChange={(event) => { const isDefault = event.currentTarget.checked; setForm((current) => ({ ...current, isDefault })); }} type="checkbox" />Use as default set</label></div>
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-4 dark:border-white/10"><div><p className="text-sm font-semibold">{selected ? 'Replace sound files' : 'Create from WAV files'}</p><p className="mt-1 text-xs leading-5 text-slate-500">Select exactly 26 files named a.wav through z.wav. They are staged as managed media and attached atomically only after all uploads succeed.</p></div><div className="flex flex-wrap gap-2"><input accept="audio/wav,.wav" className="hidden" multiple onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))} ref={input} type="file" /><button className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10" disabled={busy} onClick={() => input.current?.click()} type="button"><Upload className="size-4" />Choose 26 WAVs</button><button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50" disabled={busy || !hasAllLetters(files)} onClick={() => void submitWholeSet()} type="button">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{selected ? 'Replace set' : 'Create set'}</button>{selected ? <button className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10" disabled={busy} onClick={() => void saveMetadata()} type="button"><Save className="size-4" />Save details</button> : null}</div></div>
                    {selected ? <div className="min-h-0 flex-1"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-wl-id="settings.assets.dialogue-typing-sounds.letters">{visibleLetters.map((letter) => <LetterRow key={letter} letter={letter} onReplace={replaceLetter} present={selected.letters.includes(letter)} />)}</div><Pagination current={letterPage} count={Math.ceil(letters.length / pageSize)} label="Letter pages" onChange={setLetterPage} /></div> : <div className="grid min-h-48 flex-1 place-items-center rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-white/20"><p className="max-w-md text-sm leading-6 text-slate-500">Choose the 26 files above to create a complete set. Runtime punctuation uses a random available letter sound; spaces stay quiet.</p></div>}</div></section>
            </section>
        </div>
    </main>;
}

function LetterRow({ letter, onReplace, present }: { letter: string; onReplace: (letter: string, file: File | undefined) => Promise<void>; present: boolean }) {
    const inputId = `dialogue-typing-sound-${letter}`;
    return <div className="flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 dark:border-white/10"><span className="flex items-center gap-1.5 text-xs font-semibold uppercase">{letter}{present ? <Check className="size-3.5 text-teal-700 dark:text-teal-300" /> : null}</span><input accept="audio/wav,.wav" className="sr-only" id={inputId} onChange={(event) => void onReplace(letter, event.currentTarget.files?.[0])} type="file" /><label className="cursor-pointer rounded px-1.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/10" htmlFor={inputId}>Replace</label></div>;
}

function Pagination({ count, current, label, onChange }: { count: number; current: number; label: string; onChange: (page: number) => void }) {
    return <nav aria-label={label} className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs dark:border-white/10"><button className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10" disabled={current === 0} onClick={() => onChange(current - 1)} type="button">Previous</button><span>{current + 1} / {count}</span><button className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10" disabled={current + 1 >= count} onClick={() => onChange(current + 1)} type="button">Next</button></nav>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>; }

function blankForm(): Form { return { isDefault: false, name: '', slug: '', tags: 'dialogue, typing' }; }
function formFromSet(set: SoundSet | null): Form { return { isDefault: set?.is_default ?? false, name: set?.name ?? '', slug: set?.slug ?? '', tags: set?.tags.join(', ') ?? 'dialogue, typing' }; }
function metadata(form: Form): Metadata { return { is_default: form.isDefault, name: form.name.trim(), slug: form.slug.trim(), tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }; }
function validMetadata(form: Form): boolean { return Boolean(form.name.trim() && /^[A-Za-z0-9_-]+$/.test(form.slug.trim()) && form.name.trim().length <= 120 && form.slug.trim().length <= 120); }
function isWav(file: File): boolean { return file.name.toLowerCase().endsWith('.wav'); }
function isNamedLetterFile(file: File, letter: string): boolean { return file.name.toLowerCase() === `${letter}.wav`; }
function hasAllLetters(files: File[]): boolean { return files.length === 26 && new Set(files.map((file) => file.name.replace(/\.wav$/i, '').toLowerCase())).size === 26 && letters.every((letter) => files.some((file) => isNamedLetterFile(file, letter))); }
function assignmentsFrom(files: File[], assetIds: string[]): Assignment[] { const byLetter = new Map(files.map((file, index) => [file.name.replace(/\.wav$/i, '').toLowerCase(), assetIds[index]])); return letters.map((letter) => ({ asset_id: byLetter.get(letter)!, letter })); }
function sortSets(sets: SoundSet[]): SoundSet[] { return [...sets].sort((left, right) => Number(right.is_default) - Number(left.is_default) || left.name.localeCompare(right.name)); }
function readSelectedSetId(): string | null { if (typeof window === 'undefined') return null; const value = new URL(window.location.href).searchParams.get('dialogueSoundSet'); return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null; }

const inputClass = 'w-full rounded-md border border-slate-300 bg-transparent px-2 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/20';
