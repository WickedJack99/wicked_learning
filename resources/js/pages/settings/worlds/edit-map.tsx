import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronRight,
    Eye,
    GitBranch,
    LockKeyhole,
    Map as MapIcon,
    Palette,
    PanelRight,
    Save,
    ShieldCheck,
    Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Dispatch, PointerEvent, SetStateAction } from 'react';
import { ColorOpacityField, isHexColor } from '@/components/color-input';
import InputError from '@/components/input-error';
import { SettingsAccordionSection } from '@/components/settings-accordion-section';
import { SoundAssetInput } from '@/components/sound-asset-input';
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
import { resolveThemeVariant, withOpacity } from '@/features/world/theme';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type { LearningTool } from '@/types';
import { ConfigImageInput as NodeImageInput } from './activity-config-fields';

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
    accessRoles: string[];
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

interface NestedVisualConfig {
    [key: string]:
        | boolean
        | number
        | string
        | string[]
        | NestedVisualConfig
        | NestedVisualConfig[]
        | undefined;
}

type VisualConfigValue =
    | boolean
    | number
    | string
    | string[]
    | NestedVisualConfig
    | NestedVisualConfig[]
    | undefined;

type VisualConfig = Record<string, VisualConfigValue>;

type ThemeMode = 'dark' | 'light';

type NodeVisualThemeFields = {
    foregroundColor: string;
    foregroundOpacity: string;
    highlightColor: string;
    highlightOpacity: string;
    imageRotation: string;
    imageUrl: string;
    imageWidth: string;
    imageX: string;
    imageY: string;
    labelColor: string;
    labelOpacity: string;
    tileColor: string;
    tileOpacity: string;
};

type NodeSoundTriggerConfig = {
    enabled: boolean;
    url: string;
};

type NodeSoundFields = {
    click: NodeSoundTriggerConfig;
    mouseEnter: NodeSoundTriggerConfig;
    mouseLeave: NodeSoundTriggerConfig;
    unlock: NodeSoundTriggerConfig;
};

type UnlockRule =
    | {
          nodeId: number;
          type: 'node_completed';
      }
    | {
          operator: 'and' | 'or';
          rules: UnlockRule[];
          type: 'group';
      }
    | {
          type: 'tool_used';
      };

type MapVisualThemeFields = {
    accentColor: string;
    bottomNavActiveBackground: string;
    bottomNavActiveTextColor: string;
    bottomNavBackground: string;
    bottomNavBorderColor: string;
    bottomNavTextColor: string;
    completedDimOpacity: string;
    imageUrl: string;
    overlay: string;
    pageBackground: string;
    panelBackground: string;
    panelBorderColor: string;
    panelMutedTextColor: string;
    panelTextColor: string;
    sideControlActiveBackground: string;
    sideControlActiveTextColor: string;
    sideControlBackground: string;
    sideControlBorderColor: string;
    sideControlTextColor: string;
    sidePanelBackground: string;
    sidePanelBorderColor: string;
    sidePanelMutedTextColor: string;
    sidePanelTextColor: string;
};

type MapVisualConfig = {
    dark?: Partial<MapVisualThemeFields>;
    light?: Partial<MapVisualThemeFields>;
};

type EditableMapPayload = {
    map: EditableMap;
    world: EditableWorld;
};

type AccessGroup = {
    description: string | null;
    label: string;
    slug: string;
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
        reveal: {
            enabled: boolean;
            toolId: string;
        };
        sounds: NodeSoundFields;
        tooltip: string;
        unlock: {
            enabled: boolean;
            nodeOperator: 'and' | 'or';
            requiredNodeIds: string[];
            tool: {
                enabled: boolean;
                toolId: string;
            };
            topOperator: 'and' | 'or';
            rules?: UnlockRule;
        };
    };
};

type MapVisualForm = {
    dark: MapVisualThemeFields;
    light: MapVisualThemeFields;
};

type MapDetailsForm = {
    description: string;
    title: string;
};

type NodeSettingsSection =
    | 'right-panel'
    | 'availability'
    | 'visuals'
    | 'sounds';

