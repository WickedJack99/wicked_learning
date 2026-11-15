import {
    Eye,
    EyeOff,
    MousePointerClick,
    Plus,
    Sparkles,
    Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { ConfigImageInput } from './lifted-config-image-input';
import { LiftedInputError as InputError } from './lifted-input-error';
import { LiftedButton as Button } from './lifted-button';
import { LiftedInput as Input } from './lifted-input';
import { LiftedLabel as Label } from './lifted-label';
import { ImageAlphaHitArea } from './lifted-image-alpha-mask';
import {
    mapAssetImageFit,
    mapAssetImagePosition,
} from './lifted-map-asset-image';
import {
    mapAssetInteractionMode,
    mapAssetSurface,
} from './lifted-map-asset-interaction';
import { MapAssetVisual } from './lifted-map-asset-visual';
import { withOpacity } from './lifted-world-theme';
import type {
    MapAsset,
    MapAssetInteractionConfig,
    MapAssetInteractionMode,
    ResolvedAppearance,
} from './lifted-world-builder-types';
import { usePlatformTranslation } from './original-platform-translation';
import { classNames as cn } from './lifted-class-names';

export type MapAssetNode = {
    id: string;
    label?: string;
    title: string;
    visualConfig?: Record<string, unknown>;
};

/** The source Radix checkbox is adapted to the available native control. */
function Checkbox({
    checked,
    className,
    id,
    onCheckedChange,
}: {
    checked: boolean;
    className?: string;
    id?: string;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <input
            checked={checked}
            className={className}
            id={id}
            onChange={(event) => onCheckedChange(event.currentTarget.checked)}
            type="checkbox"
        />
    );
}

export function MapAssetEditor({
    assets,
    mapId,
    mapLocked,
    nodes,
    appearance = 'dark',
    onSelectAsset,
    previewAsset,
    previewSecondState = false,
    previewNode,
    previewImage,
    previewOverlay,
    toolbarAction,
    onAddAsset,
    onImportAsset,
}: {
    assets: MapAsset[];
    mapId: string;
    mapLocked: boolean;
    nodes: MapAssetNode[];
    appearance?: ResolvedAppearance;
    onSelectAsset?: (asset: MapAsset) => void;
    previewAsset?: MapAsset;
    previewSecondState?: boolean;
    previewNode?: MapAssetNode;
    previewImage?: string;
    previewOverlay?: string;
    toolbarAction?: ReactNode;
    onAddAsset?: () => Promise<void>;
    onImportAsset?: (file: File) => Promise<void>;
    onUploadImage?: (file: File) => Promise<{ url: string }>;
}) {
    const t = usePlatformTranslation();
    const [processing, setProcessing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
    const manifestInputRef = useRef<HTMLInputElement>(null);

    const addAsset = async () => {
        setProcessing(true);
        setActionError(null);
        try {
            if (!onAddAsset) {
                throw new Error('The MapAsset writer is unavailable.');
            }
            await onAddAsset();
        } catch {
            setActionError(
                t(
                    'settings.world_builder.map_asset.add_error',
                    'The MapAsset could not be added.',
                ),
            );
        } finally {
            setProcessing(false);
        }
    };

    const importAsset = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        setImporting(true);
        setActionError(null);
        try {
            if (!onImportAsset) {
                throw new Error('The MapAsset importer is unavailable.');
            }
            await onImportAsset(file);
        } catch {
            setActionError('The MapAsset could not be imported.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="relative h-full min-h-0">
            <div
                className="relative h-full min-h-[32rem] overflow-hidden bg-slate-950 select-none"
                style={{
                    backgroundImage: previewImage
                        ? `url(${previewImage})`
                        : undefined,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                }}
            >
                <div
                    className="absolute inset-0"
                    style={{ background: previewOverlay }}
                />
                <div className="absolute top-4 right-4 z-30 flex flex-wrap justify-end gap-2">
                    {toolbarAction}
                    <input
                        accept=".json,.zip,application/json,application/zip,text/plain"
                        className="hidden"
                        onChange={(event) => void importAsset(event)}
                        ref={manifestInputRef}
                        type="file"
                    />
                    <Button
                        disabled={importing}
                        onClick={() => manifestInputRef.current?.click()}
                        type="button"
                        variant="outline"
                    >
                        <Upload className="size-4" />
                        {importing ? 'Importing…' : 'Import asset'}
                    </Button>
                    <Button
                        className="shadow-xl"
                        disabled={processing}
                        onClick={() => void addAsset()}
                        type="button"
                    >
                        <Plus className="size-4" />
                        {t('settings.world_builder.map_asset.add', 'Add Asset')}
                    </Button>
                </div>
                {actionError ? (
                    <p
                        aria-live="polite"
                        className="absolute right-4 bottom-10 z-30 max-w-sm rounded-md border border-red-300/40 bg-slate-950/90 px-3 py-2 text-sm text-red-100 shadow-xl"
                        role="alert"
                    >
                        {actionError}
                    </p>
                ) : null}
                <div className="absolute inset-0">
                    {assets.map((asset) => {
                        const assetToRender =
                            previewAsset?.id === asset.id
                                ? previewAsset
                                : asset;
                        const mapNode = nodes.find(
                            (candidate) => candidate.id === asset.nodeId,
                        );
                        const node =
                            mapNode && previewNode?.id === mapNode.id
                                ? { ...mapNode, ...previewNode }
                                : mapNode;
                        const surface = mapAssetSurface(
                            assetToRender,
                            previewAsset?.id === asset.id && previewSecondState,
                        );
                        const visualConfig = mergeAssetVisualConfig(
                            node?.visualConfig,
                            assetToRender.visualConfig,
                            appearance,
                        );
                        const assetLabel =
                            node?.label ??
                            node?.title ??
                            assetToRender.text ??
                            `MapAsset ${asset.id}`;
                        const visualLabel =
                            node?.label ?? node?.title ?? assetToRender.text;
                        const isSelected = previewAsset?.id === asset.id;

                        return (
                            <button
                                aria-current={isSelected ? 'true' : undefined}
                                aria-label={t(
                                    'settings.world_builder.map_asset.select_aria_label',
                                    'Select :label to edit',
                                    { label: assetLabel },
                                )}
                                className={cn(
                                    'absolute -translate-x-1/2 -translate-y-1/2 text-center transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]',
                                )}
                                key={asset.id}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSelectAsset?.(asset);
                                }}
                                onBlur={() =>
                                    setHoveredAssetId((current) =>
                                        current === asset.id ? null : current,
                                    )
                                }
                                onFocus={() => setHoveredAssetId(asset.id)}
                                onMouseEnter={() => setHoveredAssetId(asset.id)}
                                onMouseLeave={() =>
                                    setHoveredAssetId((current) =>
                                        current === asset.id ? null : current,
                                    )
                                }
                                style={{
                                    left: `${surface.x}%`,
                                    opacity: assetToRender.opacity,
                                    top: `${surface.y}%`,
                                    width: `${surface.width}%`,
                                    zIndex: assetToRender.z,
                                }}
                                type="button"
                            >
                                <MapAssetPreview
                                    asset={{
                                        ...assetToRender,
                                        imageUrl: surface.imageUrl,
                                    }}
                                    highlighted={
                                        hoveredAssetId === asset.id ||
                                        previewAsset?.id === asset.id
                                    }
                                    label={visualLabel}
                                    visualConfig={visualConfig}
                                />
                                <ImageAlphaHitArea
                                    imageFit={mapAssetImageFit(
                                        visualConfig.imageFit,
                                    )}
                                    imageUrl={surface.imageUrl}
                                    imagePosition={mapAssetImagePosition(
                                        visualConfig.imagePosition,
                                    )}
                                />
                            </button>
                        );
                    })}
                </div>
                {assets.length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center">
                        <div className="max-w-sm rounded-xl border border-white/10 bg-slate-950/75 px-6 py-5 shadow-2xl backdrop-blur-sm">
                            <p className="text-sm font-semibold text-white">
                                No MapAssets yet
                            </p>
                            <p className="mt-2 text-xs leading-5 text-white/65">
                                Use Add Asset to place the first visual area on
                                this map. Select it afterwards to configure its
                                image, position and learner-facing behavior.
                            </p>
                        </div>
                    </div>
                ) : null}
                <div className="pointer-events-none absolute top-4 left-4 text-xs tracking-[0.18em] text-white/70 uppercase">
                    MapAsset surface · no dragging
                </div>
            </div>

            <p className="pointer-events-none absolute right-4 bottom-4 text-xs text-white/60">
                {mapLocked
                    ? 'The map surface is locked.'
                    : 'Click a MapAsset to edit it. Position changes use the fields in the edit menu.'}
            </p>
        </div>
    );
}

