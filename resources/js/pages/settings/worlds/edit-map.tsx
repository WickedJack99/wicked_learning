import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronRight,
    Download,
    GitBranch,
    Image,
    Map as MapIcon,
    Palette,
    Save,
    Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Dispatch, PointerEvent, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { SettingsAccordionSection } from '@/components/settings-accordion-section';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    axialToPoint,
    coordinateKey,
    directions,
    dragClickThreshold,
    edgeControlPosition,
    insertControlLine,
    tileControlHeight,
    tileControlWidth,
} from '@/features/admin-worlds/hex-grid-geometry';
import type { Direction } from '@/features/admin-worlds/hex-grid-geometry';
import { resolveThemeVariant } from '@/features/world/theme';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

type EditableWorld = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
};

type EditableNode = {
    description: string | null;
    id: number;
    position: {
        q: number;
        r: number;
    };
    slug: string;
    state: string;
    title: string;
    visualConfig: VisualConfig;
};

type EditableMap = {
    backgroundConfig: MapVisualConfig;
    description: string | null;
    gridConfig: {
        gap?: number;
        tileHeight?: number;
        tileWidth?: number;
    };
    id: number;
    nodeCount: number;
    nodes: EditableNode[];
    slug: string;
    title: string;
};

type NestedVisualConfig = Record<string, boolean | string | undefined>;

type VisualConfigValue = boolean | string | NestedVisualConfig | undefined;

type VisualConfig = Record<string, VisualConfigValue>;

type ThemeMode = 'dark' | 'light';

type NodeVisualThemeFields = {
    foregroundColor: string;
    highlightColor: string;
    imageUrl: string;
    labelColor: string;
    tileColor: string;
};

type MapVisualThemeFields = {
    accentColor: string;
    imageUrl: string;
    overlay: string;
    pageBackground: string;
    panelBackground: string;
    panelMutedTextColor: string;
    panelTextColor: string;
    sidePanelBackground: string;
    sidePanelBorderColor: string;
    sidePanelMutedTextColor: string;
    sidePanelTextColor: string;
};

type MapVisualConfig = Partial<MapVisualThemeFields> & {
    dark?: Partial<MapVisualThemeFields>;
    light?: Partial<MapVisualThemeFields>;
};

type EditableMapPayload = {
    map: EditableMap;
    world: EditableWorld;
};

type GridCell = {
    occupiedNode: EditableNode | null;
    q: number;
    r: number;
    x: number;
    y: number;
};

type InsertionContext = {
    direction: Direction;
    sourceNodeId: number;
};

type NodeForm = {
    description: string;
    position_q: number;
    position_r: number;
    slug: string;
    state: string;
    title: string;
    visual_config: {
        dark: NodeVisualThemeFields;
        hideEmptySpace: boolean;
        hideImage: boolean;
        hideLabel: boolean;
        label: string;
        light: NodeVisualThemeFields;
        tooltip: string;
    };
};

type MapVisualForm = MapVisualThemeFields & {
    dark: MapVisualThemeFields;
    light: MapVisualThemeFields;
};

