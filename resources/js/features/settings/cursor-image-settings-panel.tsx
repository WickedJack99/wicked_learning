import { router } from '@inertiajs/react';
import { MousePointer2, Plus, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfigImageInput } from '@/components/config-image-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { uploadMediaFile } from '@/lib/media-upload';
import type {
    CursorImageSettings,
    PublicPresentationSettings,
} from '@/theme/presentation';

type CursorKey = keyof PublicPresentationSettings['cursors'];

type CursorRole = {
    description: string;
    key: CursorKey;
    label: string;
};

const cursorRoles: CursorRole[] = [
    {
        key: 'default',
        label: 'Normal cursor',
        description: 'Used on passive surfaces and normal map areas.',
    },
    {
        key: 'action',
        label: 'Action pointer',
        description: 'Used on buttons, links and other clickable controls.',
    },
    {
        key: 'grab',
        label: 'Grab cursor',
        description: 'Used while dragging maps and graph surfaces.',
    },
    {
        key: 'text',
        label: 'Text input cursor',
        description: 'Used when hovering editable input and text areas.',
    },
    {
        key: 'denied',
        label: 'Denied cursor',
        description: 'Used on disabled controls and unavailable locked nodes.',
    },
];

export function CursorImageSettingsPanel({
    presentation,
}: {
    presentation: PublicPresentationSettings;
}) {
    const [draft, setDraft] = useState<PublicPresentationSettings>(() =>
        structuredClone(presentation),
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const hasChanges = useDirtyState(draft.cursors, presentation.cursors);
    const activeCursorKeys = Object.keys(draft.cursors) as CursorKey[];
    const availableRoles = useMemo(
        () =>
            cursorRoles.filter((role) => !activeCursorKeys.includes(role.key)),
        [activeCursorKeys],
    );

    function addCursorRole() {
        const role = availableRoles[0];

        if (!role) {
            return;
        }

        setDraft((current) => ({
            ...current,
            cursors: {
                ...current.cursors,
                [role.key]: {},
            },
        }));
    }

    function removeCursorRole(key: CursorKey) {
        setDraft((current) => {
            const next = { ...current.cursors };
            delete next[key];

            return { ...current, cursors: next };
        });
    }

    function changeCursorRole(from: CursorKey, to: CursorKey) {
        if (from === to) {
            return;
        }

        setDraft((current) => {
            const next = { ...current.cursors };
            next[to] = next[from];
            delete next[from];

            return { ...current, cursors: next };
        });
    }

    function updateCursor(
        key: CursorKey,
        field: keyof CursorImageSettings,
        value: number | string,
    ) {
        setDraft((current) => ({
            ...current,
            cursors: {
                ...current.cursors,
                [key]: {
                    ...(current.cursors[key] ?? {}),
                    [field]: value,
                },
            },
        }));
    }

    async function uploadCursorImage(key: CursorKey, file: File) {
        const fieldKey = `cursors.${key}.image`;

        setUploading(fieldKey);
        setErrors((current) => ({ ...current, [fieldKey]: '' }));

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/presentation/background-images',
                errorMessage: 'The image could not be uploaded.',
                fieldName: 'image',
                file,
            });
            updateCursor(key, 'image', payload.url);
        } catch (error) {
            setErrors((current) => ({
                ...current,
                [fieldKey]:
                    error instanceof Error
                        ? error.message
                        : 'The image could not be uploaded.',
            }));
        } finally {
            setUploading(null);
        }
    }

    function save() {
        if (!hasChanges) {
            return;
        }

        setSaving(true);
        router.patch('/settings/presentation', draft, {
            preserveScroll: true,
            preserveState: true,
            onError: (validationErrors) => setErrors(validationErrors),
            onSuccess: () => setErrors({}),
            onFinish: () => setSaving(false),
        });
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-[var(--settings-border-color)] pb-5">
                <div>
                    <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                        <MousePointer2 className="size-5" />
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            Cursor images
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                        Configure reusable cursor image assets for normal,
                        action, grab, text and denied states.
                    </p>
                </div>
            </div>

            <div className="flex shrink-0 justify-end border-b border-[var(--settings-border-color)] py-4">
                <Button
                    disabled={!availableRoles.length}
                    onClick={addCursorRole}
                    type="button"
                    variant="secondary"
                >
                    <Plus className="size-4" />
                    Add cursor role
                </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-5 pr-1">
                <div className="grid gap-4">
                    {activeCursorKeys.map((cursorKey) => {
                        const role = cursorRoles.find(
                            (item) => item.key === cursorKey,
                        );

                        return (
                            <article
                                className="border-t border-[var(--settings-border-color)] py-5 first:border-t-0 first:pt-0"
                                key={cursorKey}
                            >
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                                            {role?.label ?? cursorKey}
                                        </h3>
                                        <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                                            {role?.description ??
                                                'Custom cursor role.'}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() =>
                                            removeCursorRole(cursorKey)
                                        }
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <Trash2 className="size-4" />
                                        Delete
                                    </Button>
                                </div>

                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label>Default role</Label>
                                            <select
                                                className="h-9 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-3 text-sm"
                                                onChange={(event) =>
                                                    changeCursorRole(
                                                        cursorKey,
                                                        event.currentTarget
                                                            .value as CursorKey,
                                                    )
                                                }
                                                value={cursorKey}
                                            >
                                                {cursorRoles
                                                    .filter(
                                                        (item) =>
                                                            item.key ===
                                                                cursorKey ||
                                                            !activeCursorKeys.includes(
                                                                item.key,
                                                            ),
                                                    )
                                                    .map((item) => (
                                                        <option
                                                            key={item.key}
                                                            value={item.key}
                                                        >
                                                            {item.label}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>

                                        <ConfigImageInput
                                            error={
                                                errors[
                                                    `cursors.${cursorKey}.image`
                                                ]
                                            }
                                            id={`${cursorKey}-cursor-image`}
                                            label="Image"
                                            onChange={(value) =>
                                                updateCursor(
                                                    cursorKey,
                                                    'image',
                                                    value,
                                                )
                                            }
                                            onUpload={(file) =>
                                                uploadCursorImage(
                                                    cursorKey,
                                                    file,
                                                )
                                            }
                                            placeholder="/images/cursors/example.svg"
                                            uploading={
                                                uploading ===
                                                `cursors.${cursorKey}.image`
                                            }
                                            value={
                                                draft.cursors[cursorKey]
                                                    ?.image ?? ''
                                            }
                                        />

                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <CursorNumberInput
                                                error={
                                                    errors[
                                                        `cursors.${cursorKey}.hotspotX`
                                                    ]
                                                }
                                                label="Hotspot X"
                                                onChange={(value) =>
                                                    updateCursor(
                                                        cursorKey,
                                                        'hotspotX',
                                                        value,
                                                    )
                                                }
                                                value={
                                                    draft.cursors[cursorKey]
                                                        ?.hotspotX ?? 0
                                                }
                                            />
                                            <CursorNumberInput
                                                error={
                                                    errors[
                                                        `cursors.${cursorKey}.hotspotY`
                                                    ]
                                                }
                                                label="Hotspot Y"
                                                onChange={(value) =>
                                                    updateCursor(
                                                        cursorKey,
                                                        'hotspotY',
                                                        value,
                                                    )
                                                }
                                                value={
                                                    draft.cursors[cursorKey]
                                                        ?.hotspotY ?? 0
                                                }
                                            />
                                            <CursorNumberInput
                                                error={
                                                    errors[
                                                        `cursors.${cursorKey}.size`
                                                    ]
                                                }
                                                label="Image size"
                                                max={128}
                                                min={16}
                                                onChange={(value) =>
                                                    updateCursor(
                                                        cursorKey,
                                                        'size',
                                                        value,
                                                    )
                                                }
                                                value={
                                                    draft.cursors[cursorKey]
                                                        ?.size ?? 32
                                                }
                                            />
                                            <CursorTextInput
                                                error={
                                                    errors[
                                                        `cursors.${cursorKey}.fallback`
                                                    ]
                                                }
                                                label="Fallback"
                                                onChange={(value) =>
                                                    updateCursor(
                                                        cursorKey,
                                                        'fallback',
                                                        value,
                                                    )
                                                }
                                                value={
                                                    draft.cursors[cursorKey]
                                                        ?.fallback ?? ''
                                                }
                                            />
                                        </div>
                                    </div>

                                    <CursorPreview
                                        cursor={draft.cursors[cursorKey] ?? {}}
                                    />
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
            <footer className="flex shrink-0 justify-start border-t border-[var(--settings-border-color)] py-4">
                <Button disabled={saving || !hasChanges} onClick={save}>
                    <Save className="size-4" />
                    Save cursors
                </Button>
            </footer>
        </div>
    );
}

function CursorNumberInput({
    error,
    label,
    max,
    min = 0,
    onChange,
    value,
}: {
    error?: string;
    label: string;
    max?: number;
    min?: number;
    onChange: (value: number) => void;
    value: number;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                max={max}
                min={min}
                onChange={(event) =>
                    onChange(
                        Number.parseInt(event.currentTarget.value, 10) || 0,
                    )
                }
                type="number"
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function CursorTextInput({
    error,
    label,
    onChange,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function CursorPreview({ cursor }: { cursor: CursorImageSettings }) {
    const image = cursor.image ?? '';
    const size = clampCursorSize(cursor.size);
    const hotspotX = clampCursorPoint(cursor.hotspotX, size);
    const hotspotY = clampCursorPoint(cursor.hotspotY, size);
    const markerX = 112;
    const markerY = 76;

    return (
        <div className="grid gap-2">
            <div>
                <p className="text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                    Preview
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                    The tiny pointer tip marks the real click point.
                </p>
            </div>
            <div className="relative h-44 overflow-hidden border border-[var(--settings-border-color)] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--settings-accent)_12%,transparent),var(--settings-content-background))]">
                <div
                    className="absolute h-px w-full bg-[var(--settings-border-color)]"
                    style={{ top: markerY }}
                />
                <div
                    className="absolute h-full w-px bg-[var(--settings-border-color)]"
                    style={{ left: markerX }}
                />
                <div
                    aria-hidden="true"
                    className="absolute z-20"
                    style={{
                        height: size,
                        left: markerX - hotspotX,
                        top: markerY - hotspotY,
                        width: size,
                    }}
                >
                    {image ? (
                        <img
                            alt=""
                            className="h-full w-full object-contain"
                            draggable={false}
                            src={image}
                        />
                    ) : (
                        <div className="grid h-full w-full place-items-center rounded-lg border border-dashed border-[var(--settings-border-color)] text-[0.65rem] text-[var(--settings-muted-text)]">
                            No image
                        </div>
                    )}
                </div>
                <div
                    aria-label="Cursor click point"
                    className="absolute z-30"
                    style={{
                        left: markerX,
                        top: markerY,
                    }}
                >
                    <div className="h-0 w-0 border-t-[14px] border-r-[8px] border-t-slate-950 border-r-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.9)] dark:border-t-white dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]" />
                    <div className="absolute top-0 left-0 h-1.5 w-1.5 -translate-x-0.5 -translate-y-0.5 rounded-full bg-[var(--settings-accent)] ring-2 ring-[var(--settings-panel-background)]" />
                </div>
            </div>
        </div>
    );
}

function clampCursorSize(value: number | null | undefined): number {
    const size =
        typeof value === 'number' && Number.isFinite(value) ? value : 32;

    return Math.min(128, Math.max(16, Math.round(size)));
}

function clampCursorPoint(
    value: number | null | undefined,
    size: number,
): number {
    const point =
        typeof value === 'number' && Number.isFinite(value) ? value : 0;

    return Math.min(size, Math.max(0, Math.round(point)));
}