function MapAssetPreview({
    asset,
    highlighted,
    label,
    visualConfig,
}: {
    asset: MapAsset;
    highlighted: boolean;
    label?: string | null;
    visualConfig?: Record<string, unknown>;
}) {
    const borderColor = withOpacity(
        stringVisualConfig(
            visualConfig?.borderColor ?? visualConfig?.tileColor,
            '#12343b',
        ),
        visualConfig?.borderOpacity ?? visualConfig?.tileOpacity,
    );
    const highlightColor = withOpacity(
        stringVisualConfig(visualConfig?.highlightColor, '#7dd3fc'),
        visualConfig?.highlightOpacity,
    );
    const highlightBorderColor = withOpacity(
        stringVisualConfig(
            visualConfig?.highlightBorderColor ?? visualConfig?.highlightColor,
            '#7dd3fc',
        ),
        visualConfig?.highlightBorderOpacity ?? visualConfig?.highlightOpacity,
    );
    const labelColor = withOpacity(
        stringVisualConfig(visualConfig?.labelColor, '#ffffff'),
        visualConfig?.labelOpacity,
    );
    const highlightedLabelColor = withOpacity(
        stringVisualConfig(
            visualConfig?.highlightedLabelColor ?? visualConfig?.labelColor,
            '#ffffff',
        ),
        visualConfig?.highlightedLabelOpacity ?? visualConfig?.labelOpacity,
    );

    return (
        <MapAssetVisual
            backgroundColor={borderColor}
            highlighted={highlighted}
            highlightBorderColor={highlightBorderColor}
            highlightColor={highlightColor}
            highlightImageEnabled={visualConfig?.highlightImageEnabled === true}
            highlightImageUrl={stringVisualConfig(
                visualConfig?.highlightImageUrl,
                '',
            )}
            highlightedLabelColor={highlightedLabelColor}
            imageUrl={asset.imageUrl}
            imageFit={mapAssetImageFit(visualConfig?.imageFit)}
            imagePosition={mapAssetImagePosition(visualConfig?.imagePosition)}
            label={label}
            labelColor={labelColor}
        />
    );
}

