import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronRight,
    Download,
    GitBranch,
    Image,
    Map as MapIcon,
    Save,
    Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Dispatch, PointerEvent, SetStateAction } from 'react';
import InputError from '@/components/input-error';
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
    visualConfig: Record<string, boolean | string>;
};

type EditableMap = {
    backgroundConfig: Record<string, unknown>;
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

type EditableMapPayload = {
    map: EditableMap;
    world: EditableWorld;
};

type Direction = {
    label: string;
    q: number;
    r: number;
    rotate: number;
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
        foregroundColor: string;
        highlightColor: string;
        hideEmptySpace: boolean;
        hideLabel: boolean;
        icon: string;
        imageUrl: string;
        label: string;
        labelColor: string;
        tileColor: string;
        tooltip: string;
    };
};

const directions: Direction[] = [
    { label: 'right', q: 1, r: 0, rotate: 0 },
    { label: 'upper right', q: 1, r: -1, rotate: -60 },
    { label: 'upper left', q: 0, r: -1, rotate: -120 },
    { label: 'left', q: -1, r: 0, rotate: 180 },
    { label: 'lower left', q: -1, r: 1, rotate: 120 },
    { label: 'lower right', q: 0, r: 1, rotate: 60 },
];

const hexWidth = 120;
const hexHeight = 104;
const edgeGap = 90;
const centerDistanceScale = (hexHeight + edgeGap) / hexHeight;
const horizontalStep = hexWidth * 0.75 * centerDistanceScale;
const verticalStep = hexHeight + edgeGap;
const tileControlWidth = 220;
const tileControlHeight = 202;
const tileCenter = {
    x: tileControlWidth / 2,
    y: tileControlHeight / 2,
};
const edgeControlOutset = 8;
const dragClickThreshold = 6;