export default function EditWorldMap({
    accessGroups,
    editableMap,
    tools,
}: {
    accessGroups: AccessGroup[];
    editableMap: EditableMapPayload;
    tools: LearningTool[];
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
    const [mapAccessOpen, setMapAccessOpen] = useState(false);
    const [mapAccessRoles, setMapAccessRoles] = useState<string[]>(() =>
        map.accessRoles.length > 0 ? map.accessRoles : ['user', 'admin'],
    );
    const [mapAccessErrors, setMapAccessErrors] = useState<
        Record<string, string>
    >({});
    const [mapDetailsOpen, setMapDetailsOpen] = useState(false);
    const [mapDetailsForm, setMapDetailsForm] = useState<MapDetailsForm>(
        () => ({
            description: map.description ?? '',
            title: map.title,
        }),
    );
    const [mapDetailsErrors, setMapDetailsErrors] = useState<
        Record<string, string>
    >({});
    const [mapVisualOpen, setMapVisualOpen] = useState(false);
    const [activeNodeSettingsSection, setActiveNodeSettingsSection] =
        useState<NodeSettingsSection>('right-panel');
    const [mapVisualForm, setMapVisualForm] = useState<MapVisualForm>(() =>
        mapVisualFormFromConfig(map.backgroundConfig),
    );
    const [mapVisualErrors, setMapVisualErrors] = useState<
        Record<string, string>
    >({});
    const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
        null,
    );
    const [uploadingSoundKey, setUploadingSoundKey] = useState<string | null>(
        null,
    );
    const [imageUploadErrors, setImageUploadErrors] = useState<
        Record<string, string>
    >({});
    const [soundUploadErrors, setSoundUploadErrors] = useState<
        Record<string, string>
    >({});
    const [form, setForm] = useState<NodeForm>(() => emptyNodeForm(0, 0));
    const [insertionContext, setInsertionContext] =
        useState<InsertionContext | null>(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDraggingSurface, setIsDraggingSurface] = useState(false);
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
        setSoundUploadErrors({});
        setActiveNodeSettingsSection('right-panel');
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
        setSoundUploadErrors({});
        setActiveNodeSettingsSection('right-panel');
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
        setSoundUploadErrors({});
        setActiveNodeSettingsSection('right-panel');
        setForm(nodeFormFromNode(node));
    };

    const closeDialog = () => {
        setSelectedCell(null);
        setSelectedNode(null);
        setInsertionContext(null);
    };

    const saveNode = (override?: Partial<NodeForm>) => {
        setProcessing(true);

        const payload = nodePayload(mergeNodeForm(form, override));
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

    const resetNodeUnlocksForAllUsers = () => {
        if (!selectedNode) {
            return;
        }

        const confirmed = window.confirm(
            `Lock "${selectedNode.title}" for all users again? This resets learner-specific tool unlocks for this node.`,
        );

        if (!confirmed) {
            return;
        }

        setProcessing(true);

        router.post(
            `/settings/worlds/nodes/${selectedNode.id}/reset-unlocks`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setProcessing(false),
            },
        );
    };

    const saveMapVisuals = () => {
        setProcessing(true);

        router.patch(
            `/settings/worlds/maps/${map.id}`,
            {
                background_config: mapVisualPayload(mapVisualForm),
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

    const saveMapDetails = () => {
        setProcessing(true);

        router.patch(
            `/settings/worlds/maps/${map.id}/details`,
            mapDetailsForm,
            {
                preserveScroll: true,
                onError: (nextErrors) => setMapDetailsErrors(nextErrors),
                onSuccess: () => {
                    setMapDetailsOpen(false);
                    setMapDetailsErrors({});
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const saveMapAccess = () => {
        setProcessing(true);

        router.patch(
            `/settings/worlds/maps/${map.id}/access`,
            {
                access_roles: mapAccessRoles,
            },
            {
                preserveScroll: true,
                onError: (nextErrors) => setMapAccessErrors(nextErrors),
                onSuccess: () => {
                    setMapAccessOpen(false);
                    setMapAccessErrors({});
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const toggleMapAccessRole = (role: string, enabled: boolean) => {
        setMapAccessRoles((current) => {
            if (enabled) {
                return current.includes(role) ? current : [...current, role];
            }

            const nextRoles = current.filter(
                (currentRole) => currentRole !== role,
            );

            return nextRoles.length > 0 ? nextRoles : current;
        });
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

    const uploadWorldSound = async (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => {
        const formData = new FormData();
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        formData.append('file', file);
        setUploadingSoundKey(key);
        setSoundUploadErrors((current) => ({ ...current, [key]: '' }));

        try {
            const response = await fetch('/settings/assets/sound-media', {
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
                setSoundUploadErrors((current) => ({
                    ...current,
                    [key]:
                        payload.errors?.file?.[0] ??
                        payload.message ??
                        'The sound could not be uploaded.',
                }));

                return;
            }

            onUploaded(payload.url);
        } catch {
            setSoundUploadErrors((current) => ({
                ...current,
                [key]: 'The sound could not be uploaded.',
            }));
        } finally {
            setUploadingSoundKey(null);
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
            setIsDraggingSurface(true);
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
        setIsDraggingSurface(false);

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
                                        setMapDetailsForm({
                                            description: map.description ?? '',
                                            title: map.title,
                                        });
                                        setMapDetailsErrors({});
                                        setMapDetailsOpen(true);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    <PanelRight className="size-4" />
                                    Map details
                                </Button>
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
                                <Button
                                    onClick={() => {
                                        setMapAccessRoles(
                                            map.accessRoles.length > 0
                                                ? map.accessRoles
                                                : ['user', 'admin'],
                                        );
                                        setMapAccessErrors({});
                                        setMapAccessOpen(true);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    <ShieldCheck className="size-4" />
                                    Access
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
                        data-draggable-surface="true"
                        data-dragging={isDraggingSurface ? 'true' : undefined}
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
                        <div
                            className="absolute top-4 left-4 z-30 max-w-sm rounded-xl border p-3 text-sm shadow-lg backdrop-blur"
                            style={{
                                background:
                                    previewMapTheme.panelBackground ??
                                    (resolvedAppearance === 'light'
                                        ? 'rgba(255, 255, 255, 0.82)'
                                        : 'rgba(15, 23, 42, 0.7)'),
                                borderColor:
                                    previewMapTheme.panelBorderColor ??
                                    (resolvedAppearance === 'light'
                                        ? 'rgba(226, 232, 240, 0.82)'
                                        : 'rgba(255, 255, 255, 0.1)'),
                                color:
                                    previewMapTheme.panelTextColor ??
                                    (resolvedAppearance === 'light'
                                        ? '#0f172a'
                                        : '#ffffff'),
                            }}
                        >
                            <div className="flex items-center gap-2 font-semibold">
                                <MapIcon
                                    className="size-4"
                                    style={{
                                        color:
                                            previewMapTheme.accentColor ??
                                            (resolvedAppearance === 'light'
                                                ? '#0e7490'
                                                : '#ccfbf1'),
                                    }}
                                />
                                {map.title}
                            </div>
                            <p
                                className="mt-1 text-xs leading-5"
                                style={{
                                    color:
                                        previewMapTheme.panelMutedTextColor ??
                                        previewMapTheme.panelTextColor,
                                }}
                            >
                                {map.description
                                    ? map.description
                                    : `${map.nodes.length} configured tile${
                                          map.nodes.length === 1 ? '' : 's'
                                      }`}
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

            <Dialog onOpenChange={setMapDetailsOpen} open={mapDetailsOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Map details</DialogTitle>
                        <DialogDescription>
                            Edit the title and description shown in the top-left
                            map panel.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <TextField
                            error={mapDetailsErrors.title}
                            label="Title"
                            onChange={(value) =>
                                setMapDetailsForm((current) => ({
                                    ...current,
                                    title: value,
                                }))
                            }
                            value={mapDetailsForm.title}
                        />
                        <div className="grid gap-1">
                            <Label htmlFor="map-description">Description</Label>
                            <textarea
                                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-xs transition focus-visible:border-cyan-600 focus-visible:ring-2 focus-visible:ring-cyan-600/20 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus-visible:border-teal-200 dark:focus-visible:ring-teal-200/20"
                                id="map-description"
                                onChange={(event) =>
                                    setMapDetailsForm((current) => ({
                                        ...current,
                                        description: event.currentTarget.value,
                                    }))
                                }
                                value={mapDetailsForm.description}
                            />
                            <InputError
                                message={mapDetailsErrors.description}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={() => setMapDetailsOpen(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={processing}
                            onClick={saveMapDetails}
                            type="button"
                        >
                            <Save className="size-4" />
                            Save details
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog onOpenChange={setMapVisualOpen} open={mapVisualOpen}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Map visuals</DialogTitle>
                        <DialogDescription>
                            Configure dark-mode defaults and optional light-mode
                            overrides for this map.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
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

            <Dialog onOpenChange={setMapAccessOpen} open={mapAccessOpen}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Access permissions</DialogTitle>
                        <DialogDescription>
                            Choose which groups may visit this map and the tiles
                            inside it. Configuration remains restricted to
                            authorized admins.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3">
                        {accessGroups.map((group) => (
                            <label
                                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5"
                                key={group.slug}
                            >
                                <Checkbox
                                    checked={mapAccessRoles.includes(
                                        group.slug,
                                    )}
                                    onCheckedChange={(checked) =>
                                        toggleMapAccessRole(
                                            group.slug,
                                            checked === true,
                                        )
                                    }
                                />
                                <span className="grid gap-1">
                                    <span className="font-semibold text-slate-950 dark:text-white">
                                        {group.label}
                                    </span>
                                    {group.description ? (
                                        <span className="leading-5 text-slate-600 dark:text-slate-300">
                                            {group.description}
                                        </span>
                                    ) : null}
                                </span>
                            </label>
                        ))}
                        <InputError
                            message={
                                mapAccessErrors.access_roles ??
                                mapAccessErrors['access_roles.0']
                            }
                        />
                    </div>

                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6 text-cyan-950 dark:border-teal-200/20 dark:bg-teal-300/10 dark:text-teal-50">
                        Public maps can be opened without an account. Guest
                        progress, tools and items are not stored on the server;
                        server-side learning state starts after login.
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={() => setMapAccessOpen(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={processing}
                            onClick={saveMapAccess}
                            type="button"
                        >
                            <Save className="size-4" />
                            Save access
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

                        <NodeSettingsSwitcher
                            activeSection={activeNodeSettingsSection}
                            onChange={setActiveNodeSettingsSection}
                        />

                        {activeNodeSettingsSection === 'right-panel' ? (
                            <SettingsAccordionSection
                                description="Name, URL slug and learner-facing summary."
                                title="Right panel"
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
                        ) : null}

                        {activeNodeSettingsSection === 'availability' ? (
                            <>
                                <SettingsAccordionSection
                                    description="Learner-facing label and visibility behavior for the tile."
                                    title="Tile display and text"
                                >
                                    <TextField
                                        error={errors['visual_config.label']}
                                        label="Tile label"
                                        onChange={(value) =>
                                            setVisualTextConfig(
                                                setForm,
                                                'label',
                                                value,
                                            )
                                        }
                                        value={form.visual_config.label}
                                    />
                                    <TextField
                                        error={errors['visual_config.tooltip']}
                                        label="Hover text"
                                        onChange={(value) =>
                                            setVisualTextConfig(
                                                setForm,
                                                'tooltip',
                                                value,
                                            )
                                        }
                                        placeholder="Shown when learners hover the tile"
                                        value={form.visual_config.tooltip}
                                    />

                                    <div className="grid gap-3">
                                        {form.state !== 'hidden' ? (
                                            <CheckboxField
                                                checked={
                                                    form.state === 'locked'
                                                }
                                                description="Locked nodes stay visible with their configured visuals, but learners cannot open them yet."
                                                id="lock-node"
                                                label="Lock node for learners"
                                                onCheckedChange={(checked) =>
                                                    setLockedState(
                                                        setForm,
                                                        checked,
                                                    )
                                                }
                                            />
                                        ) : null}
                                        <CheckboxField
                                            checked={
                                                form.visual_config.hideLabel
                                            }
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
                                            checked={
                                                form.visual_config.hideImage
                                            }
                                            description="The configured dark and light images stay saved, but the world map shows no image or icon fallback."
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
                                                    form.visual_config
                                                        .hideEmptySpace
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
                                    description="Hide this node until a learner uses a configured tool at its map position."
                                    title="Discovery"
                                >
                                    <div className="grid gap-3">
                                        <CheckboxField
                                            checked={
                                                form.visual_config.reveal
                                                    .enabled
                                            }
                                            description="The node keeps its coordinates, but learners only reveal it by equipping the chosen tool and clicking its hidden map position."
                                            id="reveal-with-tool"
                                            label="Hide until revealed with a tool"
                                            onCheckedChange={(checked) =>
                                                setRevealEnabled(
                                                    setForm,
                                                    checked,
                                                )
                                            }
                                        />
                                        <div className="grid gap-1">
                                            <Label htmlFor="reveal-tool">
                                                Reveal tool
                                            </Label>
                                            <select
                                                className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                disabled={
                                                    !form.visual_config.reveal
                                                        .enabled
                                                }
                                                id="reveal-tool"
                                                onChange={(event) =>
                                                    setRevealToolId(
                                                        setForm,
                                                        event.currentTarget
                                                            .value,
                                                    )
                                                }
                                                value={
                                                    form.visual_config.reveal
                                                        .toolId
                                                }
                                            >
                                                <option value="">
                                                    Select a tool
                                                </option>
                                                {tools.map((tool) => (
                                                    <option
                                                        key={tool.id}
                                                        value={tool.id}
                                                    >
                                                        {tool.title}
                                                    </option>
                                                ))}
                                            </select>
                                            <InputError
                                                message={
                                                    errors[
                                                        'visual_config.reveal.toolId'
                                                    ]
                                                }
                                            />
                                        </div>
                                    </div>
                                </SettingsAccordionSection>

                                <SettingsAccordionSection
                                    description="Keep this visible node locked until completion rules and optional tool use allow access."
                                    title="Unlocking"
                                >
                                    <div className="grid gap-3">
                                        <CheckboxField
                                            checked={
                                                form.visual_config.unlock
                                                    .enabled
                                            }
                                            description="Learners cannot open this node until the configured rule evaluates to true."
                                            id="unlock-rules-enabled"
                                            label="Use unlock rules for this node"
                                            onCheckedChange={(checked) =>
                                                setUnlockEnabled(
                                                    setForm,
                                                    checked,
                                                )
                                            }
                                        />
                                        <div className="grid gap-3 rounded-md bg-slate-50 p-3 dark:bg-white/5">
                                            <div className="grid gap-1">
                                                <Label htmlFor="unlock-top-operator">
                                                    Combine node and tool rules
                                                    with
                                                </Label>
                                                <select
                                                    className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                    disabled={
                                                        !form.visual_config
                                                            .unlock.enabled
                                                    }
                                                    id="unlock-top-operator"
                                                    onChange={(event) =>
                                                        setUnlockOperator(
                                                            setForm,
                                                            'topOperator',
                                                            event.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    value={
                                                        form.visual_config
                                                            .unlock.topOperator
                                                    }
                                                >
                                                    <option value="and">
                                                        AND - all groups must
                                                        pass
                                                    </option>
                                                    <option value="or">
                                                        OR - any group can pass
                                                    </option>
                                                </select>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="unlock-node-operator">
                                                    Completed-node rule
                                                </Label>
                                                <select
                                                    className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                    disabled={
                                                        !form.visual_config
                                                            .unlock.enabled
                                                    }
                                                    id="unlock-node-operator"
                                                    onChange={(event) =>
                                                        setUnlockOperator(
                                                            setForm,
                                                            'nodeOperator',
                                                            event.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    value={
                                                        form.visual_config
                                                            .unlock.nodeOperator
                                                    }
                                                >
                                                    <option value="and">
                                                        All selected nodes
                                                        completed
                                                    </option>
                                                    <option value="or">
                                                        Any selected node
                                                        completed
                                                    </option>
                                                </select>
                                                <select
                                                    className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                    disabled={
                                                        !form.visual_config
                                                            .unlock.enabled
                                                    }
                                                    onChange={(event) => {
                                                        addUnlockRequiredNode(
                                                            setForm,
                                                            event.currentTarget
                                                                .value,
                                                        );
                                                        event.currentTarget.value =
                                                            '';
                                                    }}
                                                    value=""
                                                >
                                                    <option value="">
                                                        Add completed-node
                                                        condition
                                                    </option>
                                                    {map.nodes
                                                        .filter(
                                                            (node) =>
                                                                node.id !==
                                                                selectedNode?.id,
                                                        )
                                                        .map((node) => (
                                                            <option
                                                                disabled={form.visual_config.unlock.requiredNodeIds.includes(
                                                                    node.id.toString(),
                                                                )}
                                                                key={node.id}
                                                                value={node.id}
                                                            >
                                                                {node.title}
                                                            </option>
                                                        ))}
                                                </select>
                                                <div className="flex flex-wrap gap-2">
                                                    {form.visual_config.unlock
                                                        .requiredNodeIds
                                                        .length === 0 ? (
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            No completed-node
                                                            conditions yet.
                                                        </span>
                                                    ) : null}
                                                    {form.visual_config.unlock.requiredNodeIds.map(
                                                        (nodeId) => {
                                                            const node =
                                                                map.nodes.find(
                                                                    (
                                                                        candidate,
                                                                    ) =>
                                                                        candidate.id.toString() ===
                                                                        nodeId,
                                                                );

                                                            return (
                                                                <button
                                                                    className="rounded-full border border-cyan-500/25 bg-cyan-50 px-3 py-1 text-xs text-cyan-800 transition hover:border-cyan-600 dark:border-teal-200/20 dark:bg-teal-200/10 dark:text-teal-100"
                                                                    key={nodeId}
                                                                    onClick={() =>
                                                                        removeUnlockRequiredNode(
                                                                            setForm,
                                                                            nodeId,
                                                                        )
                                                                    }
                                                                    type="button"
                                                                >
                                                                    {node?.title ??
                                                                        `Node ${nodeId}`}
                                                                    {' x'}
                                                                </button>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </div>

                                            <CheckboxField
                                                checked={
                                                    form.visual_config.unlock
                                                        .tool.enabled
                                                }
                                                description="Learners must use the selected tool on this locked node."
                                                id="unlock-tool-enabled"
                                                label="Require tool use"
                                                onCheckedChange={(checked) =>
                                                    setUnlockToolEnabled(
                                                        setForm,
                                                        checked,
                                                    )
                                                }
                                            />
                                            <div className="grid gap-1">
                                                <Label htmlFor="unlock-tool">
                                                    Unlock tool
                                                </Label>
                                                <select
                                                    className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                    disabled={
                                                        !form.visual_config
                                                            .unlock.enabled ||
                                                        !form.visual_config
                                                            .unlock.tool.enabled
                                                    }
                                                    id="unlock-tool"
                                                    onChange={(event) =>
                                                        setUnlockToolId(
                                                            setForm,
                                                            event.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    value={
                                                        form.visual_config
                                                            .unlock.tool.toolId
                                                    }
                                                >
                                                    <option value="">
                                                        Select a tool
                                                    </option>
                                                    {tools.map((tool) => (
                                                        <option
                                                            key={tool.id}
                                                            value={tool.id}
                                                        >
                                                            {tool.title}
                                                        </option>
                                                    ))}
                                                </select>
                                                <InputError
                                                    message={
                                                        errors[
                                                            'visual_config.unlock.tool.toolId'
                                                        ]
                                                    }
                                                />
                                            </div>
                                            <div className="rounded-md border border-amber-500/25 bg-amber-50 p-3 dark:border-amber-300/20 dark:bg-amber-300/10">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="grid gap-1 text-sm">
                                                        <p className="font-medium text-amber-950 dark:text-amber-50">
                                                            Reset learner unlock
                                                            state
                                                        </p>
                                                        <p className="text-xs text-amber-800 dark:text-amber-100/75">
                                                            Lock this node again
                                                            for every learner by
                                                            removing saved
                                                            tool-unlock
                                                            progress.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        className="shrink-0 border-amber-500/40 text-amber-950 hover:bg-amber-100 dark:border-amber-200/35 dark:text-amber-50 dark:hover:bg-amber-200/15"
                                                        disabled={
                                                            !selectedNode ||
                                                            processing
                                                        }
                                                        onClick={
                                                            resetNodeUnlocksForAllUsers
                                                        }
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        <LockKeyhole className="size-4" />
                                                        Lock for all users
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </SettingsAccordionSection>
                            </>
                        ) : null}

                        {activeNodeSettingsSection === 'visuals' ? (
                            <>
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
                            </>
                        ) : null}

                        {activeNodeSettingsSection === 'sounds' ? (
                            <SettingsAccordionSection
                                description="Optional learner-map sounds for pointer and unlock interactions."
                                title="Node sounds"
                            >
                                <div className="grid gap-4">
                                    <NodeSoundTriggerField
                                        description="Played when the pointer enters this tile."
                                        error={
                                            errors[
                                                'visual_config.sounds.mouseEnter.url'
                                            ]
                                        }
                                        id="node-sound-mouse-enter"
                                        label="Mouse enter"
                                        onUpload={(file) =>
                                            void uploadWorldSound(
                                                'nodeSoundMouseEnter',
                                                file,
                                                (url) =>
                                                    setNodeSoundUrl(
                                                        setForm,
                                                        'mouseEnter',
                                                        url,
                                                    ),
                                            )
                                        }
                                        setForm={setForm}
                                        trigger="mouseEnter"
                                        uploadError={
                                            soundUploadErrors.nodeSoundMouseEnter
                                        }
                                        uploading={
                                            uploadingSoundKey ===
                                            'nodeSoundMouseEnter'
                                        }
                                        value={
                                            form.visual_config.sounds.mouseEnter
                                        }
                                    />
                                    <NodeSoundTriggerField
                                        description="Played when learners click or tap this tile."
                                        error={
                                            errors[
                                                'visual_config.sounds.click.url'
                                            ]
                                        }
                                        id="node-sound-click"
                                        label="Click"
                                        onUpload={(file) =>
                                            void uploadWorldSound(
                                                'nodeSoundClick',
                                                file,
                                                (url) =>
                                                    setNodeSoundUrl(
                                                        setForm,
                                                        'click',
                                                        url,
                                                    ),
                                            )
                                        }
                                        setForm={setForm}
                                        trigger="click"
                                        uploadError={
                                            soundUploadErrors.nodeSoundClick
                                        }
                                        uploading={
                                            uploadingSoundKey ===
                                            'nodeSoundClick'
                                        }
                                        value={form.visual_config.sounds.click}
                                    />
                                    <NodeSoundTriggerField
                                        description="Played when the pointer leaves this tile."
                                        error={
                                            errors[
                                                'visual_config.sounds.mouseLeave.url'
                                            ]
                                        }
                                        id="node-sound-mouse-leave"
                                        label="Mouse leave"
                                        onUpload={(file) =>
                                            void uploadWorldSound(
                                                'nodeSoundMouseLeave',
                                                file,
                                                (url) =>
                                                    setNodeSoundUrl(
                                                        setForm,
                                                        'mouseLeave',
                                                        url,
                                                    ),
                                            )
                                        }
                                        setForm={setForm}
                                        trigger="mouseLeave"
                                        uploadError={
                                            soundUploadErrors.nodeSoundMouseLeave
                                        }
                                        uploading={
                                            uploadingSoundKey ===
                                            'nodeSoundMouseLeave'
                                        }
                                        value={
                                            form.visual_config.sounds.mouseLeave
                                        }
                                    />
                                    <NodeSoundTriggerField
                                        description="Played after the backend confirms this node was unlocked."
                                        error={
                                            errors[
                                                'visual_config.sounds.unlock.url'
                                            ]
                                        }
                                        id="node-sound-unlock"
                                        label="Unlock"
                                        onUpload={(file) =>
                                            void uploadWorldSound(
                                                'nodeSoundUnlock',
                                                file,
                                                (url) =>
                                                    setNodeSoundUrl(
                                                        setForm,
                                                        'unlock',
                                                        url,
                                                    ),
                                            )
                                        }
                                        setForm={setForm}
                                        trigger="unlock"
                                        uploadError={
                                            soundUploadErrors.nodeSoundUnlock
                                        }
                                        uploading={
                                            uploadingSoundKey ===
                                            'nodeSoundUnlock'
                                        }
                                        value={form.visual_config.sounds.unlock}
                                    />
                                </div>
                            </SettingsAccordionSection>
                        ) : null}
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

const nodeSettingsSections: {
    description: string;
    icon: LucideIcon;
    key: NodeSettingsSection;
    label: string;
}[] = [
    {
        description: 'Title, slug and description shown in the side panel.',
        icon: PanelRight,
        key: 'right-panel',
        label: 'Right panel',
    },
    {
        description: 'Locking, discovery and tile display text.',
        icon: Eye,
        key: 'availability',
        label: 'Rules',
    },
    {
        description: 'Colors and dark/light tile images.',
        icon: Palette,
        key: 'visuals',
        label: 'Visuals',
    },
    {
        description: 'Mouse and unlock sounds.',
        icon: Volume2,
        key: 'sounds',
        label: 'Sounds',
    },
];

function NodeSettingsSwitcher({
    activeSection,
    onChange,
}: {
    activeSection: NodeSettingsSection;
    onChange: (section: NodeSettingsSection) => void;
}) {
    return (
        <div
            aria-label="Node settings sections"
            className="mx-auto flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white/88 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/82"
            role="tablist"
        >
            {nodeSettingsSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;

                return (
                    <button
                        aria-label={section.label}
                        aria-selected={isActive}
                        className={cn(
                            'group grid size-10 place-items-center rounded-xl text-slate-500 transition focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:text-slate-400 dark:focus-visible:ring-teal-200',
                            isActive
                                ? 'bg-cyan-600 text-white shadow-sm dark:bg-teal-300 dark:text-slate-950'
                                : 'hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white',
                        )}
                        key={section.key}
                        onClick={() => onChange(section.key)}
                        title={`${section.label} - ${section.description}`}
                        type="button"
                    >
                        <Icon className="size-4" />
                    </button>
                );
            })}
        </div>
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
    const isLocked = node?.state === 'locked';
    const imageUrl = typeof visual.imageUrl === 'string' ? visual.imageUrl : '';
    const imageRotation = rotationConfig(visual.imageRotation);
    const imageWidth = percentConfig(visual.imageWidth, 100, 10, 200);
    const imageX = percentConfig(visual.imageX, 50);
    const imageY = percentConfig(visual.imageY, 50);
    const hideImage = visual.hideImage === true;
    const hideLabel = visual.hideLabel === true;
    const hideEmptySpace = isEmptySpace && visual.hideEmptySpace !== false;
    const tileColor =
        withOpacity(
            typeof visual.tileColor === 'string' ? visual.tileColor : '#253047',
            visual.tileOpacity,
        ) ?? '#253047';
    const labelColor =
        withOpacity(
            typeof visual.labelColor === 'string'
                ? visual.labelColor
                : '#ffffff',
            visual.labelOpacity,
        ) ?? '#ffffff';

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
                            background: isEmptySpace ? undefined : tileColor,
                            clipPath:
                                'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                            color: isEmptySpace ? undefined : labelColor,
                        }}
                        type="button"
                    >
                        {imageUrl && !hideImage ? (
                            <span
                                className="absolute inset-[7px] overflow-hidden"
                                style={{
                                    clipPath:
                                        'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                                }}
                            >
                                <img
                                    alt=""
                                    className="absolute inset-0 size-full object-cover"
                                    draggable={false}
                                    src={imageUrl}
                                    style={{
                                        objectPosition: `${imageX}% ${imageY}%`,
                                        transform: `scale(${imageWidth / 100}) rotate(${imageRotation}deg)`,
                                    }}
                                />
                            </span>
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
                        {isLocked ? (
                            <span
                                className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
                                style={{
                                    clipPath:
                                        'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                                }}
                            >
                                <LockKeyhole className="size-10 text-slate-950/42 drop-shadow-[0_2px_10px_rgba(255,255,255,0.55)] dark:text-white/45 dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]" />
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

function MapVisualColorField({
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
    const color = parseEditableCssColor(value);

    return (
        <ColorOpacityField
            colorError={error}
            colorValue={color.hex}
            label={label}
            onColorChange={(nextColor) =>
                onChange(cssColorFromPicker(nextColor, color.opacity))
            }
            onOpacityChange={(nextOpacity) =>
                onChange(
                    color.hex === ''
                        ? value
                        : cssColorFromPicker(color.hex, nextOpacity),
                )
            }
            opacityValue={color.opacity}
        />
    );
}

function NodeSoundTriggerField({
    description,
    error,
    id,
    label,
    onUpload,
    setForm,
    trigger,
    uploadError,
    uploading,
    value,
}: {
    description: string;
    error?: string;
    id: string;
    label: string;
    onUpload: (file: File) => void;
    setForm: Dispatch<SetStateAction<NodeForm>>;
    trigger: keyof NodeSoundFields;
    uploadError?: string;
    uploading: boolean;
    value: NodeSoundTriggerConfig;
}) {
    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/70">
                <Checkbox
                    checked={value.enabled}
                    id={`${id}-enabled`}
                    onCheckedChange={(checked) =>
                        setNodeSoundEnabled(setForm, trigger, checked === true)
                    }
                />
                <div className="grid gap-1">
                    <Label htmlFor={`${id}-enabled`}>
                        Enable {label.toLowerCase()} sound
                    </Label>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>
            </div>
            <SoundAssetInput
                description="Upload a sound file or select one from the reusable sound library."
                id={id}
                label={label}
                onChange={(url) => setNodeSoundUrl(setForm, trigger, url)}
                onUpload={onUpload}
                uploading={uploading}
                value={value.url}
            />
            <InputError message={error ?? uploadError} />
        </div>
    );
}

type NodeVisualColorKey =
    | 'foregroundColor'
    | 'highlightColor'
    | 'labelColor'
    | 'tileColor';

type NodeVisualOpacityKey =
    | 'foregroundOpacity'
    | 'highlightOpacity'
    | 'labelOpacity'
    | 'tileOpacity';

const nodeVisualFields: {
    key: NodeVisualColorKey;
    label: string;
    opacityKey: NodeVisualOpacityKey;
}[] = [
    { key: 'tileColor', label: 'Tile color', opacityKey: 'tileOpacity' },
    {
        key: 'foregroundColor',
        label: 'Icon/text color',
        opacityKey: 'foregroundOpacity',
    },
    { key: 'labelColor', label: 'Label color', opacityKey: 'labelOpacity' },
    {
        key: 'highlightColor',
        label: 'Highlight color',
        opacityKey: 'highlightOpacity',
    },
];

const mapVisualFields: {
    key: keyof Omit<MapVisualThemeFields, 'completedDimOpacity' | 'imageUrl'>;
    label: string;
}[] = [
    { key: 'overlay', label: 'Overlay background' },
    { key: 'pageBackground', label: 'Page background' },
    { key: 'panelBackground', label: 'Top-left panel background' },
    { key: 'panelBorderColor', label: 'Top-left panel border' },
    { key: 'panelTextColor', label: 'Top-left panel text' },
    { key: 'panelMutedTextColor', label: 'Top-left panel muted text' },
    { key: 'accentColor', label: 'Accent color' },
    { key: 'sidePanelBackground', label: 'Node side panel background' },
    { key: 'sidePanelBorderColor', label: 'Node side panel border' },
    { key: 'sidePanelTextColor', label: 'Node side panel text' },
    { key: 'sidePanelMutedTextColor', label: 'Node side panel muted text' },
    { key: 'bottomNavBackground', label: 'Bottom nav background' },
    { key: 'bottomNavBorderColor', label: 'Bottom nav border' },
    { key: 'bottomNavTextColor', label: 'Bottom nav icon/text' },
    {
        key: 'bottomNavActiveBackground',
        label: 'Bottom nav active background',
    },
    { key: 'bottomNavActiveTextColor', label: 'Bottom nav active icon/text' },
    { key: 'sideControlBackground', label: 'Right control background' },
    { key: 'sideControlBorderColor', label: 'Right control border' },
    { key: 'sideControlTextColor', label: 'Right control icon/text' },
    {
        key: 'sideControlActiveBackground',
        label: 'Right control active background',
    },
    {
        key: 'sideControlActiveTextColor',
        label: 'Right control active icon/text',
    },
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
                    <ColorOpacityField
                        colorError={
                            errors[`visual_config.${mode}.${field.key}`]
                        }
                        colorValue={values[field.key]}
                        key={field.key}
                        label={`${labelPrefix} ${field.label}`}
                        onColorChange={(value) =>
                            setVisualThemeTextConfig(
                                setForm,
                                mode,
                                field.key,
                                value,
                            )
                        }
                        onOpacityChange={(value) =>
                            setVisualThemeTextConfig(
                                setForm,
                                mode,
                                field.opacityKey,
                                value,
                            )
                        }
                        opacityError={
                            errors[`visual_config.${mode}.${field.opacityKey}`]
                        }
                        opacityValue={values[field.opacityKey]}
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
            <div className="grid gap-3 sm:grid-cols-4">
                <NodeImageNumberField
                    error={errors[`visual_config.${mode}.imageX`]}
                    id={`node-${mode}-image-x`}
                    label={`${labelPrefix} image X`}
                    max={100}
                    min={0}
                    onChange={(value) =>
                        setVisualThemeTextConfig(setForm, mode, 'imageX', value)
                    }
                    suffix="%"
                    value={values.imageX}
                />
                <NodeImageNumberField
                    error={errors[`visual_config.${mode}.imageY`]}
                    id={`node-${mode}-image-y`}
                    label={`${labelPrefix} image Y`}
                    max={100}
                    min={0}
                    onChange={(value) =>
                        setVisualThemeTextConfig(setForm, mode, 'imageY', value)
                    }
                    suffix="%"
                    value={values.imageY}
                />
                <NodeImageNumberField
                    error={errors[`visual_config.${mode}.imageWidth`]}
                    id={`node-${mode}-image-width`}
                    label={`${labelPrefix} image width`}
                    max={200}
                    min={10}
                    onChange={(value) =>
                        setVisualThemeTextConfig(
                            setForm,
                            mode,
                            'imageWidth',
                            value,
                        )
                    }
                    suffix="%"
                    value={values.imageWidth}
                />
                <NodeImageNumberField
                    error={errors[`visual_config.${mode}.imageRotation`]}
                    id={`node-${mode}-image-rotation`}
                    label={`${labelPrefix} rotation`}
                    max={360}
                    min={-360}
                    onChange={(value) =>
                        setVisualThemeTextConfig(
                            setForm,
                            mode,
                            'imageRotation',
                            value,
                        )
                    }
                    suffix="deg"
                    value={values.imageRotation}
                />
            </div>
        </div>
    );
}

function NodeImageNumberField({
    error,
    id,
    label,
    max,
    min,
    onChange,
    suffix,
    value,
}: {
    error?: string;
    id: string;
    label: string;
    max: number;
    min: number;
    onChange: (value: string) => void;
    suffix: string;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    max={max}
                    min={min}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    step={1}
                    type="number"
                    value={value}
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {suffix}
                </span>
            </div>
            <InputError message={error} />
        </div>
    );
}

function MapVisualModeFields({
    defaultOpen = false,
    errors,
    imageError,
    mode,
    onImageUpload,
    setForm,
    uploadingImage,
    values,
}: {
    defaultOpen?: boolean;
    errors: Record<string, string>;
    imageError?: string;
    mode: ThemeMode;
    onImageUpload: (file: File) => void;
    setForm: Dispatch<SetStateAction<MapVisualForm>>;
    uploadingImage: boolean;
    values: MapVisualThemeFields;
}) {
    const labelPrefix = mode === 'dark' ? 'Dark mode' : 'Light mode';
    const description =
        mode === 'dark'
            ? 'These values are the default map visuals.'
            : 'Empty fields inherit the dark-mode defaults.';

    return (
        <SettingsAccordionSection
            defaultOpen={defaultOpen}
            description={description}
            title={`${labelPrefix} visuals`}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                {mapVisualFields.map((field) => (
                    <MapVisualColorField
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
            <DimmingField
                error={errors[`background_config.${mode}.completedDimOpacity`]}
                label={`${labelPrefix} completed tile dimming`}
                onChange={(value) =>
                    setMapVisualThemeTextConfig(
                        setForm,
                        mode,
                        'completedDimOpacity',
                        value,
                    )
                }
                placeholder={mode === 'light' ? '12' : '18'}
                value={values.completedDimOpacity}
            />
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
        </SettingsAccordionSection>
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

function DimmingField({
    error,
    label,
    onChange,
    placeholder,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    placeholder: string;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');
    const sliderValue = value || placeholder;

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <Input
                    id={id}
                    max="100"
                    min="0"
                    onChange={(event) => onChange(event.currentTarget.value)}
                    placeholder={placeholder}
                    type="number"
                    value={value}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    %
                </span>
            </div>
            <Input
                aria-label={`${label} slider`}
                max="100"
                min="0"
                onChange={(event) => onChange(event.currentTarget.value)}
                type="range"
                value={sliderValue}
            />
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Completed tiles keep their colors and receive only this dim
                overlay.
            </p>
            <InputError message={error} />
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

function setRevealEnabled(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    enabled: boolean,
) {
    setForm((current) => ({
        ...current,
        state: enabled
            ? 'hidden'
            : current.state === 'hidden'
              ? 'available'
              : current.state,
        visual_config: {
            ...current.visual_config,
            hideEmptySpace: enabled
                ? true
                : current.visual_config.hideEmptySpace,
            reveal: {
                ...current.visual_config.reveal,
                enabled,
            },
        },
    }));
}

function setRevealToolId(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    toolId: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            reveal: {
                ...current.visual_config.reveal,
                toolId,
            },
        },
    }));
}

function setUnlockEnabled(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    enabled: boolean,
) {
    setForm((current) => ({
        ...current,
        state: enabled
            ? 'locked'
            : current.state === 'locked'
              ? 'available'
              : current.state,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                enabled,
            },
        },
    }));
}

function setUnlockOperator(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    key: 'nodeOperator' | 'topOperator',
    value: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                [key]: value === 'or' ? 'or' : 'and',
            },
        },
    }));
}

function addUnlockRequiredNode(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    nodeId: string,
) {
    if (!nodeId) {
        return;
    }

    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                requiredNodeIds:
                    current.visual_config.unlock.requiredNodeIds.includes(
                        nodeId,
                    )
                        ? current.visual_config.unlock.requiredNodeIds
                        : [
                              ...current.visual_config.unlock.requiredNodeIds,
                              nodeId,
                          ],
            },
        },
    }));
}

function removeUnlockRequiredNode(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    nodeId: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                requiredNodeIds:
                    current.visual_config.unlock.requiredNodeIds.filter(
                        (currentNodeId) => currentNodeId !== nodeId,
                    ),
            },
        },
    }));
}

function setUnlockToolEnabled(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    enabled: boolean,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                tool: {
                    ...current.visual_config.unlock.tool,
                    enabled,
                },
            },
        },
    }));
}

function setUnlockToolId(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    toolId: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                tool: {
                    ...current.visual_config.unlock.tool,
                    toolId,
                },
            },
        },
    }));
}

function setLockedState(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    locked: boolean,
) {
    setForm((current) => ({
        ...current,
        state: locked ? 'locked' : 'available',
    }));
}

function setNodeSoundEnabled(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    trigger: keyof NodeSoundFields,
    enabled: boolean,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            sounds: {
                ...current.visual_config.sounds,
                [trigger]: {
                    ...current.visual_config.sounds[trigger],
                    enabled,
                },
            },
        },
    }));
}

function setNodeSoundUrl(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    trigger: keyof NodeSoundFields,
    url: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            sounds: {
                ...current.visual_config.sounds,
                [trigger]: {
                    ...current.visual_config.sounds[trigger],
                    url,
                },
            },
        },
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
            foregroundOpacity: '100',
            highlightColor: '#2563eb',
            highlightOpacity: '100',
            imageRotation: '0',
            imageUrl: '',
            imageWidth: '100',
            imageX: '50',
            imageY: '50',
            labelColor: '#0f172a',
            labelOpacity: '100',
            tileColor: '#dbeafe',
            tileOpacity: '100',
        };
    }

    return {
        foregroundColor: '#bfdbfe',
        foregroundOpacity: '100',
        highlightColor: '#7dd3fc',
        highlightOpacity: '100',
        imageRotation: '0',
        imageUrl: '',
        imageWidth: '100',
        imageX: '50',
        imageY: '50',
        labelColor: '#ffffff',
        labelOpacity: '100',
        tileColor: '#253047',
        tileOpacity: '100',
    };
}

function emptyNodeVisualThemeFields(): NodeVisualThemeFields {
    return {
        foregroundColor: '',
        foregroundOpacity: '',
        highlightColor: '',
        highlightOpacity: '',
        imageRotation: '0',
        imageUrl: '',
        imageWidth: '100',
        imageX: '50',
        imageY: '50',
        labelColor: '',
        labelOpacity: '',
        tileColor: '',
        tileOpacity: '',
    };
}

function emptyNodeSoundFields(): NodeSoundFields {
    return {
        click: emptyNodeSoundTrigger(),
        mouseEnter: emptyNodeSoundTrigger(),
        mouseLeave: emptyNodeSoundTrigger(),
        unlock: emptyNodeSoundTrigger(),
    };
}

function emptyNodeSoundTrigger(): NodeSoundTriggerConfig {
    return {
        enabled: false,
        url: '',
    };
}

function emptyMapVisualThemeFields(): MapVisualThemeFields {
    return {
        accentColor: '',
        bottomNavActiveBackground: '',
        bottomNavActiveTextColor: '',
        bottomNavBackground: '',
        bottomNavBorderColor: '',
        bottomNavTextColor: '',
        completedDimOpacity: '',
        imageUrl: '',
        overlay: '',
        pageBackground: '',
        panelBackground: '',
        panelBorderColor: '',
        panelMutedTextColor: '',
        panelTextColor: '',
        sideControlActiveBackground: '',
        sideControlActiveTextColor: '',
        sideControlBackground: '',
        sideControlBorderColor: '',
        sideControlTextColor: '',
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
            reveal: {
                enabled: false,
                toolId: '',
            },
            sounds: emptyNodeSoundFields(),
            unlock: emptyUnlockConfig(),
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
                foregroundOpacity: '100',
                highlightColor: '#94a3b8',
                highlightOpacity: '100',
                imageRotation: '0',
                imageUrl: '',
                imageWidth: '100',
                imageX: '50',
                imageY: '50',
                labelColor: '#64748b',
                labelOpacity: '100',
                tileColor: '#f8fafc',
                tileOpacity: '100',
            },
            label: '',
            hideEmptySpace: true,
            hideImage: false,
            hideLabel: true,
            light: {
                foregroundColor: '#94a3b8',
                foregroundOpacity: '100',
                highlightColor: '#94a3b8',
                highlightOpacity: '100',
                imageRotation: '0',
                imageUrl: '',
                imageWidth: '100',
                imageX: '50',
                imageY: '50',
                labelColor: '#64748b',
                labelOpacity: '100',
                tileColor: '#f8fafc',
                tileOpacity: '100',
            },
            reveal: {
                enabled: false,
                toolId: '',
            },
            sounds: emptyNodeSoundFields(),
            unlock: emptyUnlockConfig(),
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
            dark: nodeVisualThemeFieldsFromConfig(
                node.visualConfig.dark,
                defaultNodeVisualThemeFields('dark'),
            ),
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
            reveal: revealConfigFromNode(node.visualConfig.reveal),
            sounds: nodeSoundFieldsFromConfig(node.visualConfig.sounds),
            tooltip: stringConfig(node.visualConfig.tooltip, ''),
            unlock: unlockConfigFromNode(node.visualConfig.unlock),
        },
    };
}

function revealConfigFromNode(config: VisualConfigValue): {
    enabled: boolean;
    toolId: string;
} {
    const reveal = isVisualConfig(config) ? config : {};

    return {
        enabled: booleanConfig(reveal.enabled, false),
        toolId: inputStringConfig(reveal.toolId, ''),
    };
}

function nodeSoundFieldsFromConfig(config: VisualConfigValue): NodeSoundFields {
    const sounds = isVisualConfig(config) ? config : {};

    return {
        click: nodeSoundTriggerFromConfig(sounds.click),
        mouseEnter: nodeSoundTriggerFromConfig(sounds.mouseEnter),
        mouseLeave: nodeSoundTriggerFromConfig(sounds.mouseLeave),
        unlock: nodeSoundTriggerFromConfig(sounds.unlock),
    };
}

function nodeSoundTriggerFromConfig(
    config: VisualConfigValue,
): NodeSoundTriggerConfig {
    const trigger = isVisualConfig(config) ? config : {};

    return {
        enabled: booleanConfig(trigger.enabled, false),
        url: stringConfig(trigger.url, ''),
    };
}

function emptyUnlockConfig(): NodeForm['visual_config']['unlock'] {
    return {
        enabled: false,
        nodeOperator: 'and',
        requiredNodeIds: [],
        tool: {
            enabled: false,
            toolId: '',
        },
        topOperator: 'and',
    };
}

function unlockConfigFromNode(
    config: VisualConfigValue,
): NodeForm['visual_config']['unlock'] {
    const unlock = isVisualConfig(config) ? config : {};
    const tool = isVisualConfig(unlock.tool) ? unlock.tool : {};
    const requiredNodeIds = Array.isArray(unlock.requiredNodeIds)
        ? unlock.requiredNodeIds
              .map((value: VisualConfigValue) => inputStringConfig(value, ''))
              .filter(Boolean)
        : [];

    return {
        enabled: booleanConfig(unlock.enabled, false),
        nodeOperator:
            stringConfig(unlock.nodeOperator, 'and') === 'or' ? 'or' : 'and',
        requiredNodeIds,
        tool: {
            enabled: booleanConfig(tool.enabled, false),
            toolId: inputStringConfig(tool.toolId, ''),
        },
        topOperator:
            stringConfig(unlock.topOperator, 'and') === 'or' ? 'or' : 'and',
    };
}

function mapVisualFormFromConfig(config: MapVisualConfig): MapVisualForm {
    return {
        dark: mapVisualThemeFieldsFromConfig(config.dark),
        light: mapVisualThemeFieldsFromConfig(config.light),
    };
}

function mapVisualPayload(form: MapVisualForm): MapVisualConfig {
    return {
        dark: form.dark,
        light: form.light,
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
        foregroundOpacity: stringConfig(
            themeConfig.foregroundOpacity,
            fallback.foregroundOpacity,
        ),
        highlightColor: stringConfig(
            themeConfig.highlightColor,
            fallback.highlightColor,
        ),
        highlightOpacity: stringConfig(
            themeConfig.highlightOpacity,
            fallback.highlightOpacity,
        ),
        imageRotation: stringConfig(
            themeConfig.imageRotation,
            fallback.imageRotation,
        ),
        imageUrl: stringConfig(themeConfig.imageUrl, fallback.imageUrl),
        imageWidth: inputStringConfig(
            themeConfig.imageWidth,
            fallback.imageWidth,
        ),
        imageX: inputStringConfig(themeConfig.imageX, fallback.imageX),
        imageY: inputStringConfig(themeConfig.imageY, fallback.imageY),
        labelColor: stringConfig(themeConfig.labelColor, fallback.labelColor),
        labelOpacity: stringConfig(
            themeConfig.labelOpacity,
            fallback.labelOpacity,
        ),
        tileColor: stringConfig(themeConfig.tileColor, fallback.tileColor),
        tileOpacity: stringConfig(
            themeConfig.tileOpacity,
            fallback.tileOpacity,
        ),
    };
}

function mapVisualThemeFieldsFromConfig(
    config: Partial<MapVisualThemeFields> | undefined,
    fallback: MapVisualThemeFields = emptyMapVisualThemeFields(),
): MapVisualThemeFields {
    return {
        ...fallback,
        accentColor: stringConfig(config?.accentColor, fallback.accentColor),
        bottomNavActiveBackground: stringConfig(
            config?.bottomNavActiveBackground,
            fallback.bottomNavActiveBackground,
        ),
        bottomNavActiveTextColor: stringConfig(
            config?.bottomNavActiveTextColor,
            fallback.bottomNavActiveTextColor,
        ),
        bottomNavBackground: stringConfig(
            config?.bottomNavBackground,
            fallback.bottomNavBackground,
        ),
        bottomNavBorderColor: stringConfig(
            config?.bottomNavBorderColor,
            fallback.bottomNavBorderColor,
        ),
        bottomNavTextColor: stringConfig(
            config?.bottomNavTextColor,
            fallback.bottomNavTextColor,
        ),
        completedDimOpacity: inputStringConfig(
            config?.completedDimOpacity,
            fallback.completedDimOpacity,
        ),
        imageUrl: stringConfig(config?.imageUrl, fallback.imageUrl),
        overlay: stringConfig(config?.overlay, fallback.overlay),
        pageBackground: stringConfig(
            config?.pageBackground,
            fallback.pageBackground,
        ),
        panelBackground: stringConfig(
            config?.panelBackground,
            fallback.panelBackground,
        ),
        panelBorderColor: stringConfig(
            config?.panelBorderColor,
            fallback.panelBorderColor,
        ),
        panelMutedTextColor: stringConfig(
            config?.panelMutedTextColor,
            fallback.panelMutedTextColor,
        ),
        panelTextColor: stringConfig(
            config?.panelTextColor,
            fallback.panelTextColor,
        ),
        sideControlActiveBackground: stringConfig(
            config?.sideControlActiveBackground,
            fallback.sideControlActiveBackground,
        ),
        sideControlActiveTextColor: stringConfig(
            config?.sideControlActiveTextColor,
            fallback.sideControlActiveTextColor,
        ),
        sideControlBackground: stringConfig(
            config?.sideControlBackground,
            fallback.sideControlBackground,
        ),
        sideControlBorderColor: stringConfig(
            config?.sideControlBorderColor,
            fallback.sideControlBorderColor,
        ),
        sideControlTextColor: stringConfig(
            config?.sideControlTextColor,
            fallback.sideControlTextColor,
        ),
        sidePanelBackground: stringConfig(
            config?.sidePanelBackground,
            fallback.sidePanelBackground,
        ),
        sidePanelBorderColor: stringConfig(
            config?.sidePanelBorderColor,
            fallback.sidePanelBorderColor,
        ),
        sidePanelMutedTextColor: stringConfig(
            config?.sidePanelMutedTextColor,
            fallback.sidePanelMutedTextColor,
        ),
        sidePanelTextColor: stringConfig(
            config?.sidePanelTextColor,
            fallback.sidePanelTextColor,
        ),
    };
}

function parseEditableCssColor(value: string): {
    hex: string;
    opacity: string;
} {
    const trimmedValue = value.trim();

    if (trimmedValue === '') {
        return {
            hex: '',
            opacity: '100',
        };
    }

    if (isHexColor(trimmedValue)) {
        return {
            hex: trimmedValue,
            opacity: '100',
        };
    }

    const rgbaMatch = trimmedValue.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+)\s*)?\)$/i,
    );

    if (!rgbaMatch) {
        return {
            hex: '#000000',
            opacity: '100',
        };
    }

    const red = clampColorChannel(Number(rgbaMatch[1]));
    const green = clampColorChannel(Number(rgbaMatch[2]));
    const blue = clampColorChannel(Number(rgbaMatch[3]));
    const alpha = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);

    return {
        hex: rgbToHex(red, green, blue),
        opacity: Math.round(Math.min(1, Math.max(0, alpha)) * 100).toString(),
    };
}