function stringVisualConfig(value: unknown, fallback: string): string {
    return typeof value === 'string' && value !== '' ? value : fallback;
}

function resolveAssetVisualConfig(
    config: Record<string, unknown>,
    appearance: ResolvedAppearance,
): Record<string, unknown> {
    const variant = config[appearance];

    return {
        ...config,
        ...(variant && typeof variant === 'object'
            ? (variant as Record<string, unknown>)
            : {}),
    };
}

function mergeAssetVisualConfig(
    nodeConfig: Record<string, unknown> | undefined,
    assetConfig: Record<string, unknown>,
    appearance: ResolvedAppearance,
): Record<string, unknown> {
    return {
        ...resolveAssetVisualConfig(nodeConfig ?? {}, appearance),
        ...resolveAssetVisualConfig(assetConfig, appearance),
    };
}

export type AssetForm = {
    image_url: string;
    locked: boolean;
    opacity: string;
    position_x: string;
    position_y: string;
    position_z: string;
    text: string;
    width: string;
    focusable: boolean;
    interaction_mode: MapAssetInteractionMode;
    interaction_states: {
        first: AssetStateForm;
        second: AssetStateForm;
    };
    visual_config: Record<string, unknown>;
};

type AssetStateForm = {
    image_url: string;
    position_x: string;
    position_y: string;
    width: string;
};

export function assetForm(asset: MapAsset | null): AssetForm {
    const firstState = assetStateForm(asset, 'first');
    const secondState = assetStateForm(asset, 'second');

    return {
        image_url: asset?.imageUrl ?? '',
        locked: asset?.locked ?? false,
        opacity: String(asset?.opacity ?? 1),
        position_x: String(asset?.x ?? 50),
        position_y: String(asset?.y ?? 50),
        position_z: String(asset?.z ?? 0),
        text: asset?.text ?? '',
        width: String(asset?.width ?? 14),
        focusable: asset?.focusable ?? true,
        interaction_mode: asset ? mapAssetInteractionMode(asset) : 'focusable',
        interaction_states: {
            first: firstState,
            second: secondState,
        },
        visual_config: asset?.visualConfig ?? {},
    };
}

