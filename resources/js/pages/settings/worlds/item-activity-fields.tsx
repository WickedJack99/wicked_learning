import { Package, Plus, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type {
    ActivityForm,
    EditableItem,
    EditableSound,
} from './edit-node-activity-types';
import {
    ConfigImageInput,
    MirrorImageCheckbox,
    NumberField,
} from './activity-config-fields';
import {
    ActivityScenePreview,
    ScenePreviewImage,
    ScenePreviewSlot,
    themedPreviewAsset,
} from './activity-scene-preview';
import { useAppearance } from '@/hooks/use-appearance';

type ItemFieldProps = {
    errors: Record<string, string>;
    form: ActivityForm;
    items: EditableItem[];
    onChange: Dispatch<SetStateAction<ActivityForm>>;
};

export function ItemGrantFlowFields({
    errors,
    form,
    items,
    onChange,
}: ItemFieldProps) {
    const updateRows = (rows: ActivityForm['item_grant_items']) =>
        onChange((current) => ({ ...current, item_grant_items: rows }));

    return (
        <div className="grid gap-4">
            <div className="grid gap-1">
                <NumberField
                    label="Probability"
                    max="100"
                    min="0.01"
                    onChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            item_grant_probability_percent: value,
                        }))
                    }
                    step="0.01"
                    suffix="%"
                    value={form.item_grant_probability_percent}
                />
                <InputError message={errors.item_grant_probability_percent} />
            </div>

            <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                    <Label>Items granted on success</Label>
                    <Button
                        onClick={() =>
                            updateRows([
                                ...form.item_grant_items,
                                { itemId: '', quantity: '1' },
                            ])
                        }
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        <Plus className="size-4" />
                        Add item
                    </Button>
                </div>
                {form.item_grant_items.map((row, index) => (
                    <div
                        className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_8rem_auto] dark:bg-white/5"
                        key={index}
                    >
                        <ItemSelect
                            items={items}
                            onChange={(itemId) => {
                                const next = [...form.item_grant_items];
                                next[index] = { ...row, itemId };
                                updateRows(next);
                            }}
                            value={row.itemId}
                        />
                        <Input
                            min={1}
                            onChange={(event) => {
                                const next = [...form.item_grant_items];
                                next[index] = {
                                    ...row,
                                    quantity: event.currentTarget.value,
                                };
                                updateRows(next);
                            }}
                            type="number"
                            value={row.quantity}
                        />
                        <Button
                            aria-label="Remove item grant row"
                            onClick={() =>
                                updateRows(
                                    form.item_grant_items.filter(
                                        (_, rowIndex) => rowIndex !== index,
                                    ),
                                )
                            }
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                ))}
                <InputError message={errors.item_grant_items} />
            </div>
        </div>
    );
}