export default function EditWorldMap({
    editableMap,
}: {
    editableMap: EditableMapPayload;
}) {
    const { map, world } = editableMap;
    const [selectedNode, setSelectedNode] = useState<EditableNode | null>(null);
    const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [uploadingNodeImage, setUploadingNodeImage] = useState(false);
    const [nodeImageUploadError, setNodeImageUploadError] = useState('');
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
        setNodeImageUploadError('');
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
        setNodeImageUploadError('');
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
        setNodeImageUploadError('');
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

    const uploadNodeImage = async (file: File) => {
        const formData = new FormData();
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        formData.append('image', file);
        setUploadingNodeImage(true);
        setNodeImageUploadError('');

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
                setNodeImageUploadError(
                    payload.errors?.image?.[0] ??
                        payload.message ??
                        'The image could not be uploaded.',
                );

                return;
            }

            setVisualTextConfig(setForm, 'imageUrl', payload.url);
        } catch {
            setNodeImageUploadError('The image could not be uploaded.');
        } finally {
            setUploadingNodeImage(false);
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
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                Edit {map.title}
                            </h1>
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
                                    onSwap={swapNode}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            </main>

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
                                                current.visual_config.label ||
                                                value,
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
                            <TextField
                                error={errors['visual_config.icon']}
                                label="Icon key"
                                onChange={(value) =>
                                    setVisualTextConfig(setForm, 'icon', value)
                                }
                                value={form.visual_config.icon}
                            />
                            <TextField
                                error={errors['visual_config.label']}
                                label="Tile label"
                                onChange={(value) =>
                                    setVisualTextConfig(setForm, 'label', value)
                                }
                                value={form.visual_config.label}
                            />
                            <TextField
                                error={errors['visual_config.tileColor']}
                                label="Tile color"
                                onChange={(value) =>
                                    setVisualTextConfig(
                                        setForm,
                                        'tileColor',
                                        value,
                                    )
                                }
                                value={form.visual_config.tileColor}
                            />
                            <TextField
                                error={errors['visual_config.highlightColor']}
                                label="Highlight color"
                                onChange={(value) =>
                                    setVisualTextConfig(
                                        setForm,
                                        'highlightColor',
                                        value,
                                    )
                                }
                                value={form.visual_config.highlightColor}
                            />
                        </div>

                        <NodeImageInput
                            error={
                                nodeImageUploadError ||
                                errors['visual_config.imageUrl']
                            }
                            onChange={(value) =>
                                setVisualTextConfig(setForm, 'imageUrl', value)
                            }
                            onUpload={(file) => void uploadNodeImage(file)}
                            uploading={uploadingNodeImage}
                            value={form.visual_config.imageUrl}
                        />

                        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
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
                            {form.state === 'hidden' ? (
                                <CheckboxField
                                    checked={form.visual_config.hideEmptySpace}
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
                                        description: event.currentTarget.value,
                                    }))
                                }
                                value={form.description}
                            />
                            <InputError message={errors.description} />
                        </div>
                    </div>

                    <DialogFooter>
                        {selectedNode ? (
                            <Button asChild type="button" variant="outline">
                                <Link
                                    href={`/settings/worlds/nodes/${selectedNode.id}/activities`}
                                >
                                    <GitBranch className="size-4" />
                                    Edit activities
                                </Link>
                            </Button>
                        ) : null}
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
    onAdd,
    onEdit,
    onInsert,
    onSwap,
}: {
    cell: GridCell;
    neighboringNode: (direction: Direction) => EditableNode | null;
    onAdd: () => void;
    onEdit: (node: EditableNode) => void;
    onInsert: (node: EditableNode, direction: Direction) => void;
    onSwap: (node: EditableNode, direction: Direction) => void;
}) {
    const node = cell.occupiedNode;
    const visual = node?.visualConfig ?? {};
    const isEmptySpace = node?.state === 'hidden';
    const imageUrl = typeof visual.imageUrl === 'string' ? visual.imageUrl : '';
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
                        {imageUrl ? (
                            <img
                                alt=""
                                className="max-h-12 max-w-16 object-contain"
                                draggable={false}
                                src={imageUrl}
                            />
                        ) : null}
                        {!hideLabel || isEmptySpace ? (
                            <span>
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
    error,
    label,
    onChange,
    placeholder,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    placeholder?: string;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder={placeholder}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function NodeImageInput({
    error,
    onChange,
    onUpload,
    uploading,
    value,
}: {
    error?: string;
    onChange: (value: string) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    value: string;
}) {
    const uploadId = 'node-image-upload';

    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                    <Image className="size-4" />
                </span>
                <div>
                    <Label htmlFor="node-image-url">Node image</Label>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        If set, this image is shown instead of the configured
                        icon.
                    </p>
                </div>
            </div>

            <Input
                id="node-image-url"
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
    key:
        | 'foregroundColor'
        | 'highlightColor'
        | 'icon'
        | 'imageUrl'
        | 'label'
        | 'labelColor'
        | 'tileColor'
        | 'tooltip',
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

function setVisualBooleanConfig(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    key: 'hideEmptySpace' | 'hideLabel',
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

function emptyNodeForm(q: number, r: number): NodeForm {
    return {
        title: '',
        slug: '',
        description: '',
        position_q: q,
        position_r: r,
        state: 'available',
        visual_config: {
            icon: 'map',
            imageUrl: '',
            label: '',
            tileColor: '#253047',
            foregroundColor: '#bfdbfe',
            labelColor: '#ffffff',
            highlightColor: '#7dd3fc',
            hideEmptySpace: false,
            hideLabel: false,
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
            icon: 'empty',
            imageUrl: '',
            label: '',
            tileColor: '#f8fafc',
            foregroundColor: '#94a3b8',
            labelColor: '#64748b',
            highlightColor: '#94a3b8',
            hideEmptySpace: true,
            hideLabel: true,
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
            icon: stringConfig(node.visualConfig.icon, 'map'),
            imageUrl: stringConfig(node.visualConfig.imageUrl, ''),
            label: stringConfig(node.visualConfig.label, node.title),
            tileColor: stringConfig(node.visualConfig.tileColor, '#253047'),
            foregroundColor: stringConfig(
                node.visualConfig.foregroundColor,
                '#bfdbfe',
            ),
            labelColor: stringConfig(node.visualConfig.labelColor, '#ffffff'),
            highlightColor: stringConfig(
                node.visualConfig.highlightColor,
                '#7dd3fc',
            ),
            hideEmptySpace: booleanConfig(
                node.visualConfig.hideEmptySpace,
                node.state === 'hidden',
            ),
            hideLabel: booleanConfig(node.visualConfig.hideLabel, false),
            tooltip: stringConfig(node.visualConfig.tooltip, ''),
        },
    };
}

function booleanConfig(value: boolean | string | undefined, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
}

function stringConfig(value: boolean | string | undefined, fallback: string) {
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

function axialToPoint(q: number, r: number): { x: number; y: number } {
    return {
        x: q * horizontalStep,
        y: (r + q / 2) * verticalStep,
    };
}

function edgeControlPosition(direction: Direction): {
    rotation: number;
    x: number;
    y: number;
} {
    const edge = edgeGeometryForDirection(direction);
    const normal = unitVectorForAngle(screenAngleForDirection(direction));

    return {
        rotation: screenAngleForDirection(direction),
        x: tileCenter.x + edge.center.x + normal.x * edgeControlOutset,
        y: tileCenter.y + edge.center.y + normal.y * edgeControlOutset,
    };
}

function insertControlLine(direction: Direction): {
    end: { x: number; y: number };
    midpoint: { x: number; y: number };
    start: { x: number; y: number };
} {
    const sourceArrow = edgeControlPosition(direction);
    const neighborOffset = axialToPoint(direction.q, direction.r);
    const targetArrow = edgeControlPosition(oppositeDirection(direction));
    const end = {
        x: neighborOffset.x + targetArrow.x,
        y: neighborOffset.y + targetArrow.y,
    };
    const start = {
        x: sourceArrow.x,
        y: sourceArrow.y,
    };

    return {
        end,
        midpoint: {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
        },
        start,
    };
}

function oppositeDirection(direction: Direction): Direction {
    return (
        directions.find(
            (candidate) =>
                candidate.q === -direction.q && candidate.r === -direction.r,
        ) ?? direction
    );
}

function screenAngleForDirection(direction: Direction): number {
    const target = axialToPoint(direction.q, direction.r);

    return (Math.atan2(target.y, target.x) * 180) / Math.PI;
}

function unitVectorForAngle(angle: number): { x: number; y: number } {
    const radians = (angle * Math.PI) / 180;

    return {
        x: Math.cos(radians),
        y: Math.sin(radians),
    };
}

function edgeGeometryForDirection(direction: Direction): {
    center: { x: number; y: number };
    tangentAngle: number;
} {
    switch (coordinateKey(direction.q, direction.r)) {
        case '1:0':
            return {
                center: { x: hexWidth * 0.375, y: hexHeight * 0.25 },
                tangentAngle: -60,
            };
        case '1:-1':
            return {
                center: { x: hexWidth * 0.375, y: -hexHeight * 0.25 },
                tangentAngle: 60,
            };
        case '0:-1':
            return {
                center: { x: 0, y: -hexHeight * 0.5 },
                tangentAngle: 0,
            };
        case '-1:0':
            return {
                center: { x: -hexWidth * 0.375, y: -hexHeight * 0.25 },
                tangentAngle: -60,
            };
        case '-1:1':
            return {
                center: { x: -hexWidth * 0.375, y: hexHeight * 0.25 },
                tangentAngle: 60,
            };
        case '0:1':
            return {
                center: { x: 0, y: hexHeight * 0.5 },
                tangentAngle: 0,
            };
        default:
            return {
                center: { x: 0, y: 0 },
                tangentAngle: 0,
            };
    }
}

function coordinateKey(q: number, r: number): string {
    return `${q}:${r}`;
}