export function assetPayload(
    form: AssetForm,
): Record<string, unknown> {
    return {
        image_url: form.image_url || null,
        locked: form.locked,
        opacity: Number(form.opacity),
        position_x: Number(form.position_x),
        position_y: Number(form.position_y),
        position_z: Number(form.position_z),
        text: form.text || null,
        width: Number(form.width),
        focusable: form.focusable,
        interaction_mode: form.interaction_mode,
        interaction_config: interactionConfigPayload(
            form,
        ),
        visual_config: form.visual_config,
    };
}

export function MapAssetFields({
    form,
    mapId,
    onChange,
    onPreviewStateChange,
    onUploadImage,
    previewState = 'first',
    errors = {},
}: {
    form: AssetForm;
    mapId: string;
    onChange: (form: AssetForm) => void;
    onPreviewStateChange?: (state: 'first' | 'second') => void;
    previewState?: 'first' | 'second';
    errors?: Record<string, string>;
    onUploadImage?: (file: File) => Promise<{ url: string }>;
}) {
    const t = usePlatformTranslation();
    const [imageUploadError, setImageUploadError] = useState<string | null>(
        null,
    );
    const update = (key: keyof AssetForm, value: string | boolean) =>
        onChange({ ...form, [key]: value });
    const updateVisual = (key: 'imageFit' | 'imagePosition', value: string) =>
        onChange({
            ...form,
            visual_config: {
                ...form.visual_config,
                [key]: value,
            },
        });
    const updateInteractionMode = (mode: MapAssetInteractionMode) =>
        onChange({
            ...form,
            focusable: mode === 'focusable',
            interaction_mode: mode,
        });
    const updateState = (
        state: keyof AssetForm['interaction_states'],
        key: keyof AssetStateForm,
        value: string,
    ) => {
        onPreviewStateChange?.(state);
        onChange({
            ...form,
            interaction_states: {
                ...form.interaction_states,
                [state]: {
                    ...form.interaction_states[state],
                    [key]: value,
                },
            },
        });
    };

    const placementFields = [
        {
            key: 'position_x' as const,
            label: t(
                'settings.world_builder.map_asset.position_x',
                'Horizontal position (X)',
            ),
        },
        {
            key: 'position_y' as const,
            label: t(
                'settings.world_builder.map_asset.position_y',
                'Vertical position (Y)',
            ),
        },
        {
            key: 'position_z' as const,
            label: t(
                'settings.world_builder.map_asset.position_z',
                'Layer depth (Z)',
            ),
        },
        {
            key: 'width' as const,
            label: t('settings.world_builder.map_asset.size', 'MapAsset size'),
        },
        {
            key: 'opacity' as const,
            label: t('settings.world_builder.map_asset.opacity', 'Opacity'),
        },
    ].filter(({ key }) =>
        form.interaction_mode === 'toggle'
            ? key === 'position_z' || key === 'opacity'
            : true,
    );

    return (
        <div className="grid gap-5">
            <MapAssetInteractionModeField
                mode={form.interaction_mode}
                onChange={updateInteractionMode}
            />

            {form.interaction_mode !== 'toggle' ? (
                <div className="grid gap-3">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                            {t(
                                'settings.world_builder.map_asset.image_heading',
                                'Image',
                            )}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.world_builder.map_asset.image_description',
                                'Choose the transparent image learners see on the map.',
                            )}
                        </p>
                    </div>
                    <ConfigImageInput
                        id={`map-asset-image-${mapId}`}
                        label={t(
                            'settings.world_builder.map_asset.image_label',
                            'MapAsset image',
                        )}
                        onChange={(value) => update('image_url', value)}
                        onUpload={(file) => {
                            if (onUploadImage) {
                                setImageUploadError(null);
                                void onUploadImage(file)
                                    .then((payload) =>
                                        update('image_url', payload.url),
                                    )
                                    .catch(() =>
                                        setImageUploadError(
                                            t(
                                                'settings.world_builder.map_asset.image_upload_error',
                                                'The image could not be uploaded.',
                                            ),
                                        ),
                                    );
                            }
                        }}
                        uploading={false}
                        value={form.image_url}
                        error={errors.image_url ?? imageUploadError ?? undefined}
                    />
                </div>
            ) : null}

            {form.interaction_mode === 'toggle' ? (
                <fieldset className="grid gap-4 border-t border-[var(--settings-border-color)] pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                                {t(
                                    'settings.world_builder.map_asset.interaction.states_heading',
                                    'State sprites',
                                )}
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                                {t(
                                    'settings.world_builder.map_asset.interaction.states_description',
                                    'A learner click switches between these two independently positioned images.',
                                )}
                            </p>
                        </div>
                        <div
                            aria-label={t(
                                'settings.world_builder.map_asset.interaction.preview_aria_label',
                                'Preview MapAsset state',
                            )}
                            className="flex rounded-lg border border-[var(--settings-border-color)] p-1"
                            role="group"
                        >
                            {(['first', 'second'] as const).map(
                                (state, index) => (
                                    <Button
                                        aria-pressed={previewState === state}
                                        className={cn(
                                            'h-8 px-3 shadow-none',
                                            previewState === state &&
                                                'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)]',
                                        )}
                                        key={state}
                                        onClick={() =>
                                            onPreviewStateChange?.(state)
                                        }
                                        size="sm"
                                        type="button"
                                        variant={
                                            previewState === state
                                                ? 'default'
                                                : 'ghost'
                                        }
                                    >
                                        {t(
                                            'settings.world_builder.map_asset.interaction.state_label',
                                            'State :number',
                                            { number: index + 1 },
                                        )}
                                    </Button>
                                ),
                            )}
                        </div>
                    </div>
                    {(['first', 'second'] as const).map((state, index) => (
                        <MapAssetStateFields
                            errors={errors}
                            key={state}
                            mapId={mapId}
                            number={index + 1}
                            onUploadImage={onUploadImage}
                            onChange={(key, value) =>
                                updateState(state, key, value)
                            }
                            state={state}
                            values={form.interaction_states[state]}
                        />
                    ))}
                </fieldset>
            ) : null}

            <fieldset className="grid gap-3 border-t border-[var(--settings-border-color)] pt-4">
                <legend className="sr-only">Image framing</legend>
                <div>
                    <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                        Image framing
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                        Choose whether the image stays fully visible or fills
                        its square, and which edge anchors the framing.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor={`map-asset-image-fit-${mapId}`}>
                            Fit
                        </Label>
                        <select
                            className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                            id={`map-asset-image-fit-${mapId}`}
                            onChange={(event) =>
                                updateVisual(
                                    'imageFit',
                                    event.currentTarget.value,
                                )
                            }
                            value={mapAssetImageFit(
                                form.visual_config.imageFit,
                            )}
                        >
                            <option value="contain">Show full image</option>
                            <option value="cover">Fill frame and crop</option>
                        </select>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor={`map-asset-image-position-${mapId}`}>
                            Anchor
                        </Label>
                        <select
                            className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                            id={`map-asset-image-position-${mapId}`}
                            onChange={(event) =>
                                updateVisual(
                                    'imagePosition',
                                    event.currentTarget.value,
                                )
                            }
                            value={mapAssetImagePosition(
                                form.visual_config.imagePosition,
                            )}
                        >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="right">Right</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                        </select>
                    </div>
                </div>
            </fieldset>

            <fieldset className="grid gap-3 border-t border-[var(--settings-border-color)] pt-4">
                <legend className="sr-only">
                    {t(
                        'settings.world_builder.map_asset.placement_heading',
                        'Placement',
                    )}
                </legend>
                <div>
                    <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                        {t(
                            'settings.world_builder.map_asset.placement_heading',
                            'Placement',
                        )}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                        {t(
                            form.interaction_mode === 'toggle'
                                ? 'settings.world_builder.map_asset.placement_toggle_description'
                                : 'settings.world_builder.map_asset.placement_description',
                            form.interaction_mode === 'toggle'
                                ? 'Layer depth and opacity apply to both state sprites.'
                                : 'X and Y use map percentages. Higher Z values place an image above lower layers.',
                        )}
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {placementFields.map(({ key, label }) => (
                        <div className="grid gap-1.5" key={key}>
                            <Label htmlFor={`map-asset-${key}`}>{label}</Label>
                            <Input
                                id={`map-asset-${key}`}
                                max={
                                    key === 'position_x' || key === 'position_y'
                                        ? 100
                                        : key === 'opacity'
                                          ? 1
                                          : undefined
                                }
                                min={
                                    key === 'position_x' || key === 'position_y'
                                        ? 0
                                        : key === 'opacity'
                                          ? 0
                                          : key === 'width'
                                            ? 1
                                            : undefined
                                }
                                onChange={(event) =>
                                    update(key, event.currentTarget.value)
                                }
                                step="any"
                                type="number"
                                value={form[key] as string}
                            />
                            <InputError message={errors[key]} />
                        </div>
                    ))}
                </div>
            </fieldset>

            <label className="flex items-start gap-3 border-t border-[var(--settings-border-color)] pt-4 text-sm">
                <Checkbox
                    checked={form.locked}
                    className="mt-0.5"
                    id={`map-asset-position-lock-${mapId}`}
                    onCheckedChange={(checked) =>
                        update('locked', checked === true)
                    }
                />
                <span>
                    <span className="block font-semibold text-slate-950 dark:text-white">
                        {t(
                            'settings.world_builder.map_asset.position_lock_label',
                            'Lock MapAsset position',
                        )}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--settings-muted-text)]">
                        {t(
                            'settings.world_builder.map_asset.position_lock_description',
                            'Prevents movement on the map surface. The numeric placement fields remain editable.',
                        )}
                    </span>
                </span>
            </label>
        </div>
    );
}