function cssColorFromPicker(hexColor: string, opacity: string): string {
    const safeHex = isHexColor(hexColor) ? hexColor : '#000000';
    const numericOpacity = percentConfig(opacity, 100);

    if (numericOpacity >= 100) {
        return safeHex;
    }

    const red = Number.parseInt(safeHex.slice(1, 3), 16);
    const green = Number.parseInt(safeHex.slice(3, 5), 16);
    const blue = Number.parseInt(safeHex.slice(5, 7), 16);
    const alpha = Number((numericOpacity / 100).toFixed(2));

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clampColorChannel(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(255, Math.max(0, Math.round(value)));
}

function rgbToHex(red: number, green: number, blue: number): string {
    return `#${[red, green, blue]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')}`;
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

function rotationConfig(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    const numeric = Number.isFinite(parsed) ? parsed : 0;

    return Math.min(360, Math.max(-360, numeric));
}

function percentConfig(
    value: unknown,
    fallback: number,
    min = 0,
    max = 100,
): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    const numeric = Number.isFinite(parsed) ? parsed : fallback;

    return Math.min(max, Math.max(min, numeric));
}

function inputStringConfig(value: unknown, fallback: string) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toString();
    }

    return stringConfig(value, fallback);
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
            reveal: {
                ...form.visual_config.reveal,
                ...override.visual_config?.reveal,
            },
            sounds: {
                ...form.visual_config.sounds,
                ...override.visual_config?.sounds,
                click: {
                    ...form.visual_config.sounds.click,
                    ...override.visual_config?.sounds?.click,
                },
                mouseEnter: {
                    ...form.visual_config.sounds.mouseEnter,
                    ...override.visual_config?.sounds?.mouseEnter,
                },
                mouseLeave: {
                    ...form.visual_config.sounds.mouseLeave,
                    ...override.visual_config?.sounds?.mouseLeave,
                },
                unlock: {
                    ...form.visual_config.sounds.unlock,
                    ...override.visual_config?.sounds?.unlock,
                },
            },
            unlock: {
                ...form.visual_config.unlock,
                ...override.visual_config?.unlock,
                tool: {
                    ...form.visual_config.unlock.tool,
                    ...override.visual_config?.unlock?.tool,
                },
            },
        },
    };
}

function nodePayload(form: NodeForm): NodeForm {
    const rules = buildUnlockRules(form.visual_config.unlock);

    return {
        ...form,
        visual_config: {
            ...form.visual_config,
            unlock: {
                ...form.visual_config.unlock,
                rules,
            },
        },
    };
}

function buildUnlockRules(
    unlock: NodeForm['visual_config']['unlock'],
): UnlockRule | undefined {
    const rules: UnlockRule[] = [];
    const nodeRules = unlock.requiredNodeIds
        .map((nodeId) => Number(nodeId))
        .filter((nodeId) => Number.isFinite(nodeId) && nodeId > 0)
        .map<UnlockRule>((nodeId) => ({
            nodeId,
            type: 'node_completed',
        }));

    if (nodeRules.length > 0) {
        rules.push({
            operator: unlock.nodeOperator,
            rules: nodeRules,
            type: 'group',
        });
    }

    if (unlock.tool.enabled && unlock.tool.toolId) {
        rules.push({
            type: 'tool_used',
        });
    }

    if (!unlock.enabled || rules.length === 0) {
        return undefined;
    }

    if (rules.length === 1) {
        return rules[0];
    }

    return {
        operator: unlock.topOperator,
        rules,
        type: 'group',
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