export function ItemGrantVisualFields({
    errors,
    form,
    imageUploadErrors,
    items,
    onChange,
    onUpload,
    uploadingImageKey,
}: ItemFieldProps & {
    imageUploadErrors: Record<string, string>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const updateField = (field: keyof ActivityForm, value: string | boolean) =>
        onChange((current) => ({ ...current, [field]: value }));
    const backgroundImage = themedPreviewAsset(
        form.item_grant_background_dark,
        form.item_grant_background_light,
        resolvedAppearance,
    );

    return (
        <div className="grid gap-5">
            <ActivityScenePreview
                backgroundImage={backgroundImage}
                backgroundMirrored={form.item_grant_background_mirrored}
                description="Shows the grant scene and the configured item layout."
                title="Item grant preview"
            >
                <div className="absolute inset-0 z-10 grid place-items-center p-6">
                    <div
                        className="inline-grid justify-center gap-3"
                        style={itemGrantGridStyle(form.item_grant_items.length)}
                    >
                        {form.item_grant_items.map((row, index) => {
                            const item = itemForSlot(items, row.itemId);

                            return (
                                <ItemGrantPreviewTile
                                    imageUrl={themedPreviewAsset(
                                        item?.imageDark,
                                        item?.imageLight,
                                        resolvedAppearance,
                                    )}
                                    key={index}
                                    quantity={row.quantity}
                                    title={item?.title ?? 'Item'}
                                />
                            );
                        })}
                    </div>
                </div>
            </ActivityScenePreview>

            <div className="grid gap-3 md:grid-cols-2">
                {[
                    ['item_grant_background_dark', 'Dark background'],
                    ['item_grant_background_light', 'Light background'],
                ].map(([field, label]) => (
                    <ConfigImageInput
                        description="Displayed behind granted items in this appearance mode."
                        error={errors[field] ?? imageUploadErrors[field]}
                        id={field}
                        key={field}
                        label={label}
                        onChange={(value) =>
                            updateField(field as keyof ActivityForm, value)
                        }
                        onUpload={(file) =>
                            onUpload(field, file, (url) =>
                                updateField(field as keyof ActivityForm, url),
                            )
                        }
                        uploading={uploadingImageKey === field}
                        value={String(form[field as keyof ActivityForm] ?? '')}
                    />
                ))}
            </div>

            <MirrorImageCheckbox
                checked={form.item_grant_background_mirrored}
                label="Mirror background horizontally"
                onChange={(checked) =>
                    updateField('item_grant_background_mirrored', checked)
                }
            />
        </div>
    );
}

export function ItemObstacleFlowFields({
    errors,
    form,
    items,
    onChange,
}: ItemFieldProps) {
    const updateSlots = (slots: ActivityForm['item_obstacle_slots']) =>
        onChange((current) => ({ ...current, item_obstacle_slots: slots }));

    return (
        <div className="grid gap-4">
            <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                    <Label>Required slots</Label>
                    <Button
                        disabled={form.item_obstacle_slots.length >= 10}
                        onClick={() =>
                            updateSlots([
                                ...form.item_obstacle_slots,
                                { itemId: '', x: '50', y: '50', width: '10' },
                            ])
                        }
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        <Plus className="size-4" />
                        Add slot
                    </Button>
                </div>
                {form.item_obstacle_slots.map((slot, index) => (
                    <div
                        className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_repeat(3,5rem)_auto] dark:bg-white/5"
                        key={index}
                    >
                        <ItemSelect
                            items={items}
                            onChange={(itemId) => {
                                const next = [...form.item_obstacle_slots];
                                next[index] = { ...slot, itemId };
                                updateSlots(next);
                            }}
                            value={slot.itemId}
                        />
                        {(['x', 'y', 'width'] as const).map((field) => (
                            <Input
                                key={field}
                                max={100}
                                min={0}
                                onChange={(event) => {
                                    const next = [...form.item_obstacle_slots];
                                    next[index] = {
                                        ...slot,
                                        [field]: event.currentTarget.value,
                                    };
                                    updateSlots(next);
                                }}
                                placeholder={field}
                                type="number"
                                value={slot[field]}
                            />
                        ))}
                        <Button
                            aria-label="Remove item slot"
                            onClick={() =>
                                updateSlots(
                                    form.item_obstacle_slots.filter(
                                        (_, slotIndex) => slotIndex !== index,
                                    ),
                                )
                            }
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                ))}
                <InputError message={errors.item_obstacle_slots} />
            </div>
            <div className="grid gap-1">
                <NumberField
                    label="Failed try lockout"
                    min="0"
                    onChange={(value) =>
                        onChange((current) => ({
                            ...current,
                            item_obstacle_lock_minutes: value,
                        }))
                    }
                    step="1"
                    suffix="min"
                    value={form.item_obstacle_lock_minutes}
                />
                <InputError message={errors.item_obstacle_lock_minutes} />
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                <Checkbox
                    checked={form.item_obstacle_consume_on_each_entry}
                    onCheckedChange={(checked) =>
                        onChange((current) => ({
                            ...current,
                            item_obstacle_consume_on_each_entry:
                                checked === true,
                        }))
                    }
                />
                <span className="grid gap-1">
                    <span className="font-medium">
                        Consume items on every entry
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                        After a successful continue, filled slots are cleared so
                        learners must insert the required consumables again when
                        they replay this activity.
                    </span>
                </span>
            </label>
            <InputError message={errors.item_obstacle_consume_on_each_entry} />
        </div>
    );
}