export default function EditWorldMap({
    editableMap,
}: {
    editableMap: EditableMapPayload;
}) {
    const { map, world } = editableMap;
    const { resolvedAppearance } = useAppearance();
    const previewMapTheme = resolveThemeVariant<Partial<MapVisualThemeFields>>(
        map.backgroundConfig,
        resolvedAppearance,
    );
    const [selectedNode, setSelectedNode] = useState<EditableNode | null>(null);
    const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [mapVisualOpen, setMapVisualOpen] = useState(false);
    const [mapVisualForm, setMapVisualForm] = useState<MapVisualForm>(() =>
        mapVisualFormFromConfig(map.backgroundConfig),
    );
    const [mapVisualErrors, setMapVisualErrors] = useState<
        Record<string, string>
    >({});
    const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
        null,
    );
    const [imageUploadErrors, setImageUploadErrors] = useState<
        Record<string, string>
    >({});
    const [form, setForm] = useState<NodeForm>(() => emptyNodeForm(0, 0));
    const [insertionContext, setInsertionContext] =
        useState<InsertionContext | null>(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const suppressClickRef = useRef(false);
    const dragRef = useRef<{
        moved: boolean;
        pointerId: number;
        startPan: { x: number; y: number };
        startX: number;
        startY: number;
    } | null>(null);
    const occupiedByCoordinate = useMemo(() => nodeMap(map.nodes), [map.nodes]);
    const cells = useMemo(
        () => buildGridCells(map.nodes, occupiedByCoordinate),
        [map.nodes, occupiedByCoordinate],
    );
    const isEditingNode = Boolean(selectedNode);
    const dialogOpen = Boolean(selectedCell || selectedNode);

    const openCreateTile = (cell: GridCell) => {
        if (consumeSuppressedClick()) {
            return;
        }

        setSelectedNode(null);
        setSelectedCell(cell);
        setInsertionContext(null);
        setErrors({});
        setImageUploadErrors({});
        setForm(
            map.nodes.length === 0
                ? firstNodeForm(cell.q, cell.r)
                : emptyNodeForm(cell.q, cell.r),
        );
    };

    const openInsertTile = (node: EditableNode, direction: Direction) => {
        if (consumeSuppressedClick()) {
            return;
        }

        const position = {
            q: node.position.q + direction.q,
            r: node.position.r + direction.r,
        };
        const { x, y } = axialToPoint(position.q, position.r);

        setSelectedNode(null);
        setSelectedCell({
            occupiedNode: null,
            q: position.q,
            r: position.r,
            x,
            y,
        });
        setInsertionContext({
            direction,
            sourceNodeId: node.id,
        });
        setErrors({});
        setImageUploadErrors({});
        setForm(emptyNodeForm(position.q, position.r));
    };

    const openEditTile = (node: EditableNode) => {
        if (consumeSuppressedClick()) {
            return;
        }

        setSelectedNode(node);
        setSelectedCell(null);
        setInsertionContext(null);
        setErrors({});
        setImageUploadErrors({});
        setForm(nodeFormFromNode(node));
    };

    const closeDialog = () => {
        setSelectedCell(null);
        setSelectedNode(null);
        setInsertionContext(null);
    };

    const saveNode = (override?: Partial<NodeForm>) => {
        setProcessing(true);

        const payload = mergeNodeForm(form, override);
        const request = selectedNode
            ? router.patch(
                  `/settings/worlds/nodes/${selectedNode.id}`,
                  payload,
                  {
                      preserveScroll: true,
                      onError: (nextErrors) => setErrors(nextErrors),
                      onSuccess: closeDialog,
                      onFinish: () => setProcessing(false),
                  },
              )
            : insertionContext
              ? router.post(
                    `/settings/worlds/nodes/${insertionContext.sourceNodeId}/insert`,
                    {
                        ...payload,
                        direction_q: insertionContext.direction.q,
                        direction_r: insertionContext.direction.r,
                    },
                    {
                        preserveScroll: true,
                        onError: (nextErrors) => setErrors(nextErrors),
                        onSuccess: closeDialog,
                        onFinish: () => setProcessing(false),
                    },
                )
              : router.post(`/settings/worlds/maps/${map.id}/nodes`, payload, {
                    preserveScroll: true,
                    onError: (nextErrors) => setErrors(nextErrors),
                    onSuccess: closeDialog,
                    onFinish: () => setProcessing(false),
                });

        void request;
    };

    const saveEmptySpace = () => {
        saveNode(emptySpaceOverride(form.position_q, form.position_r));
    };

    const saveMapVisuals = () => {
        setProcessing(true);

        router.patch(
            `/settings/worlds/maps/${map.id}`,
            {
                background_config: mapVisualForm,
            },
            {
                preserveScroll: true,
                onError: (nextErrors) => setMapVisualErrors(nextErrors),
                onSuccess: () => {
                    setMapVisualOpen(false);
                    setMapVisualErrors({});
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const uploadWorldImage = async (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => {
        const formData = new FormData();
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        formData.append('image', file);
        setUploadingImageKey(key);
        setImageUploadErrors((current) => ({ ...current, [key]: '' }));

        try {
            const response = await fetch('/settings/worlds/node-images', {
                body: formData,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                },
                method: 'POST',
            });
            const payload = (await response.json()) as {
                errors?: Record<string, string[]>;
                message?: string;
                url?: string;
            };

            if (!response.ok || !payload.url) {
                setImageUploadErrors((current) => ({
                    ...current,
                    [key]:
                        payload.errors?.image?.[0] ??
                        payload.message ??
                        'The image could not be uploaded.',
                }));

                return;
            }

            onUploaded(payload.url);
        } catch {
            setImageUploadErrors((current) => ({
                ...current,
                [key]: 'The image could not be uploaded.',
            }));
        } finally {
            setUploadingImageKey(null);
        }
    };

    const swapNode = (node: EditableNode, direction: Direction) => {
        if (consumeSuppressedClick()) {
            return;
        }

        router.patch(
            `/settings/worlds/nodes/${node.id}/swap`,
            {
                direction_q: direction.q,
                direction_r: direction.r,
            },
            {
                preserveScroll: true,
            },
        );
    };

    const startDrag = (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) {
            return;
        }

        suppressClickRef.current = false;
        dragRef.current = {
            moved: false,
            pointerId: event.pointerId,
            startPan: pan,
            startX: event.clientX,
            startY: event.clientY,
        };
    };

    const moveDrag = (event: PointerEvent<HTMLElement>) => {
        const drag = dragRef.current;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;

        if (Math.hypot(deltaX, deltaY) <= dragClickThreshold) {
            return;
        }

        if (!drag.moved) {
            drag.moved = true;
            suppressClickRef.current = true;
            window.getSelection()?.removeAllRanges();
        }

        setPan({
            x: drag.startPan.x + deltaX,
            y: drag.startPan.y + deltaY,
        });
    };

    const stopDrag = (event: PointerEvent<HTMLElement>) => {
        const drag = dragRef.current;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        dragRef.current = null;

        if (drag.moved) {
            window.setTimeout(() => {
                suppressClickRef.current = false;
            }, 0);
        }
    };

    const consumeSuppressedClick = () => {
        if (!suppressClickRef.current) {
            return false;
        }

        suppressClickRef.current = false;

        return true;
    };

    return (
        <>
            <Head title={`Edit ${map.title}`} />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="flex h-full flex-col px-4 pt-4 pb-24">
                    <header className="mb-3 flex shrink-0 items-center justify-between gap-4 select-none">
                        <div className="min-w-0">
                            <Button
                                asChild
                                className="mb-2"
                                size="sm"
                                variant="ghost"
                            >
                                <Link href="/settings/worlds">
                                    <ArrowLeft className="size-4" />
                                    World graph
                                </Link>
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                {world.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-3">
                                <h1 className="truncate text-2xl font-semibold tracking-normal">
                                    Edit {map.title}
                                </h1>
                                <Button
                                    onClick={() => {
                                        setMapVisualForm(
                                            mapVisualFormFromConfig(
                                                map.backgroundConfig,
                                            ),
                                        );
                                        setMapVisualErrors({});
                                        setMapVisualOpen(true);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    <Palette className="size-4" />
                                    Map visuals
                                </Button>
                            </div>
                        </div>
                        <p className="hidden max-w-2xl text-sm leading-6 text-slate-600 md:block dark:text-slate-300">
                            Drag from any tile or empty area. Use plus buttons
                            to grow the map, and arrow buttons to swap adjacent
                            tiles.
                        </p>
                    </header>

                    <section
                        className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.14),rgba(255,255,255,0.88)_64%)] shadow-2xl select-none dark:border-white/10 dark:bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.16),rgba(17,24,32,0.94)_66%)]"
                        onPointerCancel={stopDrag}
                        onPointerDown={startDrag}
                        onPointerMove={moveDrag}
                        onPointerUp={stopDrag}
                    >
                        {previewMapTheme.imageUrl ? (
                            <div
                                className="pointer-events-none absolute inset-0 bg-cover bg-center"
                                style={{
                                    backgroundImage: `url(${previewMapTheme.imageUrl})`,
                                }}
                            />
                        ) : null}
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: previewMapTheme.overlay,
                            }}
                        />
                        <div className="absolute top-4 left-4 z-30 rounded-xl border border-slate-200 bg-white/82 p-3 text-sm shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                            <div className="flex items-center gap-2 font-semibold">
                                <MapIcon className="size-4 text-cyan-700 dark:text-teal-200" />
                                {map.title}
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {map.nodes.length} configured tile
                                {map.nodes.length === 1 ? '' : 's'}
                            </p>
                        </div>

                        {map.nodes.length === 0 ? (
                            <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4">
                                <div className="max-w-sm rounded-xl border border-dashed border-cyan-300 bg-white/86 p-4 text-center text-sm shadow-lg backdrop-blur dark:border-teal-200/30 dark:bg-slate-950/72">
                                    <p className="font-semibold text-slate-950 dark:text-white">
                                        This map is empty
                                    </p>
                                    <p className="mt-2 leading-6 text-slate-600 dark:text-slate-300">
                                        Use the plus button in the center to
                                        create the first tile. After that the
                                        editor can grow the map from nearby
                                        cells.
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        <div
                            className="absolute inset-0"
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px)`,
                            }}
                        >
                            {cells.map((cell) => (
                                <HexGridCell
                                    cell={cell}
                                    key={`${cell.q}:${cell.r}`}
                                    neighboringNode={(direction) =>
                                        occupiedByCoordinate.get(
                                            coordinateKey(
                                                cell.q + direction.q,
                                                cell.r + direction.r,
                                            ),
                                        ) ?? null
                                    }
                                    onAdd={() => openCreateTile(cell)}
                                    onEdit={openEditTile}
                                    onInsert={openInsertTile}
                                    mode={resolvedAppearance}
                                    onSwap={swapNode}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            </main>

            <Dialog onOpenChange={setMapVisualOpen} open={mapVisualOpen}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Map visuals</DialogTitle>
                        <DialogDescription>
                            Configure fallback, dark-mode and light-mode visuals
                            for this map. Empty mode fields inherit the fallback
                            value.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5">
                        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                            <div>
                                <h3 className="text-sm font-semibold">
                                    Fallback visuals
                                </h3>
                                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                    These values are used unless dark or light
                                    mode overrides them.
                                </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {mapVisualFields.map((field) => (
                                    <TextField
                                        error={
                                            mapVisualErrors[
                                                `background_config.${field.key}`
                                            ]
                                        }
                                        key={field.key}
                                        label={field.label}
                                        onChange={(value) =>
                                            setMapVisualTextConfig(
                                                setMapVisualForm,
                                                field.key,
                                                value,
                                            )
                                        }
                                        value={mapVisualForm[field.key]}
                                    />
                                ))}
                            </div>
                            <NodeImageInput
                                description="Fallback background image for this map."
                                error={
                                    imageUploadErrors.mapBase ||
                                    mapVisualErrors[
                                        'background_config.imageUrl'
                                    ]
                                }
                                id="map-image-url"
                                label="Fallback map image"
                                onChange={(value) =>
                                    setMapVisualTextConfig(
                                        setMapVisualForm,
                                        'imageUrl',
                                        value,
                                    )
                                }
                                onUpload={(file) =>
                                    void uploadWorldImage(
                                        'mapBase',
                                        file,
                                        (url) =>
                                            setMapVisualTextConfig(
                                                setMapVisualForm,
                                                'imageUrl',
                                                url,
                                            ),
                                    )
                                }
                                uploading={uploadingImageKey === 'mapBase'}
                                value={mapVisualForm.imageUrl}
                            />
                        </div>

                        <MapVisualModeFields
                            errors={mapVisualErrors}
                            imageError={imageUploadErrors.mapDark}
                            mode="dark"
                            onImageUpload={(file) =>
                                void uploadWorldImage('mapDark', file, (url) =>
                                    setMapVisualThemeTextConfig(
                                        setMapVisualForm,
                                        'dark',
                                        'imageUrl',
                                        url,
                                    ),
                                )
                            }
                            setForm={setMapVisualForm}
                            uploadingImage={uploadingImageKey === 'mapDark'}
                            values={mapVisualForm.dark}
                        />

                        <MapVisualModeFields
                            errors={mapVisualErrors}
                            imageError={imageUploadErrors.mapLight}
                            mode="light"
                            onImageUpload={(file) =>
                                void uploadWorldImage('mapLight', file, (url) =>
                                    setMapVisualThemeTextConfig(
                                        setMapVisualForm,
                                        'light',
                                        'imageUrl',
                                        url,
                                    ),
                                )
                            }
                            setForm={setMapVisualForm}
                            uploadingImage={uploadingImageKey === 'mapLight'}
                            values={mapVisualForm.light}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={() => setMapVisualOpen(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={processing}
                            onClick={saveMapVisuals}
                            type="button"
                        >
                            <Save className="size-4" />
                            Save map visuals
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        closeDialog();
                    }
                }}
                open={dialogOpen}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {isEditingNode ? 'Edit tile' : 'Add tile'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure the first basic fields for this tile, or
                            add it as an empty space to extend the editable map
                            without showing a learner-facing activity.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        {selectedNode ? (
                            <SettingsAccordionSection
                                defaultOpen
                                description="Open the activity graph for this tile."
                                title="Activities"
                            >
                                <Button asChild type="button" variant="outline">
                                    <Link
                                        href={`/settings/worlds/nodes/${selectedNode.id}/activities`}
                                    >
                                        <GitBranch className="size-4" />
                                        Edit activities
                                    </Link>
                                </Button>
                            </SettingsAccordionSection>
                        ) : null}

                        <SettingsAccordionSection
                            defaultOpen
                            description="Name, URL slug and learner-facing summary."
                            title="Basics"
                        >
                            <div className="grid gap-3 sm:grid-cols-2">
                                <TextField
                                    error={errors.title}
                                    label="Title"
                                    onChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            title: value,
                                            visual_config: {
                                                ...current.visual_config,
                                                label:
                                                    current.visual_config
                                                        .label || value,
                                            },
                                        }))
                                    }
                                    value={form.title}
                                />
                                <TextField
                                    error={errors.slug}
                                    label="Slug"
                                    onChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            slug: value,
                                        }))
                                    }
                                    placeholder="Optional, generated if empty"
                                    value={form.slug}
                                />
                            </div>

                            <div className="grid gap-1">
                                <Label htmlFor="tile-description">
                                    Description
                                </Label>
                                <textarea
                                    className="min-h-28 resize-y rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                    id="tile-description"
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            description:
                                                event.currentTarget.value,
                                        }))
                                    }
                                    value={form.description}
                                />
                                <InputError message={errors.description} />
                            </div>
                        </SettingsAccordionSection>

                        <SettingsAccordionSection
                            defaultOpen
                            description="Learner-facing label and visibility behavior for the tile."
                            title="Tile display"
                        >
                            <TextField
                                error={errors['visual_config.label']}
                                label="Tile label"
                                onChange={(value) =>
                                    setVisualTextConfig(setForm, 'label', value)
                                }
                                value={form.visual_config.label}
                            />

                            <div className="grid gap-3">
                                <CheckboxField
                                    checked={form.visual_config.hideLabel}
                                    description="The title still appears in the side panel after the tile is selected."
                                    id="hide-label"
                                    label="Hide tile label on world map"
                                    onCheckedChange={(checked) =>
                                        setVisualBooleanConfig(
                                            setForm,
                                            'hideLabel',
                                            checked,
                                        )
                                    }
                                />
                                <CheckboxField
                                    checked={form.visual_config.hideImage}
                                    description="The configured dark and light images stay saved, but the world map shows the icon instead."
                                    id="hide-image"
                                    label="Hide node image on world map"
                                    onCheckedChange={(checked) =>
                                        setVisualBooleanConfig(
                                            setForm,
                                            'hideImage',
                                            checked,
                                        )
                                    }
                                />
                                {form.state === 'hidden' ? (
                                    <CheckboxField
                                        checked={
                                            form.visual_config.hideEmptySpace
                                        }
                                        description="The tile keeps its coordinate and spacing, but learners do not see or click it."
                                        id="hide-empty-space"
                                        label="Hide this empty space on learner map"
                                        onCheckedChange={(checked) =>
                                            setVisualBooleanConfig(
                                                setForm,
                                                'hideEmptySpace',
                                                checked,
                                            )
                                        }
                                    />
                                ) : null}
                            </div>
                        </SettingsAccordionSection>

                        <SettingsAccordionSection
                            description="Dark mode colors and the image displayed on the world map."
                            title="Dark mode visuals"
                        >
                            <NodeVisualModeFields
                                errors={errors}
                                imageError={imageUploadErrors.nodeDark}
                                mode="dark"
                                onImageUpload={(file) =>
                                    void uploadWorldImage(
                                        'nodeDark',
                                        file,
                                        (url) =>
                                            setVisualThemeTextConfig(
                                                setForm,
                                                'dark',
                                                'imageUrl',
                                                url,
                                            ),
                                    )
                                }
                                setForm={setForm}
                                uploadingImage={
                                    uploadingImageKey === 'nodeDark'
                                }
                                values={form.visual_config.dark}
                            />
                        </SettingsAccordionSection>

                        <SettingsAccordionSection
                            description="Light mode colors and the image displayed on the world map."
                            title="Light mode visuals"
                        >
                            <NodeVisualModeFields
                                errors={errors}
                                imageError={imageUploadErrors.nodeLight}
                                mode="light"
                                onImageUpload={(file) =>
                                    void uploadWorldImage(
                                        'nodeLight',
                                        file,
                                        (url) =>
                                            setVisualThemeTextConfig(
                                                setForm,
                                                'light',
                                                'imageUrl',
                                                url,
                                            ),
                                    )
                                }
                                setForm={setForm}
                                uploadingImage={
                                    uploadingImageKey === 'nodeLight'
                                }
                                values={form.visual_config.light}
                            />
                        </SettingsAccordionSection>
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={closeDialog}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        {!isEditingNode && (
                            <Button
                                disabled={processing}
                                onClick={saveEmptySpace}
                                type="button"
                                variant="outline"
                            >
                                Add empty space
                            </Button>
                        )}
                        <Button
                            disabled={processing}
                            onClick={() => saveNode()}
                            type="button"
                        >
                            <Save className="size-4" />
                            Save tile
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function HexGridCell({
    cell,
    neighboringNode,
    mode,
    onAdd,
    onEdit,
    onInsert,
    onSwap,
}: {
    cell: GridCell;
    mode: ThemeMode;
    neighboringNode: (direction: Direction) => EditableNode | null;
    onAdd: () => void;
    onEdit: (node: EditableNode) => void;
    onInsert: (node: EditableNode, direction: Direction) => void;
    onSwap: (node: EditableNode, direction: Direction) => void;
}) {
    const node = cell.occupiedNode;
    const visual = node ? resolveThemeVariant(node.visualConfig, mode) : {};
    const isEmptySpace = node?.state === 'hidden';
    const imageUrl = typeof visual.imageUrl === 'string' ? visual.imageUrl : '';
    const hideImage = visual.hideImage === true;
    const hideLabel = visual.hideLabel === true;
    const hideEmptySpace = isEmptySpace && visual.hideEmptySpace !== false;

    return (
        <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
                left: `calc(50% + ${cell.x}px)`,
                top: `calc(50% + ${cell.y}px)`,
            }}
        >
            {node ? (
                <div
                    className="pointer-events-none relative"
                    style={{
                        height: `${tileControlHeight}px`,
                        width: `${tileControlWidth}px`,
                    }}
                >
                    <button
                        className={cn(
                            'absolute top-1/2 left-1/2 grid h-[104px] w-[120px] -translate-x-1/2 -translate-y-1/2 place-items-center px-4 text-center text-xs font-semibold shadow-lg transition hover:-translate-y-[54%] focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:focus-visible:ring-teal-200',
                            'pointer-events-auto',
                            isEmptySpace &&
                                'border border-dashed border-slate-400/70 bg-slate-100/70 text-slate-500 shadow-none dark:border-white/20 dark:bg-white/5 dark:text-slate-400',
                        )}
                        draggable={false}
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit(node);
                        }}
                        style={{
                            background: isEmptySpace
                                ? undefined
                                : ((visual.tileColor as string | undefined) ??
                                  '#253047'),
                            clipPath:
                                'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                            color: isEmptySpace
                                ? undefined
                                : ((visual.labelColor as string | undefined) ??
                                  '#ffffff'),
                        }}
                        type="button"
                    >
                        {imageUrl && !hideImage ? (
                            <img
                                alt=""
                                className="absolute inset-[7px] size-[calc(100%-14px)] object-cover"
                                draggable={false}
                                src={imageUrl}
                                style={{
                                    clipPath:
                                        'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                                }}
                            />
                        ) : null}
                        {!hideLabel || isEmptySpace ? (
                            <span className="relative z-10">
                                {isEmptySpace
                                    ? hideEmptySpace
                                        ? 'Hidden empty space'
                                        : 'Visible empty space'
                                    : ((visual.label as string | undefined) ??
                                      node.title)}
                            </span>
                        ) : null}
                    </button>

                    {directions.map((direction) => {
                        const targetNode = neighboringNode(direction);
                        const controlPosition = edgeControlPosition(direction);
                        const showInsertControl =
                            targetNode !== null && node.id < targetNode.id;

                        return (
                            <div key={direction.label}>
                                <button
                                    aria-label={
                                        targetNode
                                            ? `Swap ${node.title} with ${targetNode.title} ${direction.label}`
                                            : `No neighboring tile ${direction.label}`
                                    }
                                    className={cn(
                                        'absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-cyan-700 shadow-sm transition focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:text-teal-200 dark:focus-visible:ring-teal-200',
                                        targetNode
                                            ? 'pointer-events-auto border-cyan-600/40 bg-white/90 hover:bg-cyan-100 dark:border-teal-200/35 dark:bg-slate-950/88 dark:hover:bg-teal-200/15'
                                            : 'pointer-events-none border-slate-300/40 bg-white/40 text-slate-300 opacity-35 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-600',
                                    )}
                                    disabled={!targetNode}
                                    onClick={(event) => {
                                        event.stopPropagation();

                                        if (targetNode) {
                                            onSwap(node, direction);
                                        }
                                    }}
                                    onPointerDown={(event) =>
                                        event.stopPropagation()
                                    }
                                    style={{
                                        left: `${controlPosition.x}px`,
                                        top: `${controlPosition.y}px`,
                                    }}
                                    type="button"
                                >
                                    <ChevronRight
                                        className="size-4"
                                        style={{
                                            transform: `rotate(${controlPosition.rotation}deg)`,
                                        }}
                                    />
                                </button>

                                {targetNode && showInsertControl ? (
                                    <InsertBetweenControl
                                        direction={direction}
                                        node={node}
                                        onClick={() =>
                                            onInsert(node, direction)
                                        }
                                        targetNode={targetNode}
                                    />
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <button
                    aria-label={`Add tile at ${cell.q}, ${cell.r}`}
                    className="pointer-events-auto grid size-14 place-items-center rounded-full border border-dashed border-cyan-500/45 bg-cyan-50/80 text-cyan-700 shadow-sm transition hover:scale-105 hover:border-cyan-600 hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-teal-200/30 dark:bg-teal-200/8 dark:text-teal-200 dark:hover:border-teal-200 dark:hover:bg-teal-200/15 dark:focus-visible:ring-teal-200"
                    draggable={false}
                    onClick={(event) => {
                        event.stopPropagation();
                        onAdd();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    type="button"
                >
                    <span className="text-2xl leading-none">+</span>
                </button>
            )}
        </div>
    );
}

function InsertBetweenControl({
    direction,
    node,
    onClick,
    targetNode,
}: {
    direction: Direction;
    node: EditableNode;
    onClick: () => void;
    targetNode: EditableNode;
}) {
    const line = insertControlLine(direction);

    return (
        <button
            aria-label={`Insert tile between ${node.title} and ${targetNode.title}`}
            className="pointer-events-auto absolute z-10 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-600/45 bg-white/95 text-cyan-700 shadow-sm transition hover:scale-105 hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-teal-200/45 dark:bg-slate-950/95 dark:text-teal-200 dark:hover:bg-teal-200/15 dark:focus-visible:ring-teal-200"
            draggable={false}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
                left: `${line.midpoint.x}px`,
                top: `${line.midpoint.y}px`,
            }}
            type="button"
        >
            <span className="text-lg leading-none">+</span>
        </button>
    );
}

function TextField({
    colorPicker = false,
    error,
    label,
    onChange,
    placeholder,
    value,
}: {
    colorPicker?: boolean;
    error?: string;
    label: string;
    onChange: (value: string) => void;
    placeholder?: string;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');
    const pickerValue = isHexColor(value) ? value : '#000000';

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <div
                className={cn(
                    'grid gap-2',
                    colorPicker && 'grid-cols-[auto_1fr]',
                )}
            >
                {colorPicker ? (
                    <Input
                        aria-label={`${label} picker`}
                        className="h-9 w-12 cursor-pointer p-1"
                        onChange={(event) =>
                            onChange(event.currentTarget.value)
                        }
                        type="color"
                        value={pickerValue}
                    />
                ) : null}
                <Input
                    id={id}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    placeholder={placeholder}
                    value={value}
                />
            </div>
            <InputError message={error} />
        </div>
    );
}

function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

const nodeVisualFields: {
    key: keyof Omit<NodeVisualThemeFields, 'imageUrl'>;
    label: string;
}[] = [
    { key: 'tileColor', label: 'Tile color' },
    { key: 'foregroundColor', label: 'Icon/text color' },
    { key: 'labelColor', label: 'Label color' },
    { key: 'highlightColor', label: 'Highlight color' },
];

const mapVisualFields: {
    key: keyof Omit<MapVisualThemeFields, 'imageUrl'>;
    label: string;
}[] = [
    { key: 'overlay', label: 'Overlay background' },
    { key: 'pageBackground', label: 'Page background' },
    { key: 'panelBackground', label: 'Map panel background' },
    { key: 'panelTextColor', label: 'Map panel text' },
    { key: 'panelMutedTextColor', label: 'Map panel muted text' },
    { key: 'accentColor', label: 'Accent color' },
    { key: 'sidePanelBackground', label: 'Side panel background' },
    { key: 'sidePanelBorderColor', label: 'Side panel border' },
    { key: 'sidePanelTextColor', label: 'Side panel text' },
    { key: 'sidePanelMutedTextColor', label: 'Side panel muted text' },
];

function NodeVisualModeFields({
    errors,
    imageError,
    mode,
    onImageUpload,
    setForm,
    uploadingImage,
    values,
}: {
    errors: Record<string, string>;
    imageError?: string;
    mode: ThemeMode;
    onImageUpload: (file: File) => void;
    setForm: Dispatch<SetStateAction<NodeForm>>;
    uploadingImage: boolean;
    values: NodeVisualThemeFields;
}) {
    const labelPrefix = mode === 'dark' ? 'Dark mode' : 'Light mode';

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div>
                <h3 className="text-sm font-semibold">{labelPrefix}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    These values define how the tile appears in this mode.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {nodeVisualFields.map((field) => (
                    <TextField
                        colorPicker
                        error={errors[`visual_config.${mode}.${field.key}`]}
                        key={field.key}
                        label={`${labelPrefix} ${field.label}`}
                        onChange={(value) =>
                            setVisualThemeTextConfig(
                                setForm,
                                mode,
                                field.key,
                                value,
                            )
                        }
                        value={values[field.key]}
                    />
                ))}
            </div>
            <NodeImageInput
                description={`${labelPrefix} image displayed on this tile in the world map.`}
                error={imageError || errors[`visual_config.${mode}.imageUrl`]}
                id={`node-${mode}-image-url`}
                label={`${labelPrefix} node image`}
                onChange={(value) =>
                    setVisualThemeTextConfig(setForm, mode, 'imageUrl', value)
                }
                onUpload={onImageUpload}
                uploading={uploadingImage}
                value={values.imageUrl}
            />
        </div>
    );
}

function MapVisualModeFields({
    errors,
    imageError,
    mode,
    onImageUpload,
    setForm,
    uploadingImage,
    values,
}: {
    errors: Record<string, string>;
    imageError?: string;
    mode: ThemeMode;
    onImageUpload: (file: File) => void;
    setForm: Dispatch<SetStateAction<MapVisualForm>>;
    uploadingImage: boolean;
    values: MapVisualThemeFields;
}) {
    const labelPrefix = mode === 'dark' ? 'Dark mode' : 'Light mode';

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div>
                <h3 className="text-sm font-semibold">{labelPrefix}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Empty fields inherit the fallback map visual values.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {mapVisualFields.map((field) => (
                    <TextField
                        error={errors[`background_config.${mode}.${field.key}`]}
                        key={field.key}
                        label={`${labelPrefix} ${field.label}`}
                        onChange={(value) =>
                            setMapVisualThemeTextConfig(
                                setForm,
                                mode,
                                field.key,
                                value,
                            )
                        }
                        value={values[field.key]}
                    />
                ))}
            </div>
            <NodeImageInput
                description={`${labelPrefix} background image override for this map.`}
                error={
                    imageError || errors[`background_config.${mode}.imageUrl`]
                }
                id={`map-${mode}-image-url`}
                label={`${labelPrefix} map image`}
                onChange={(value) =>
                    setMapVisualThemeTextConfig(
                        setForm,
                        mode,
                        'imageUrl',
                        value,
                    )
                }
                onUpload={onImageUpload}
                uploading={uploadingImage}
                value={values.imageUrl}
            />
        </div>
    );
}

function NodeImageInput({
    description,
    error,
    id,
    label,
    onChange,
    onUpload,
    uploading,
    value,
}: {
    description: string;
    error?: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    value: string;
}) {
    const uploadId = `${id}-upload`;

    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                    <Image className="size-4" />
                </span>
                <div>
                    <Label htmlFor={id}>{label}</Label>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>
            </div>

            <Input
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder="/storage/learning/nodes/example.svg"
                value={value}
            />
            <InputError message={error} />

            {value ? (
                <div className="flex items-center gap-3 rounded-md bg-slate-50 p-2 dark:bg-white/5">
                    <img
                        alt=""
                        className="size-12 rounded object-contain"
                        src={value}
                    />
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {value}
                    </span>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="secondary">
                    <label htmlFor={uploadId}>
                        <Upload className="size-4" />
                        {uploading ? 'Uploading...' : 'Upload'}
                    </label>
                </Button>
                <input
                    accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    id={uploadId}
                    onChange={(event) => {
                        const file = event.currentTarget.files?.[0];

                        if (file) {
                            onUpload(file);
                        }

                        event.currentTarget.value = '';
                    }}
                    type="file"
                />
                <Button asChild disabled={!value} size="sm" variant="ghost">
                    <a download href={value || '#'} rel="noreferrer">
                        <Download className="size-4" />
                        Download
                    </a>
                </Button>
            </div>
        </div>
    );
}

function CheckboxField({
    checked,
    description,
    id,
    label,
    onCheckedChange,
}: {
    checked: boolean;
    description: string;
    id: string;
    label: string;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-start gap-3">
            <Checkbox
                checked={checked}
                id={id}
                onCheckedChange={(value) => onCheckedChange(value === true)}
            />
            <div className="grid gap-1">
                <Label htmlFor={id}>{label}</Label>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </div>
        </div>
    );
}

function setVisualTextConfig(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    key: 'label' | 'tooltip',
    value: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            [key]: value,
        },
    }));
}

function setVisualThemeTextConfig(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    mode: ThemeMode,
    key: keyof NodeVisualThemeFields,
    value: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            [mode]: {
                ...current.visual_config[mode],
                [key]: value,
            },
        },
    }));
}

function setVisualBooleanConfig(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    key: 'hideEmptySpace' | 'hideImage' | 'hideLabel',
    value: boolean,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            [key]: value,
        },
    }));
}

function setMapVisualTextConfig(
    setForm: Dispatch<SetStateAction<MapVisualForm>>,
    key: keyof MapVisualThemeFields,
    value: string,
) {
    setForm((current) => ({
        ...current,
        [key]: value,
    }));
}

function setMapVisualThemeTextConfig(
    setForm: Dispatch<SetStateAction<MapVisualForm>>,
    mode: ThemeMode,
    key: keyof MapVisualThemeFields,
    value: string,
) {
    setForm((current) => ({
        ...current,
        [mode]: {
            ...current[mode],
            [key]: value,
        },
    }));
}

function defaultNodeVisualThemeFields(mode: ThemeMode): NodeVisualThemeFields {
    if (mode === 'light') {
        return {
            foregroundColor: '#1d4ed8',
            highlightColor: '#2563eb',
            imageUrl: '',
            labelColor: '#0f172a',
            tileColor: '#dbeafe',
        };
    }

    return {
        foregroundColor: '#bfdbfe',
        highlightColor: '#7dd3fc',
        imageUrl: '',
        labelColor: '#ffffff',
        tileColor: '#253047',
    };
}

function emptyNodeVisualThemeFields(): NodeVisualThemeFields {
    return {
        foregroundColor: '',
        highlightColor: '',
        imageUrl: '',
        labelColor: '',
        tileColor: '',
    };
}

function emptyMapVisualThemeFields(): MapVisualThemeFields {
    return {
        accentColor: '',
        imageUrl: '',
        overlay: '',
        pageBackground: '',
        panelBackground: '',
        panelMutedTextColor: '',
        panelTextColor: '',
        sidePanelBackground: '',
        sidePanelBorderColor: '',
        sidePanelMutedTextColor: '',
        sidePanelTextColor: '',
    };
}

function emptyNodeForm(q: number, r: number): NodeForm {
    return {
        title: '',
        slug: '',
        description: '',
        position_q: q,
        position_r: r,
        state: 'available',
        visual_config: {
            dark: defaultNodeVisualThemeFields('dark'),
            label: '',
            hideEmptySpace: false,
            hideImage: false,
            hideLabel: false,
            light: defaultNodeVisualThemeFields('light'),
            tooltip: '',
        },
    };
}

function firstNodeForm(q: number, r: number): NodeForm {
    const form = emptyNodeForm(q, r);

    return {
        ...form,
        title: 'First Tile',
        visual_config: {
            ...form.visual_config,
            label: 'First Tile',
            tooltip: 'Starting tile for this map.',
        },
    };
}

function emptySpaceOverride(q: number, r: number): Partial<NodeForm> {
    return {
        title: 'Empty Space',
        slug: '',
        description: 'Structural spacer used to extend the editable map.',
        position_q: q,
        position_r: r,
        state: 'hidden',
        visual_config: {
            dark: {
                foregroundColor: '#94a3b8',
                highlightColor: '#94a3b8',
                imageUrl: '',
                labelColor: '#64748b',
                tileColor: '#f8fafc',
            },
            label: '',
            hideEmptySpace: true,
            hideImage: false,
            hideLabel: true,
            light: {
                foregroundColor: '#94a3b8',
                highlightColor: '#94a3b8',
                imageUrl: '',
                labelColor: '#64748b',
                tileColor: '#f8fafc',
            },
            tooltip: 'Empty editor-only space.',
        },
    };
}

function nodeFormFromNode(node: EditableNode): NodeForm {
    return {
        title: node.title,
        slug: node.slug,
        description: node.description ?? '',
        position_q: node.position.q,
        position_r: node.position.r,
        state: node.state,
        visual_config: {
            dark: nodeVisualThemeFieldsFromConfig(node.visualConfig.dark, {
                foregroundColor: stringConfig(
                    node.visualConfig.foregroundColor,
                    '#bfdbfe',
                ),
                highlightColor: stringConfig(
                    node.visualConfig.highlightColor,
                    '#7dd3fc',
                ),
                imageUrl: stringConfig(node.visualConfig.imageUrl, ''),
                labelColor: stringConfig(
                    node.visualConfig.labelColor,
                    '#ffffff',
                ),
                tileColor: stringConfig(node.visualConfig.tileColor, '#253047'),
            }),
            label: stringConfig(node.visualConfig.label, node.title),
            hideEmptySpace: booleanConfig(
                node.visualConfig.hideEmptySpace,
                node.state === 'hidden',
            ),
            hideImage: booleanConfig(node.visualConfig.hideImage, false),
            hideLabel: booleanConfig(node.visualConfig.hideLabel, false),
            light: nodeVisualThemeFieldsFromConfig(
                node.visualConfig.light,
                defaultNodeVisualThemeFields('light'),
            ),
            tooltip: stringConfig(node.visualConfig.tooltip, ''),
        },
    };
}

function mapVisualFormFromConfig(config: MapVisualConfig): MapVisualForm {
    return {
        ...mapVisualThemeFieldsFromConfig(config),
        dark: mapVisualThemeFieldsFromConfig(config.dark),
        light: mapVisualThemeFieldsFromConfig(config.light),
    };
}

function nodeVisualThemeFieldsFromConfig(
    config: VisualConfigValue,
    fallback: NodeVisualThemeFields = emptyNodeVisualThemeFields(),
): NodeVisualThemeFields {
    const themeConfig = isVisualConfig(config) ? config : {};

    return {
        foregroundColor: stringConfig(
            themeConfig.foregroundColor,
            fallback.foregroundColor,
        ),
        highlightColor: stringConfig(
            themeConfig.highlightColor,
            fallback.highlightColor,
        ),
        imageUrl: stringConfig(themeConfig.imageUrl, fallback.imageUrl),
        labelColor: stringConfig(themeConfig.labelColor, fallback.labelColor),
        tileColor: stringConfig(themeConfig.tileColor, fallback.tileColor),
    };
}

function mapVisualThemeFieldsFromConfig(
    config: Partial<MapVisualThemeFields> | undefined,
): MapVisualThemeFields {
    return {
        ...emptyMapVisualThemeFields(),
        accentColor: stringConfig(config?.accentColor, ''),
        imageUrl: stringConfig(config?.imageUrl, ''),
        overlay: stringConfig(config?.overlay, ''),
        pageBackground: stringConfig(config?.pageBackground, ''),
        panelBackground: stringConfig(config?.panelBackground, ''),
        panelMutedTextColor: stringConfig(config?.panelMutedTextColor, ''),
        panelTextColor: stringConfig(config?.panelTextColor, ''),
        sidePanelBackground: stringConfig(config?.sidePanelBackground, ''),
        sidePanelBorderColor: stringConfig(config?.sidePanelBorderColor, ''),
        sidePanelMutedTextColor: stringConfig(
            config?.sidePanelMutedTextColor,
            '',
        ),
        sidePanelTextColor: stringConfig(config?.sidePanelTextColor, ''),
    };
}

function isVisualConfig(value: VisualConfigValue): value is NestedVisualConfig {
    return typeof value === 'object' && value !== null;
}

function booleanConfig(value: VisualConfigValue, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
}

function stringConfig(value: unknown, fallback: string) {
    return typeof value === 'string' ? value : fallback;
}

function mergeNodeForm(form: NodeForm, override?: Partial<NodeForm>): NodeForm {
    if (!override) {
        return form;
    }

    return {
        ...form,
        ...override,
        visual_config: {
            ...form.visual_config,
            ...override.visual_config,
            dark: {
                ...form.visual_config.dark,
                ...override.visual_config?.dark,
            },
            light: {
                ...form.visual_config.light,
                ...override.visual_config?.light,
            },
        },
    };
}

function buildGridCells(
    nodes: EditableNode[],
    occupied: Map<string, EditableNode>,
): GridCell[] {
    const coordinates = new Set<string>();

    if (nodes.length === 0) {
        coordinates.add(coordinateKey(0, 0));
    }

    nodes.forEach((node) => {
        coordinates.add(coordinateKey(node.position.q, node.position.r));

        directions.forEach((direction) => {
            coordinates.add(
                coordinateKey(
                    node.position.q + direction.q,
                    node.position.r + direction.r,
                ),
            );
        });
    });

    return Array.from(coordinates)
        .map((key) => {
            const [q, r] = key.split(':').map(Number);
            const { x, y } = axialToPoint(q, r);

            return {
                q,
                r,
                x,
                y,
                occupiedNode: occupied.get(key) ?? null,
            };
        })
        .sort((first, second) => first.y - second.y || first.x - second.x);
}

function nodeMap(nodes: EditableNode[]): Map<string, EditableNode> {
    return new Map(
        nodes.map((node) => [
            coordinateKey(node.position.q, node.position.r),
            node,
        ]),
    );
}
