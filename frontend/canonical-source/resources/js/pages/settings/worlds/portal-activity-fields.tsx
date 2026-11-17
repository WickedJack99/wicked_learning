import type { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    PortalScene,
    type PortalSceneAsset,
    type PortalSceneAssetLayer,
} from '@/features/world/portal-scene';
import { useAppearance } from '@/hooks/use-appearance';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ConfigColorField,
    ConfigImageInput,
    MirrorImageCheckbox,
    NumberField,
} from './activity-config-fields';
import type {
    ActivityForm,
    PortalAssetForm,
    PortalCandidate,
} from './edit-node-activity-types';

const portalAssetLayers: Array<{
    description: string;
    label: string;
    value: PortalSceneAssetLayer;
}> = [
    {
        description: 'Rendered behind the configured background image.',
        label: 'Behind background',
        value: 'behind-background',
    },
    {
        description: 'Rendered over the background, behind the rotating swirl.',
        label: 'Above background',
        value: 'above-background',
    },
    {
        description: 'Rendered over the swirl and portal foreground.',
        label: 'Above swirl',
        value: 'above-foreground',
    },
    {
        description: 'Rendered at the front of the portal scene.',
        label: 'Front',
        value: 'front',
    },
];

export function PortalModeField({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor="portal-mode">Portal direction</Label>
            <Select
                onValueChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        portal_mode: value as 'input' | 'output',
                        target_portal_activity_id:
                            value === 'input'
                                ? ''
                                : current.target_portal_activity_id,
                    }))
                }
                value={form.portal_mode}
            >
                <SelectTrigger className="w-full" id="portal-mode">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="input">Exit portal</SelectItem>
                    <SelectItem value="output">Entry portal</SelectItem>
                </SelectContent>
            </Select>
            <InputError message={errors.portal_mode} />
            {form.portal_mode === 'input' ? (
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                    <Checkbox
                        checked={form.portal_show_on_arrival}
                        onCheckedChange={(checked) =>
                            onChange((current) => ({
                                ...current,
                                portal_show_on_arrival: checked === true,
                            }))
                        }
                    />
                    <span className="grid gap-1">
                        <span className="font-semibold text-slate-900 dark:text-white">
                            Show this exit portal when arriving
                        </span>
                        <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Disable this when the arrival should complete
                            silently and continue to the next connected
                            activity.
                        </span>
                    </span>
                </label>
            ) : null}
            <InputError message={errors.portal_show_on_arrival} />
        </div>
    );
}