function MapAssetInteractionModeField({
    mode,
    onChange,
}: {
    mode: MapAssetInteractionMode;
    onChange: (mode: MapAssetInteractionMode) => void;
}) {
    const t = usePlatformTranslation();
    const options = [
        {
            description: t(
                'settings.world_builder.map_asset.interaction.focusable_description',
                'Opens its learner panel and activities when selected.',
            ),
            icon: Eye,
            label: t(
                'settings.world_builder.map_asset.interaction.focusable',
                'Normal MapAsset',
            ),
            value: 'focusable' as const,
        },
        {
            description: t(
                'settings.world_builder.map_asset.interaction.decorative_description',
                'Remains visible without opening a learner panel.',
            ),
            icon: Sparkles,
            label: t(
                'settings.world_builder.map_asset.interaction.decorative',
                'Not focusable',
            ),
            value: 'decorative' as const,
        },
        {
            description: t(
                'settings.world_builder.map_asset.interaction.hide_on_hover_description',
                'Disappears under the pointer so objects behind it can be selected.',
            ),
            icon: EyeOff,
            label: t(
                'settings.world_builder.map_asset.interaction.hide_on_hover',
                'Hide on hover',
            ),
            value: 'hide_on_hover' as const,
        },
        {
            description: t(
                'settings.world_builder.map_asset.interaction.toggle_description',
                'Learner clicks switch between two persistent visual states.',
            ),
            icon: MousePointerClick,
            label: t(
                'settings.world_builder.map_asset.interaction.toggle',
                'Change state on click',
            ),
            value: 'toggle' as const,
        },
    ];

    return (
        <fieldset className="grid gap-3">
            <div>
                <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                    {t(
                        'settings.world_builder.map_asset.interaction.heading',
                        'Learner interaction',
                    )}
                </h4>
                <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                    {t(
                        'settings.world_builder.map_asset.interaction.description',
                        'Choose one clear behavior for this MapAsset on the learner map.',
                    )}
                </p>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
                {options.map((option) => {
                    const Icon = option.icon;
                    const checked = mode === option.value;

                    return (
                        <label
                            className={cn(
                                'grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border p-3 transition',
                                checked
                                    ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_10%,transparent)]'
                                    : 'border-[var(--settings-border-color)] bg-[var(--settings-input-background)] hover:border-[color-mix(in_srgb,var(--settings-accent)_55%,var(--settings-border-color))]',
                            )}
                            key={option.value}
                        >
                            <input
                                checked={checked}
                                className="mt-1 size-4 accent-[var(--settings-accent)]"
                                name="map-asset-interaction-mode"
                                onChange={() => onChange(option.value)}
                                type="radio"
                                value={option.value}
                            />
                            <span className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                                <Icon className="size-4 text-[var(--settings-accent)]" />
                                {option.label}
                            </span>
                            <span className="col-start-2 text-xs leading-5 text-[var(--settings-muted-text)]">
                                {option.description}
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

function MapAssetStateFields({
    errors,
    mapId,
    number,
    onChange,
    onUploadImage,
    state,
    values,
}: {
    errors: Record<string, string>;
    mapId: string;
    number: number;
    onChange: (key: keyof AssetStateForm, value: string) => void;
    onUploadImage?: (file: File) => Promise<{ url: string }>;
    state: 'first' | 'second';
    values: AssetStateForm;
}) {
    const t = usePlatformTranslation();
    const [imageUploadError, setImageUploadError] = useState<string | null>(
        null,
    );
    const prefix = `interaction_config.states.${state}`;

    return (
        <section className="grid gap-3 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] p-4">
            <h5 className="text-sm font-semibold text-slate-950 dark:text-white">
                {t(
                    'settings.world_builder.map_asset.interaction.state_label',
                    'State :number',
                    { number },
                )}
            </h5>
            <ConfigImageInput
                id={`map-asset-state-${state}-${mapId}`}
                label={t(
                    'settings.world_builder.map_asset.interaction.state_image',
                    'State image',
                )}
                onChange={(value) => onChange('image_url', value)}
                onUpload={(file) => {
                    if (onUploadImage) {
                        setImageUploadError(null);
                        void onUploadImage(file)
                            .then((payload) =>
                                onChange('image_url', payload.url),
                            )
                            .catch(() =>
                                setImageUploadError(
                                    t(
                                        'settings.world_builder.map_asset.image_upload_error',
                                        'The image could not be uploaded.',
                                    ),
                                ),
                            );
                    }
                }}
                uploading={false}
                value={values.image_url}
                error={errors[`${prefix}.imageUrl`] ?? imageUploadError ?? undefined}
            />
            <div className="grid gap-3 sm:grid-cols-3">
                {(
                    [
                        [
                            'position_x',
                            t(
                                'settings.world_builder.map_asset.interaction.state_x',
                                'Horizontal position (X)',
                            ),
                        ],
                        [
                            'position_y',
                            t(
                                'settings.world_builder.map_asset.interaction.state_y',
                                'Vertical position (Y)',
                            ),
                        ],
                        [
                            'width',
                            t(
                                'settings.world_builder.map_asset.interaction.state_size',
                                'Size %',
                            ),
                        ],
                    ] as const
                ).map(([key, label]) => (
                    <div className="grid gap-1.5" key={key}>
                        <Label htmlFor={`map-asset-state-${state}-${key}`}>
                            {label}
                        </Label>
                        <Input
                            id={`map-asset-state-${state}-${key}`}
                            max="100"
                            min={key === 'width' ? '1' : '0'}
                            onChange={(event) =>
                                onChange(key, event.currentTarget.value)
                            }
                            step="any"
                            type="number"
                            value={values[key]}
                        />
                        <InputError
                            message={
                                errors[
                                    `${prefix}.${key === 'position_x' ? 'x' : key === 'position_y' ? 'y' : 'width'}`
                                ]
                            }
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}

function assetStateForm(
    asset: MapAsset | null,
    state: 'first' | 'second',
): AssetStateForm {
    const config = asset?.interactionConfig?.states?.[state];

    return {
        image_url: config?.imageUrl ?? asset?.imageUrl ?? '',
        position_x: String(config?.x ?? asset?.x ?? 50),
        position_y: String(config?.y ?? asset?.y ?? 50),
        width: String(config?.width ?? asset?.width ?? 14),
    };
}

function interactionConfigPayload(form: AssetForm): MapAssetInteractionConfig {
    return {
        states: {
            first: statePayload(form.interaction_states.first),
            second: statePayload(form.interaction_states.second),
        },
    };
}

function statePayload(state: AssetStateForm) {
    return {
        imageUrl: state.image_url || null,
        width: Number(state.width),
        x: Number(state.position_x),
        y: Number(state.position_y),
    };
}
