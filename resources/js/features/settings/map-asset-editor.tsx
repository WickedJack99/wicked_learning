import type { FormDataConvertible } from '@inertiajs/core';
import { router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ConfigImageInput } from '@/components/config-image-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapAssetVisual } from '@/features/world/map-asset-visual';
import { withOpacity } from '@/features/world/theme';
import type { ResolvedAppearance } from '@/features/world/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { uploadMediaFile } from '@/lib/media-upload';
import { cn } from '@/lib/utils';
import type { MapAsset } from '@/types/learning';

export type MapAssetNode = {
    id: number;
    label?: string;
    title: string;
    visualConfig?: Record<string, unknown>;
};

export function MapAssetEditor({
    assets,
    mapId,
    mapLocked,
    nodes,
    appearance = 'dark',
    onSelectAsset,
    previewAsset,
    previewNode,
    previewImage,
    previewOverlay,
}: {
    assets: MapAsset[];
    mapId: number;
    mapLocked: boolean;
    nodes: MapAssetNode[];
    appearance?: ResolvedAppearance;
    onSelectAsset?: (asset: MapAsset) => void;
    previewAsset?: MapAsset;
    previewNode?: MapAssetNode;
    previewImage?: string;
    previewOverlay?: string;
}) {
    const [processing, setProcessing] = useState(false);
    const [hoveredAssetId, setHoveredAssetId] = useState<number | null>(null);

    const addAsset = () => {
        setProcessing(true);
        router.post(
            `/settings/worlds/maps/${mapId}/assets`,
            assetPayload(assetForm(null)),
            {
                preserveScroll: true,
                onFinish: () => setProcessing(false),
            },
        );
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
                <Button
                    className="absolute top-4 right-4 z-30 shadow-xl"
                    disabled={processing}
                    onClick={addAsset}
                    type="button"
                >
                    <Plus className="size-4" /> Add Asset
                </Button>
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

                        return (
                            <button
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
                                    left: `${assetToRender.x}%`,
                                    opacity: assetToRender.opacity,
                                    top: `${assetToRender.y}%`,
                                    width: `${assetToRender.width}%`,
                                    zIndex: assetToRender.z,
                                }}
                                type="button"
                            >
                                <MapAssetPreview
                                    asset={assetToRender}
                                    highlighted={
                                        hoveredAssetId === asset.id ||
                                        previewAsset?.id === asset.id
                                    }
                                    label={
                                        node?.label ??
                                        node?.title ??
                                        assetToRender.text
                                    }
                                    visualConfig={mergeAssetVisualConfig(
                                        node?.visualConfig,
                                        assetToRender.visualConfig,
                                        appearance,
                                    )}
                                />
                            </button>
                        );
                    })}
                </div>
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
    visual_config: Record<string, unknown>;
};

export function assetForm(asset: MapAsset | null): AssetForm {
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
        visual_config: asset?.visualConfig ?? {},
    };
}

export function assetPayload(
    form: AssetForm,
): Record<string, FormDataConvertible> {
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
        visual_config: form.visual_config as unknown as FormDataConvertible,
    };
}

export function MapAssetFields({
    form,
    mapId,
    onChange,
    errors = {},
}: {
    form: AssetForm;
    mapId: number;
    onChange: (form: AssetForm) => void;
    errors?: Record<string, string>;
}) {
    const t = usePlatformTranslation();
    const update = (key: keyof AssetForm, value: string | boolean) =>
        onChange({ ...form, [key]: value });

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
    ];

    return (
        <div className="grid gap-5">
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
                    onUpload={(file) =>
                        void uploadMediaFile({
                            endpoint: '/settings/worlds/node-images',
                            fields: { map_id: mapId },
                            fieldName: 'image',
                            file,
                            errorMessage: t(
                                'settings.world_builder.map_asset.image_upload_error',
                                'The image could not be uploaded.',
                            ),
                        }).then((payload) => update('image_url', payload.url))
                    }
                    uploading={false}
                    value={form.image_url}
                />
            </div>

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
                            'settings.world_builder.map_asset.placement_description',
                            'X and Y use map percentages. Higher Z values place an image above lower layers.',
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
