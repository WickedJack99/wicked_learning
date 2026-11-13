import { MousePointer2, Plus, Save, Trash2 } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { ImageInput } from './original-public-presentation';

type Presentation = components['schemas']['PublicPresentation'];
type Cursor = components['schemas']['PublicCursor'];
type CursorRole = keyof components['schemas']['PublicCursors'];

type CursorRoleDefinition = {
    description: string;
    key: CursorRole;
    label: string;
};

const cursorRoles: CursorRoleDefinition[] = [
    { key: 'default', label: 'Normal cursor', description: 'Used on passive surfaces and normal map areas.' },
    { key: 'action', label: 'Action pointer', description: 'Used on buttons, links and other clickable controls.' },
    { key: 'grab', label: 'Grab cursor', description: 'Used while dragging maps and graph surfaces.' },
    { key: 'text', label: 'Text input cursor', description: 'Used when hovering editable input and text areas.' },
    { key: 'denied', label: 'Denied cursor', description: 'Used on disabled controls and unavailable locked nodes.' },
];

/** Source-adapted from `cursor-image-settings-panel.tsx`. The source keeps
 * named roles optional, so an administrator can remove or repurpose one. */
export function OriginalCursorSettingsPage({ appearance }: { appearance: OriginalAppearance }) {
    const [saved, setSaved] = useState<Presentation | null>(null);
    const [draft, setDraft] = useState<Presentation | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void apiClient.GET('/admin/public-presentation').then(({ data, response }) => {
            if (!active) return;
            if (!response.ok || !data) {
                setError('Cursor settings are unavailable for this account.');
                return;
            }
            setSaved(data);
            setDraft(structuredClone(data));
        }).catch(() => active && setError('Cursor settings are temporarily unavailable.'));
        return () => { active = false; };
    }, []);

    const activeRoles = useMemo(
        () => Object.keys(draft?.cursors ?? {}) as CursorRole[],
        [draft?.cursors],
    );
    const availableRoles = useMemo(
        () => cursorRoles.filter((role) => !activeRoles.includes(role.key)),
        [activeRoles],
    );
    const changed = Boolean(saved && draft && JSON.stringify(saved.cursors) !== JSON.stringify(draft.cursors));

    function update(role: CursorRole, field: keyof Cursor, value: number | string | null): void {
        setDraft((current) => current ? {
            ...current,
            cursors: {
                ...current.cursors,
                [role]: { ...(current.cursors[role] ?? emptyCursor()), [field]: value },
            },
        } : current);
    }

    function addCursorRole(): void {
        const role = availableRoles[0];
        if (!role) return;
        setDraft((current) => current ? {
            ...current,
            cursors: { ...current.cursors, [role.key]: emptyCursor() },
        } : current);
    }

    function removeCursorRole(role: CursorRole): void {
        setDraft((current) => {
            if (!current) return current;
            const cursors = { ...current.cursors };
            delete cursors[role];
            return { ...current, cursors };
        });
    }

    function changeCursorRole(from: CursorRole, to: CursorRole): void {
        if (from === to) return;
        setDraft((current) => {
            if (!current) return current;
            const cursors = { ...current.cursors, [to]: current.cursors[from] };
            delete cursors[from];
            return { ...current, cursors };
        });
    }

    async function save(): Promise<void> {
        if (!draft || !changed || busy) return;
        setBusy(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/public-presentation', {
                body: draft,
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok || !data) throw new Error('save');
            setSaved(data);
            setDraft(structuredClone(data));
        } catch {
            setError('The cursor settings could not be saved. Check image URLs, hotspots, size and fallback values.');
        } finally {
            setBusy(false);
        }
    }

    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
        <div className="mx-auto w-full max-w-5xl">
            <header className="flex flex-wrap items-start justify-between gap-4 pb-5">
                <div>
                    <Link className="mb-4 inline-flex rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)]" to="/settings?panel=admin-assets-world-objects&asset=visuals">Assets &amp; World Objects</Link>
                    <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Assets &amp; World Objects</p>
                    <h1 className="mt-2 text-3xl font-semibold">Cursor images</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Configure reusable cursor image assets for normal, action, grab, text and denied states.</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!changed || busy || !draft} onClick={() => void save()} type="button"><Save className="size-4" />{busy ? 'Saving…' : 'Save cursors'}</button>
            </header>
            {error ? <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
            {!draft ? <p className="p-6 text-sm text-[var(--settings-muted-text)]">Loading cursor settings…</p> : <section className="border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-5">
                <div className="flex justify-end border-b border-[var(--settings-border-color)] pb-4"><button className="inline-flex items-center gap-2 rounded border border-[var(--settings-border-color)] px-3 py-2 text-sm disabled:opacity-50" disabled={!availableRoles.length} onClick={addCursorRole} type="button"><Plus className="size-4" />Add cursor role</button></div>
                <div className="grid gap-4 pt-5">{activeRoles.map((role) => <CursorEditor cursor={draft.cursors[role] ?? emptyCursor()} key={role} role={role} activeRoles={activeRoles} onChange={(field, value) => update(role, field, value)} onDelete={() => removeCursorRole(role)} onRoleChange={(next) => changeCursorRole(role, next)} />)}</div>
            </section>}
        </div>
    </main>;
}