export function ItemObstacleVisualFields({
    errors,
    form,
    imageUploadErrors,
    items,
    onChange,
    onUpload,
    sounds,
    uploadingImageKey,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
    items: EditableItem[];
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    sounds: EditableSound[];
    uploadingImageKey: string | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const updateField = (field: keyof ActivityForm, value: string | boolean) =>
        onChange((current) => ({ ...current, [field]: value }));
    const backgroundImage = themedPreviewAsset(
        form.item_obstacle_background_dark,
        form.item_obstacle_background_light,
        resolvedAppearance,
    );
    const explicitMetBackgroundImage = themedPreviewAsset(
        form.item_obstacle_met_background_dark,
        form.item_obstacle_met_background_light,
        resolvedAppearance,
    );
    const metBackgroundImage = explicitMetBackgroundImage || backgroundImage;
    const metBackgroundMirrored = explicitMetBackgroundImage
        ? form.item_obstacle_met_background_mirrored
        : form.item_obstacle_background_mirrored;
    const overlayImage = themedPreviewAsset(
        form.item_obstacle_overlay_dark,
        form.item_obstacle_overlay_light,
        resolvedAppearance,
    );

    return (
        <div className="grid gap-5">
            <div className="grid gap-4 lg:grid-cols-2">
                <ActivityScenePreview
                    backgroundImage={backgroundImage}
                    backgroundMirrored={form.item_obstacle_background_mirrored}
                    description="Shows the required item slots in this mode."
                    title="Required slots preview"
                >
                    {form.item_obstacle_slots.map((slot, index) => {
                        const item = itemForSlot(items, slot.itemId);

                        return (
                            <ScenePreviewSlot
                                imageUrl={themedPreviewAsset(
                                    item?.imageDark,
                                    item?.imageLight,
                                    resolvedAppearance,
                                )}
                                key={index}
                                label={(index + 1).toString()}
                                width={slot.width}
                                x={slot.x}
                                y={slot.y}
                            />
                        );
                    })}
                </ActivityScenePreview>

                <ActivityScenePreview
                    backgroundImage={metBackgroundImage}
                    backgroundMirrored={metBackgroundMirrored}
                    description="Shows the scene after all item conditions are met."
                    title="Conditions met preview"
                >
                    {form.item_obstacle_slots.map((slot, index) => {
                        const item = itemForSlot(items, slot.itemId);

                        return (
                            <ScenePreviewSlot
                                imageUrl={themedPreviewAsset(
                                    item?.imageDark,
                                    item?.imageLight,
                                    resolvedAppearance,
                                )}
                                key={index}
                                label={(index + 1).toString()}
                                width={slot.width}
                                x={slot.x}
                                y={slot.y}
                            />
                        );
                    })}
                    <ScenePreviewImage
                        imageUrl={overlayImage}
                        label="Overlay image"
                        mirrored={form.item_obstacle_overlay_mirrored}
                        width={form.item_obstacle_overlay_width}
                        x={form.item_obstacle_overlay_x}
                        y={form.item_obstacle_overlay_y}
                    />
                </ActivityScenePreview>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {[
                    ['item_obstacle_background_dark', 'Dark background'],
                    ['item_obstacle_background_light', 'Light background'],
                    [
                        'item_obstacle_met_background_dark',
                        'Dark met background',
                    ],
                    [
                        'item_obstacle_met_background_light',
                        'Light met background',
                    ],
                    ['item_obstacle_overlay_dark', 'Dark overlay image'],
                    ['item_obstacle_overlay_light', 'Light overlay image'],
                ].map(([field, label]) => (
                    <ConfigImageInput
                        description="Uploaded or reusable scene image."
                        error={errors[field] ?? imageUploadErrors[field]}
                        id={field}
                        key={field}
                        label={label}
                        onChange={(value) =>
                            updateField(field as keyof ActivityForm, value)
                        }
                        onUpload={(file) =>
                            onUpload(field, file, (url) =>
                                updateField(field as keyof ActivityForm, url),
                            )
                        }
                        uploading={uploadingImageKey === field}
                        value={String(form[field as keyof ActivityForm] ?? '')}
                    />
                ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
                <MirrorImageCheckbox
                    checked={form.item_obstacle_background_mirrored}
                    label="Mirror background horizontally"
                    onChange={(checked) =>
                        updateField(
                            'item_obstacle_background_mirrored',
                            checked,
                        )
                    }
                />
                <MirrorImageCheckbox
                    checked={form.item_obstacle_met_background_mirrored}
                    label="Mirror met background horizontally"
                    onChange={(checked) =>
                        updateField(
                            'item_obstacle_met_background_mirrored',
                            checked,
                        )
                    }
                />
                <MirrorImageCheckbox
                    checked={form.item_obstacle_overlay_mirrored}
                    label="Mirror overlay horizontally"
                    onChange={(checked) =>
                        updateField('item_obstacle_overlay_mirrored', checked)
                    }
                />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
                <NumberField
                    label="Overlay X"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('item_obstacle_overlay_x', value)
                    }
                    suffix="%"
                    value={form.item_obstacle_overlay_x}
                />
                <NumberField
                    label="Overlay Y"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('item_obstacle_overlay_y', value)
                    }
                    suffix="%"
                    value={form.item_obstacle_overlay_y}
                />
                <NumberField
                    label="Overlay width"
                    max="100"
                    min="1"
                    onChange={(value) =>
                        updateField('item_obstacle_overlay_width', value)
                    }
                    suffix="%"
                    value={form.item_obstacle_overlay_width}
                />
            </div>
            <div className="grid gap-3">
                {[
                    ['item_obstacle_sound_not_met', 'Conditions not met'],
                    ['item_obstacle_sound_transition', 'Transition to met'],
                    ['item_obstacle_sound_met', 'Conditions met'],
                ].map(([prefix, label]) => (
                    <SoundRow
                        enabled={Boolean(
                            form[`${prefix}_enabled` as keyof ActivityForm],
                        )}
                        key={prefix}
                        label={label}
                        onEnabledChange={(enabled) =>
                            updateField(
                                `${prefix}_enabled` as keyof ActivityForm,
                                enabled,
                            )
                        }
                        onSoundChange={(soundId) =>
                            updateField(
                                `${prefix}_id` as keyof ActivityForm,
                                soundId,
                            )
                        }
                        selectedSoundId={String(
                            form[`${prefix}_id` as keyof ActivityForm] ?? '',
                        )}
                        sounds={sounds}
                    />
                ))}
            </div>
        </div>
    );
}

function itemGrantGridStyle(itemCount: number): CSSProperties {
    const columns = Math.max(1, Math.min(itemCount, 3));

    return {
        gridTemplateColumns: `repeat(${columns}, minmax(0, 5rem))`,
    };
}

function ItemGrantPreviewTile({
    imageUrl,
    quantity,
    title,
}: {
    imageUrl: string;
    quantity: string;
    title: string;
}) {
    return (
        <div className="relative grid aspect-square place-items-center rounded-xl border border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-white/78 p-2 shadow-sm backdrop-blur-sm dark:bg-slate-950/72">
            {imageUrl ? (
                <img
                    alt=""
                    className="size-full object-contain"
                    draggable={false}
                    src={imageUrl}
                />
            ) : (
                <Package className="size-7 text-[var(--settings-accent)]" />
            )}
            <span className="absolute right-1 bottom-1 min-w-5 rounded bg-[var(--settings-accent)] px-1 text-center text-[0.65rem] font-semibold text-[var(--settings-accent-foreground)]">
                {quantity || '1'}
            </span>
            <span className="sr-only">{title}</span>
        </div>
    );
}

function itemForSlot(
    items: EditableItem[],
    value: string,
): EditableItem | null {
    const itemId = Number(value);

    if (!Number.isInteger(itemId)) {
        return null;
    }

    return items.find((item) => item.id === itemId) ?? null;
}

function ItemSelect({
    items,
    onChange,
    value,
}: {
    items: EditableItem[];
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <Select onValueChange={onChange} value={value ?? ''}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
                {items.map((item) => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                        {item.title}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function SoundRow({
    enabled,
    label,
    onEnabledChange,
    onSoundChange,
    selectedSoundId,
    sounds,
}: {
    enabled: boolean;
    label: string;
    onEnabledChange: (enabled: boolean) => void;
    onSoundChange: (soundId: string) => void;
    selectedSoundId: string;
    sounds: EditableSound[];
}) {
    return (
        <div className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[auto_1fr] dark:bg-white/5">
            <label className="flex items-center gap-2 text-sm font-medium">
                <input
                    checked={enabled}
                    onChange={(event) =>
                        onEnabledChange(event.currentTarget.checked)
                    }
                    type="checkbox"
                />
                {label}
            </label>
            <Select
                disabled={!enabled}
                onValueChange={onSoundChange}
                value={selectedSoundId ?? ''}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sound" />
                </SelectTrigger>
                <SelectContent>
                    {sounds.map((sound) => (
                        <SelectItem key={sound.id} value={sound.id.toString()}>
                            {sound.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