export function PortalTargetField({
    candidates,
    errors,
    form,
    onChange,
}: {
    candidates: PortalCandidate[];
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    if (form.type !== 'portal' || form.portal_mode !== 'output') {
        return null;
    }

    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <Label htmlFor="portal-target">Travel target</Label>
            <Select
                onValueChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        target_portal_activity_id:
                            value === 'none' ? '' : value,
                    }))
                }
                value={form.target_portal_activity_id || 'none'}
            >
                <SelectTrigger className="w-full" id="portal-target">
                    <SelectValue placeholder="Choose exit portal activity" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">No target yet</SelectItem>
                    {candidates.map((candidate) => (
                        <SelectItem
                            key={candidate.id}
                            value={candidate.id.toString()}
                        >
                            {candidate.mapTitle} / {candidate.nodeTitle} /{' '}
                            {candidate.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Entry portals end this activity path and move learners to the
                selected exit portal.
            </p>
            <InputError message={errors.target_portal_activity_id} />
        </div>
    );
}

export function PortalVisualFields({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    uploadingImageKey,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const updateField = (field: keyof ActivityForm, value: string | boolean) =>
        onChange((current) => ({
            ...current,
            [field]: value,
        }));
    const previewBackground =
        resolvedAppearance === 'light'
            ? form.portal_background_light || form.portal_background_dark
            : form.portal_background_dark || form.portal_background_light;
    const previewForeground =
        resolvedAppearance === 'light'
            ? form.portal_foreground_light || form.portal_foreground_dark
            : form.portal_foreground_dark || form.portal_foreground_light;
    const previewAssets = portalSceneAssets(
        form.portal_assets,
        resolvedAppearance,
    );
    const foregroundX = boundedNumber(form.portal_foreground_x, 50, 0, 100);
    const foregroundY = boundedNumber(form.portal_foreground_y, 50, 0, 100);
    const foregroundWidth = boundedNumber(
        form.portal_foreground_width,
        28,
        1,
        100,
    );
    const previewBubbleText = form.portal_bubble_text.trim();
    const previewBubbleStyle = portalBubblePreviewStyle(
        form,
        resolvedAppearance,
    );

    const imageFields: Array<{
        description: string;
        field: keyof ActivityForm;
        label: string;
    }> = [
        {
            description:
                'Displayed behind the portal effect when the learner uses dark mode.',
            field: 'portal_background_dark',
            label: 'Dark background image',
        },
        {
            description:
                'Optional light-mode override. If empty, the dark image is reused.',
            field: 'portal_background_light',
            label: 'Light background image',
        },
        {
            description:
                'Displayed in front of the background and can rotate around its center.',
            field: 'portal_foreground_dark',
            label: 'Dark swirl image',
        },
        {
            description:
                'Optional light-mode override. If empty, the dark swirl is reused.',
            field: 'portal_foreground_light',
            label: 'Light swirl image',
        },
    ];
    const addAsset = () =>
        onChange((current) => ({
            ...current,
            portal_assets: [
                ...current.portal_assets,
                createPortalAsset(current.portal_assets.length),
            ],
        }));
    const removeAsset = (assetId: string) =>
        onChange((current) => ({
            ...current,
            portal_assets: current.portal_assets.filter(
                (asset) => asset.id !== assetId,
            ),
        }));
    const updateAsset = (assetId: string, changes: Partial<PortalAssetForm>) =>
        onChange((current) => ({
            ...current,
            portal_assets: current.portal_assets.map((asset) =>
                asset.id === assetId ? { ...asset, ...changes } : asset,
            ),
        }));

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">
                    Portal visuals
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    These settings control the full-screen portal moment before
                    the learner arrives at the linked node.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {imageFields.map((imageField) => (
                    <ConfigImageInput
                        description={imageField.description}
                        error={
                            errors[imageField.field] ??
                            imageUploadErrors[imageField.field]
                        }
                        id={imageField.field}
                        key={imageField.field}
                        label={imageField.label}
                        onChange={(value) =>
                            updateField(imageField.field, value)
                        }
                        onUpload={(file) =>
                            onUpload(String(imageField.field), file, (url) =>
                                updateField(imageField.field, url),
                            )
                        }
                        uploading={uploadingImageKey === imageField.field}
                        value={String(form[imageField.field] ?? '')}
                    />
                ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                    <Label htmlFor="portal-foreground-x">Swirl X</Label>
                    <Input
                        id="portal-foreground-x"
                        max="100"
                        min="0"
                        onChange={(event) =>
                            updateField(
                                'portal_foreground_x',
                                event.currentTarget.value,
                            )
                        }
                        step="1"
                        type="number"
                        value={form.portal_foreground_x}
                    />
                    <InputError message={errors.portal_foreground_x} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="portal-foreground-y">Swirl Y</Label>
                    <Input
                        id="portal-foreground-y"
                        max="100"
                        min="0"
                        onChange={(event) =>
                            updateField(
                                'portal_foreground_y',
                                event.currentTarget.value,
                            )
                        }
                        step="1"
                        type="number"
                        value={form.portal_foreground_y}
                    />
                    <InputError message={errors.portal_foreground_y} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="portal-foreground-width">Swirl width</Label>
                    <Input
                        id="portal-foreground-width"
                        max="100"
                        min="1"
                        onChange={(event) =>
                            updateField(
                                'portal_foreground_width',
                                event.currentTarget.value,
                            )
                        }
                        step="1"
                        type="number"
                        value={form.portal_foreground_width}
                    />
                    <InputError message={errors.portal_foreground_width} />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <MirrorImageCheckbox
                    checked={form.portal_background_mirrored}
                    description="Useful when the portal background should face the other direction."
                    label="Mirror background horizontally"
                    onChange={(checked) =>
                        updateField('portal_background_mirrored', checked)
                    }
                />
                <MirrorImageCheckbox
                    checked={form.portal_foreground_mirrored}
                    description="Flip the foreground portal effect without editing the image file."
                    label="Mirror swirl horizontally"
                    onChange={(checked) =>
                        updateField('portal_foreground_mirrored', checked)
                    }
                />
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-slate-950 dark:text-white">
                            Additional scene assets
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Layer extra images into the portal scene, for
                            example a destination view behind an empty portal
                            frame.
                        </p>
                    </div>
                    <button
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
                        onClick={addAsset}
                        type="button"
                    >
                        <Plus className="size-4" />
                        Add asset
                    </button>
                </div>

                {form.portal_assets.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No extra portal assets yet.
                    </p>
                ) : (
                    <div className="grid gap-3">
                        {form.portal_assets.map((asset, index) => (
                            <PortalAssetEditor
                                asset={asset}
                                errors={errors}
                                imageUploadErrors={imageUploadErrors}
                                index={index}
                                key={asset.id}
                                onRemove={() => removeAsset(asset.id)}
                                onUpdate={(changes) =>
                                    updateAsset(asset.id, changes)
                                }
                                onUpload={onUpload}
                                uploadingImageKey={uploadingImageKey}
                            />
                        ))}
                    </div>
                )}
            </div>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-white/10">
                <Checkbox
                    checked={form.portal_swirl_enabled}
                    className="mt-0.5"
                    onCheckedChange={(checked) =>
                        updateField('portal_swirl_enabled', checked === true)
                    }
                />
                <span>
                    <span className="block text-sm font-medium text-slate-950 dark:text-white">
                        Rotate swirl image
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Disable this when the configured image should stay
                        still.
                    </span>
                </span>
            </label>
            <InputError message={errors.portal_swirl_enabled} />

            <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <div>
                    <p className="text-sm font-medium text-slate-950 dark:text-white">
                        Portal text bubble
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Optional text shown before the learner traverses or
                        continues from the portal.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="portal-bubble-text">Bubble text</Label>
                    <textarea
                        className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                        id="portal-bubble-text"
                        onChange={(event) =>
                            updateField(
                                'portal_bubble_text',
                                event.currentTarget.value,
                            )
                        }
                        placeholder="Before you lies an unexplored world..."
                        value={form.portal_bubble_text}
                    />
                    <InputError message={errors.portal_bubble_text} />
                </div>
                <NumberField
                    label="Typing speed"
                    max="500"
                    min="1"
                    onChange={(value) =>
                        updateField('portal_bubble_typing_speed', value)
                    }
                    value={form.portal_bubble_typing_speed || '24'}
                />
                <InputError message={errors.portal_bubble_typing_speed} />
                <div className="grid gap-3 md:grid-cols-2">
                    <ConfigColorField
                        label="Dark bubble color"
                        onChange={(value) =>
                            updateField('portal_bubble_color_dark', value)
                        }
                        value={form.portal_bubble_color_dark}
                    />
                    <ConfigColorField
                        label="Light bubble color"
                        onChange={(value) =>
                            updateField('portal_bubble_color_light', value)
                        }
                        value={form.portal_bubble_color_light}
                    />
                    <ConfigColorField
                        label="Dark border color"
                        onChange={(value) =>
                            updateField(
                                'portal_bubble_border_color_dark',
                                value,
                            )
                        }
                        value={form.portal_bubble_border_color_dark}
                    />
                    <ConfigColorField
                        label="Light border color"
                        onChange={(value) =>
                            updateField(
                                'portal_bubble_border_color_light',
                                value,
                            )
                        }
                        value={form.portal_bubble_border_color_light}
                    />
                    <ConfigColorField
                        label="Dark text color"
                        onChange={(value) =>
                            updateField('portal_bubble_text_color_dark', value)
                        }
                        value={form.portal_bubble_text_color_dark}
                    />
                    <ConfigColorField
                        label="Light text color"
                        onChange={(value) =>
                            updateField('portal_bubble_text_color_light', value)
                        }
                        value={form.portal_bubble_text_color_light}
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <div>
                    <p className="text-sm font-medium text-slate-950 dark:text-white">
                        Preview
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Uses the current appearance mode and falls back to the
                        other mode if one image is not configured.
                    </p>
                </div>
                <PortalScene
                    assets={previewAssets}
                    backgroundImage={previewBackground}
                    backgroundMirrored={form.portal_background_mirrored}
                    foregroundImage={previewForeground}
                    foregroundMirrored={form.portal_foreground_mirrored}
                    foregroundWidth={foregroundWidth}
                    foregroundX={foregroundX}
                    foregroundY={foregroundY}
                    showForegroundPlaceholder
                    swirlEnabled={form.portal_swirl_enabled}
                >
                    {previewBubbleText ? (
                        <div
                            className="relative z-30 mt-auto w-full rounded-lg border p-3 text-sm leading-6"
                            style={previewBubbleStyle}
                        >
                            {previewBubbleText}
                        </div>
                    ) : null}
                </PortalScene>
            </div>
        </div>
    );
}

function PortalAssetEditor({
    asset,
    errors,
    imageUploadErrors,
    index,
    onRemove,
    onUpdate,
    onUpload,
    uploadingImageKey,
}: {
    asset: PortalAssetForm;
    errors: Record<string, string>;
    imageUploadErrors: Record<string, string>;
    index: number;
    onRemove: () => void;
    onUpdate: (changes: Partial<PortalAssetForm>) => void;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const fieldPrefix = `portal_assets.${index}`;
    const uploadKey = (field: 'imageDark' | 'imageLight') =>
        `portal_asset_${asset.id}_${field}`;

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-2">
                    <Label htmlFor={`portal-asset-label-${asset.id}`}>
                        Asset label
                    </Label>
                    <Input
                        id={`portal-asset-label-${asset.id}`}
                        onChange={(event) =>
                            onUpdate({ label: event.currentTarget.value })
                        }
                        value={asset.label}
                    />
                    <InputError message={errors[`${fieldPrefix}.label`]} />
                </div>
                <button
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                    onClick={onRemove}
                    type="button"
                >
                    <Trash2 className="size-4" />
                    Remove
                </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <ConfigImageInput
                    description="Used when the portal is shown in dark mode."
                    error={
                        errors[`${fieldPrefix}.imageDark`] ??
                        imageUploadErrors[uploadKey('imageDark')]
                    }
                    id={`portal-asset-dark-${asset.id}`}
                    label="Dark mode image"
                    onChange={(value) => onUpdate({ imageDark: value })}
                    onUpload={(file) =>
                        onUpload(uploadKey('imageDark'), file, (url) =>
                            onUpdate({ imageDark: url }),
                        )
                    }
                    uploading={uploadingImageKey === uploadKey('imageDark')}
                    value={asset.imageDark}
                />
                <ConfigImageInput
                    description="Optional light-mode override. If empty, the dark image is reused."
                    error={
                        errors[`${fieldPrefix}.imageLight`] ??
                        imageUploadErrors[uploadKey('imageLight')]
                    }
                    id={`portal-asset-light-${asset.id}`}
                    label="Light mode image"
                    onChange={(value) => onUpdate({ imageLight: value })}
                    onUpload={(file) =>
                        onUpload(uploadKey('imageLight'), file, (url) =>
                            onUpdate({ imageLight: url }),
                        )
                    }
                    uploading={uploadingImageKey === uploadKey('imageLight')}
                    value={asset.imageLight}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-5">
                <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor={`portal-asset-layer-${asset.id}`}>
                        Layer
                    </Label>
                    <Select
                        onValueChange={(value) =>
                            onUpdate({
                                layer: value as PortalSceneAssetLayer,
                            })
                        }
                        value={asset.layer}
                    >
                        <SelectTrigger id={`portal-asset-layer-${asset.id}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {portalAssetLayers.map((layer) => (
                                <SelectItem
                                    key={layer.value}
                                    value={layer.value}
                                >
                                    {layer.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {portalAssetLayers.find(
                            (layer) => layer.value === asset.layer,
                        )?.description ?? portalAssetLayers[1].description}
                    </p>
                    <InputError message={errors[`${fieldPrefix}.layer`]} />
                </div>

                <NumberInput
                    error={errors[`${fieldPrefix}.x`]}
                    id={`portal-asset-x-${asset.id}`}
                    label="X"
                    max="100"
                    min="0"
                    onChange={(value) => onUpdate({ x: value })}
                    value={asset.x}
                />
                <NumberInput
                    error={errors[`${fieldPrefix}.y`]}
                    id={`portal-asset-y-${asset.id}`}
                    label="Y"
                    max="100"
                    min="0"
                    onChange={(value) => onUpdate({ y: value })}
                    value={asset.y}
                />
                <NumberInput
                    error={errors[`${fieldPrefix}.width`]}
                    id={`portal-asset-width-${asset.id}`}
                    label="Width"
                    max="160"
                    min="1"
                    onChange={(value) => onUpdate({ width: value })}
                    value={asset.width}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <NumberInput
                    error={errors[`${fieldPrefix}.opacity`]}
                    id={`portal-asset-opacity-${asset.id}`}
                    label="Opacity"
                    max="100"
                    min="0"
                    onChange={(value) => onUpdate({ opacity: value })}
                    value={asset.opacity}
                />
                <MirrorImageCheckbox
                    checked={asset.mirrored}
                    description="Flip this scene asset horizontally."
                    label="Mirror asset horizontally"
                    onChange={(checked) => onUpdate({ mirrored: checked })}
                />
            </div>
        </div>
    );
}

function NumberInput({
    error,
    id,
    label,
    max,
    min,
    onChange,
    value,
}: {
    error?: string;
    id: string;
    label: string;
    max: string;
    min: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                max={max}
                min={min}
                onChange={(event) => onChange(event.currentTarget.value)}
                step="1"
                type="number"
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function createPortalAsset(index: number): PortalAssetForm {
    const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `portal-asset-${Date.now().toString(36)}-${index}`;

    return {
        id,
        imageDark: '',
        imageLight: '',
        label: `Asset ${index + 1}`,
        layer: 'above-background',
        mirrored: false,
        opacity: '100',
        width: '28',
        x: '50',
        y: '50',
    };
}

function portalSceneAssets(
    assets: PortalAssetForm[],
    appearance: 'dark' | 'light',
): PortalSceneAsset[] {
    return assets
        .map((asset): PortalSceneAsset => {
            const image =
                appearance === 'light'
                    ? asset.imageLight || asset.imageDark
                    : asset.imageDark || asset.imageLight;

            return {
                id: asset.id,
                image,
                layer: portalSceneAssetLayer(asset.layer),
                mirrored: asset.mirrored,
                opacity: boundedNumber(asset.opacity, 100, 0, 100),
                width: boundedNumber(asset.width, 28, 1, 160),
                x: boundedNumber(asset.x, 50, 0, 100),
                y: boundedNumber(asset.y, 50, 0, 100),
            };
        })
        .filter((asset) => asset.image);
}

function portalSceneAssetLayer(value: string): PortalSceneAssetLayer {
    return portalAssetLayers.some((layer) => layer.value === value)
        ? (value as PortalSceneAssetLayer)
        : 'above-background';
}

function portalBubblePreviewStyle(
    form: ActivityForm,
    appearance: 'dark' | 'light',
) {
    const isLight = appearance === 'light';

    return {
        backgroundColor:
            (isLight
                ? form.portal_bubble_color_light
                : form.portal_bubble_color_dark) ||
            (isLight ? '#ffffff' : '#0f172a'),
        borderColor:
            (isLight
                ? form.portal_bubble_border_color_light
                : form.portal_bubble_border_color_dark) ||
            (isLight ? '#0891b2' : '#2dd4bf'),
        color:
            (isLight
                ? form.portal_bubble_text_color_light
                : form.portal_bubble_text_color_dark) ||
            (isLight ? '#0f172a' : '#f8fafc'),
    };
}

function boundedNumber(
    value: string,
    fallback: number,
    min: number,
    max: number,
): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
}