function CursorEditor({ activeRoles, cursor, onChange, onDelete, onRoleChange, role }: { activeRoles: CursorRole[]; cursor: Cursor; onChange: (key: keyof Cursor, value: number | string | null) => void; onDelete: () => void; onRoleChange: (role: CursorRole) => void; role: CursorRole }) {
    const definition = cursorRoles.find((item) => item.key === role);
    return <article className="border-t border-[var(--settings-border-color)] pt-5 first:border-t-0 first:pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><MousePointer2 className="size-5 text-[var(--settings-accent)]" /><h2 className="font-semibold">{definition?.label ?? role}</h2></div><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">{definition?.description ?? 'Custom cursor role.'}</p></div><button className="inline-flex items-center gap-2 rounded px-2 py-1 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300" onClick={onDelete} type="button"><Trash2 className="size-4" />Delete</button></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="grid gap-4"><label className="grid gap-1 text-sm font-medium">Default role<select className="rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" onChange={(event) => onRoleChange(event.target.value as CursorRole)} value={role}>{cursorRoles.filter((item) => item.key === role || !activeRoles.includes(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><ImageInput description="Upload a fresh visual or select an existing reusable image." label="Image" onChange={(image) => onChange('image', image)} value={cursor.image} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><NumberInput label="Hotspot X" max={64} onChange={(value) => onChange('hotspot_x', value)} value={cursor.hotspot_x} /><NumberInput label="Hotspot Y" max={64} onChange={(value) => onChange('hotspot_y', value)} value={cursor.hotspot_y} /><NumberInput label="Image size" max={128} min={16} onChange={(value) => onChange('size', value)} value={cursor.size} /><TextInput label="Fallback" maxLength={32} onChange={(value) => onChange('fallback', value || null)} value={cursor.fallback ?? ''} /></div></div><CursorPreview cursor={cursor} /></div>
    </article>;
}

function CursorPreview({ cursor }: { cursor: Cursor }) {
    const size = Math.min(128, Math.max(16, cursor.size ?? 32));
    const hotspotX = Math.min(64, cursor.hotspot_x ?? 0);
    const hotspotY = Math.min(64, cursor.hotspot_y ?? 0);
    const markerX = 112;
    const markerY = 76;
    return <div className="grid gap-2"><div><p className="text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">Preview</p><p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">The tiny pointer tip marks the real click point.</p></div><div className="relative h-44 overflow-hidden border border-[var(--settings-border-color)]"><div className="absolute h-px w-full bg-[var(--settings-border-color)]" style={{ top: markerY }} /><div className="absolute h-full w-px bg-[var(--settings-border-color)]" style={{ left: markerX }} /><div className="absolute z-20" style={{ height: size, left: markerX - hotspotX, top: markerY - hotspotY, width: size }}>{cursor.image ? <img alt="" className="h-full w-full object-contain" draggable={false} src={cursor.image} /> : <div className="grid h-full w-full place-items-center border border-dashed border-[var(--settings-border-color)] text-xs text-[var(--settings-muted-text)]">No image</div>}</div><div aria-label="Cursor click point" className="absolute z-30 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--settings-accent)] bg-[var(--settings-panel-background)]" style={{ left: markerX, top: markerY }} /></div></div>;
}

function NumberInput({ label, max, min = 0, onChange, value }: { label: string; max: number; min?: number; onChange: (value: number) => void; value: number | null }) {
    return <label className="grid gap-1 text-sm font-medium">{label}<input className="rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" max={max} min={min} onChange={(event) => onChange(Math.min(max, Math.max(min, Number.parseInt(event.target.value, 10) || min)))} type="number" value={value ?? min} /></label>;
}

function TextInput({ label, maxLength, onChange, value }: { label: string; maxLength: number; onChange: (value: string) => void; value: string }) {
    return <label className="grid gap-1 text-sm font-medium">{label}<input className="rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" maxLength={maxLength} onChange={(event) => onChange(event.target.value)} value={value} /></label>;
}

function emptyCursor(): Cursor {
    return { fallback: null, hotspot_x: null, hotspot_y: null, image: null, size: null };
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
