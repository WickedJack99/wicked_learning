import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronRight,
    Eye,
    GitBranch,
    Image,
    Layers3,
    LockKeyhole,
    Map as MapIcon,
    Palette,
    PanelRight,
    Save,
    SlidersHorizontal,
    Trash2,
    Type,
    Volume2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type {
    CSSProperties,
    Dispatch,
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent,
    SetStateAction,
} from 'react';
import { ColorOpacityField, isHexColor } from '@/components/color-input';
import { ConfigModeSwitch } from '@/components/config-mode-switch';
import InputError from '@/components/input-error';
import { SettingsConfigurationDialog } from '@/components/settings-configuration-dialog';
import { SettingsConfigurationSection } from '@/components/settings-configuration-section';
import {
    SettingsConfigurationLayout,
    SettingsContentPane,
    SettingsSectionButton,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
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
import { ContentAuthoringDialog } from '@/features/ai/content-authoring-dialog';
import type { ContentAuthoringTemplate } from '@/features/ai/content-authoring-dialog';
import {
    assetForm,
    assetPayload,
    MapAssetEditor,
    MapAssetFields,
} from '@/features/settings/map-asset-editor';
import type { AssetForm } from '@/features/settings/map-asset-editor';
import { ImageAlphaHitArea } from '@/features/world/image-alpha-mask';
import { MapAssetVisual } from '@/features/world/map-asset-visual';
import { resolveThemeVariant, withOpacity } from '@/features/world/theme';
import { useAppearance } from '@/hooks/use-appearance';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { uploadMediaFile } from '@/lib/media-upload';
import { cn } from '@/lib/utils';
import { getSettingsPresentationStyle } from '@/theme/presentation';
import type { LearningTool } from '@/types';
import type { MapAsset } from '@/types/learning';
import { ConfigImageInput as NodeImageInput } from './activity-config-fields';
import type { EditableItem } from './edit-node-activity-types';

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
    unlockDiagnostics?: {
        id: number;
        title: string;
    }[];
    visualConfig: VisualConfig;
};

type EditableMap = {
    accessRoles: string[];
    backgroundConfig: MapVisualConfig;
    description: string | null;
    editingGroupIds: number[];
    gridConfig: {
        gap?: number;
        tileHeight?: number;
        tileWidth?: number;
    };
    id: number;
    mapAssets: MapAsset[];
    mapAssetsLocked: boolean;
    nodeCount: number;
    nodes: EditableNode[];
    slug: string;
    topicId: number | null;
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
    borderColor: string;
    borderOpacity: string;
    foregroundColor: string;
    foregroundOpacity: string;
    highlightColor: string;
    highlightOpacity: string;
    highlightBorderColor: string;
    highlightBorderOpacity: string;
    highlightedLabelColor: string;
    highlightedLabelOpacity: string;
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
          type: 'time_after';
      }
    | {
          operator: 'and' | 'or';
          rules: UnlockRule[];
          type: 'group';
      }
    | {
          type: 'tool_used';
      }
    | {
          roleSlug: string;
          type: 'role_has';
      }
    | {
          itemId: number;
          type: 'item_owned';
      };

type MapVisualThemeFields = {
    accentColor: string;
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
    sidePanelHeadingColor: string;
    sidePanelMutedTextColor: string;
    sidePanelTextColor: string;
};

type MapVisualConfig = {
    dark?: Partial<MapVisualThemeFields>;
    light?: Partial<MapVisualThemeFields>;
};

export type EditableMapPayload = {
    map: EditableMap;
    world: EditableWorld;
};

export type AccessRoleOption = {
    name: string;
    slug: string;
};

export type AccessGroup = {
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
        schedule: {
            lockAt: string;
            unlockAt: string;
        };
        sounds: NodeSoundFields;
        tooltip: string;
        unlock: {
            enabled: boolean;
            nodeOperator: 'and' | 'or';
            requiredNodeIds: string[];
            item: {
                enabled: boolean;
                itemId: string;
            };
            tool: {
                enabled: boolean;
                toolId: string;
            };
            topOperator: 'and' | 'or';
            roleSlug: string;
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
    | 'surface'
    | 'activities'
    | 'tile-text'
    | 'right-panel'
    | 'availability'
    | 'visuals'
    | 'highlight-image'
    | 'sounds'
    | 'danger';

export default function EditWorldMap({
    accessGroups,
    contentAuthoringTemplates,
    editableMap,
    embedded = false,
    items,
    roleOptions,
    tools,
}: {
    accessGroups: AccessGroup[];
    contentAuthoringTemplates?: ContentAuthoringTemplate[];
    embedded?: boolean;
    editableMap: EditableMapPayload;
    items: EditableItem[];
    roleOptions: AccessRoleOption[];
    tools: LearningTool[];
}) {
    const { map, world } = editableMap;
    const t = usePlatformTranslation();
    const { props } = usePage();
    const { resolvedAppearance } = useAppearance();
    const settingsPresentationStyle = getSettingsPresentationStyle(
        props.publicPresentation,
        resolvedAppearance,
    );
    const previewMapTheme = resolveThemeVariant<Partial<MapVisualThemeFields>>(
        map.backgroundConfig,
        resolvedAppearance,
    );
    const nodeDialogThemeStyle = {
        '--settings-accent': previewMapTheme.accentColor || '#2dd4bf',
        '--settings-accent-foreground': '#020617',
    } as CSSProperties;
    const nodeDialogStyle = {
        ...(embedded ? settingsPresentationStyle : {}),
        ...(!embedded ? nodeDialogThemeStyle : {}),
        ...(embedded
            ? {
                  bottom: 0,
                  height: 'auto',
                  left: '51rem',
                  maxHeight: 'none',
                  maxWidth: 'none',
                  right: 0,
                  top: '4rem',
                  translate: 'none',
                  transform: 'none',
                  width: 'auto',
                  background: 'var(--settings-panel-background)',
                  '--settings-nested-sidebar-background':
                      'var(--settings-panel-background)',
              }
            : {}),
    } as CSSProperties;
    const [selectedNode, setSelectedNode] = useState<EditableNode | null>(null);
    const [selectedMapAsset, setSelectedMapAsset] = useState<MapAsset | null>(
        null,
    );
    const [, setSelectedCell] = useState<GridCell | null>(null);
    const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [pendingDeleteNode, setPendingDeleteNode] =
        useState<EditableNode | null>(null);
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
    const [nodeVisualMode, setNodeVisualMode] = useState<ThemeMode>('dark');
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
    const [mapAssetForm, setMapAssetForm] = useState<AssetForm>(() =>
        assetForm(null),
    );
    const [mapAssetPreviewState, setMapAssetPreviewState] = useState<
        'first' | 'second'
    >('first');
    const [insertionContext, setInsertionContext] =
        useState<InsertionContext | null>(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDraggingSurface, setIsDraggingSurface] = useState(false);
    const suppressClickRef = useRef(false);
    const closeNodeDialogTimeoutRef = useRef<number | null>(null);
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
    const dialogOpen = nodeDialogOpen;
    const hasMapDetailsChanges = useDirtyState(mapDetailsForm, {
        description: map.description ?? '',
        title: map.title,
    });
    const hasMapVisualChanges = useDirtyState(
        mapVisualForm,
        mapVisualFormFromConfig(map.backgroundConfig),
    );
    const hasMapAccessChanges = useDirtyState(
        mapAccessRoles,
        map.accessRoles.length > 0 ? map.accessRoles : ['user', 'admin'],
    );

    const livePreviewNode = selectedNode
        ? {
              id: selectedNode.id,
              label: form.visual_config.label,
              title: form.title,
              visualConfig: form.visual_config[
                  nodeVisualMode
              ] as unknown as Record<string, unknown>,
          }
        : undefined;
    const livePreviewAsset = selectedMapAsset
        ? {
              ...selectedMapAsset,
              focusable: mapAssetForm.interaction_mode === 'focusable',
              imageUrl: mapAssetForm.image_url || null,
              interactionConfig: {
                  states: {
                      first: {
                          imageUrl:
                              mapAssetForm.interaction_states.first.image_url ||
                              null,
                          width: Number(
                              mapAssetForm.interaction_states.first.width,
                          ),
                          x: Number(
                              mapAssetForm.interaction_states.first.position_x,
                          ),
                          y: Number(
                              mapAssetForm.interaction_states.first.position_y,
                          ),
                      },
                      second: {
                          imageUrl:
                              mapAssetForm.interaction_states.second
                                  .image_url || null,
                          width: Number(
                              mapAssetForm.interaction_states.second.width,
                          ),
                          x: Number(
                              mapAssetForm.interaction_states.second.position_x,
                          ),
                          y: Number(
                              mapAssetForm.interaction_states.second.position_y,
                          ),
                      },
                  },
              },
              interactionMode: mapAssetForm.interaction_mode,
              locked: mapAssetForm.locked,
              nodeId: selectedNode?.id ?? selectedMapAsset.nodeId,
              opacity: Number(mapAssetForm.opacity),
              text: mapAssetForm.text || null,
              width: Number(mapAssetForm.width),
              x: Number(mapAssetForm.position_x),
              y: Number(mapAssetForm.position_y),
              z: Number(mapAssetForm.position_z),
              visualConfig:
                  Object.keys(mapAssetForm.visual_config ?? {}).length > 0
                      ? mapAssetForm.visual_config
                      : form.visual_config,
          }
        : undefined;
    const highlightImageConfig = mapAssetHighlightImageConfig(
        mapAssetForm,
        nodeVisualMode,
    );

    const openCreateTile = (cell: GridCell) => {
        if (consumeSuppressedClick()) {
            return;
        }

        clearPendingNodeDialogReset(closeNodeDialogTimeoutRef);
        setSelectedNode(null);
        setSelectedMapAsset(null);
        setMapAssetForm(assetForm(null));
        setSelectedCell(cell);
        setNodeDialogOpen(true);
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

        clearPendingNodeDialogReset(closeNodeDialogTimeoutRef);
        const position = {
            q: node.position.q + direction.q,
            r: node.position.r + direction.r,
        };
        const { x, y } = axialToPoint(position.q, position.r);

        setSelectedNode(null);
        setSelectedMapAsset(null);
        setMapAssetForm(assetForm(null));
        setSelectedCell({
            occupiedNode: null,
            q: position.q,
            r: position.r,
            x,
            y,
        });
        setNodeDialogOpen(true);
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

    const openEditTile = (node: EditableNode, mapAsset?: MapAsset) => {
        if (consumeSuppressedClick()) {
            return;
        }

        clearPendingNodeDialogReset(closeNodeDialogTimeoutRef);
        setSelectedNode(node);
        setSelectedMapAsset(mapAsset ?? null);
        setMapAssetForm(assetForm(mapAsset ?? null));
        setMapAssetPreviewState('first');
        setSelectedCell(null);
        setNodeDialogOpen(true);
        setInsertionContext(null);
        setErrors({});
        setImageUploadErrors({});
        setSoundUploadErrors({});
        setActiveNodeSettingsSection(mapAsset ? 'surface' : 'activities');
        setForm(nodeFormFromNode(node));
    };

    const openEditMapAsset = (mapAsset: MapAsset) => {
        if (mapAsset.nodeId) {
            const node = map.nodes.find(
                (candidate) => candidate.id === mapAsset.nodeId,
            );

            if (node) {
                openEditTile(node, mapAsset);

                return;
            }
        }

        clearPendingNodeDialogReset(closeNodeDialogTimeoutRef);
        setSelectedNode(null);
        setSelectedMapAsset(mapAsset);
        setSelectedCell(null);
        setNodeDialogOpen(true);
        setInsertionContext(null);
        setErrors({});
        setImageUploadErrors({});
        setSoundUploadErrors({});
        setActiveNodeSettingsSection('surface');
        setMapAssetForm(assetForm(mapAsset));
        setMapAssetPreviewState('first');
        setForm(nodeFormFromMapAsset(mapAsset));
    };

    const closeDialog = () => {
        setNodeDialogOpen(false);
        clearPendingNodeDialogReset(closeNodeDialogTimeoutRef);
        closeNodeDialogTimeoutRef.current = window.setTimeout(() => {
            setSelectedCell(null);
            setSelectedNode(null);
            setSelectedMapAsset(null);
            setMapAssetForm(assetForm(null));
            setInsertionContext(null);
            closeNodeDialogTimeoutRef.current = null;
        }, 220);
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

    const saveMapAsset = () => {
        if (!selectedMapAsset) {
            saveNode();

            return;
        }

        setProcessing(true);
        const payload = assetPayload({
            ...mapAssetForm,
            visual_config: selectedNode
                ? mapAssetForm.visual_config
                : form.visual_config,
        });
        router.patch(
            `/settings/worlds/assets/${selectedMapAsset.id}`,
            payload,
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => {
                    if (selectedNode) {
                        saveNode();
                    } else {
                        closeDialog();
                    }
                },
                onFinish: () => setProcessing(false),
            },
        );
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

    const deleteSelectedNode = () => {
        if (!pendingDeleteNode) {
            return;
        }

        setProcessing(true);

        router.delete(`/settings/worlds/nodes/${pendingDeleteNode.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setPendingDeleteNode(null);
                closeDialog();
            },
            onFinish: () => setProcessing(false),
        });
    };

    const saveMapVisuals = () => {
        if (!hasMapVisualChanges) {
            return;
        }

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
        if (!hasMapDetailsChanges) {
            return;
        }

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
        if (!hasMapAccessChanges) {
            return;
        }

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
        setUploadingImageKey(key);
        setImageUploadErrors((current) => ({ ...current, [key]: '' }));

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/worlds/node-images',
                errorMessage: 'The image could not be uploaded.',
                fields: { map_id: map.id },
                fieldName: 'image',
                file,
            });
            onUploaded(payload.url);
        } catch (error) {
            setImageUploadErrors((current) => ({
                ...current,
                [key]:
                    error instanceof Error
                        ? error.message
                        : 'The image could not be uploaded.',
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
        setUploadingSoundKey(key);
        setSoundUploadErrors((current) => ({ ...current, [key]: '' }));

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/assets/sound-media',
                errorMessage: 'The sound could not be uploaded.',
                file,
            });
            onUploaded(payload.url);
        } catch (error) {
            setSoundUploadErrors((current) => ({
                ...current,
                [key]:
                    error instanceof Error
                        ? error.message
                        : 'The sound could not be uploaded.',
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
            {!embedded ? <Head title={`Edit ${map.title}`} /> : null}
            <main
                className={cn(
                    'h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100',
                    embedded &&
                        'bg-transparent text-inherit dark:bg-transparent',
                )}
            >
                <div
                    className={cn(
                        'flex h-full flex-col px-4 pt-4 pb-24',
                        embedded && 'p-0',
                    )}
                >
                    <header
                        className={cn(
                            'mb-3 flex shrink-0 items-center justify-between gap-4 select-none',
                            embedded && 'hidden',
                        )}
                    >
                        <div className="min-w-0">
                            <Button
                                asChild
                                className="mb-2"
                                size="sm"
                                variant="ghost"
                            >
                                <Link href="/settings?panel=admin-world-builder">
                                    <ArrowLeft className="size-4" />
                                    World graph
                                </Link>
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                {world.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-3">
                                <h1 className="truncate text-2xl font-semibold tracking-normal">
                                    Edit {map.title}
                                </h1>
                                <Button
                                    asChild
                                    className="border-[color-mix(in_srgb,var(--settings-accent)_34%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_8%,transparent)] text-[var(--settings-accent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_16%,transparent)]"
                                    size="sm"
                                    variant="outline"
                                >
                                    <Link
                                        href={`/settings?panel=admin-world-builder&map=${map.id}&worldView=configure`}
                                    >
                                        <SlidersHorizontal className="size-4" />
                                        Map configuration
                                    </Link>
                                </Button>
                            </div>
                        </div>
                        <p className="hidden max-w-2xl text-sm leading-6 text-slate-600 md:block dark:text-slate-300">
                            Place MapAssets on the surface and edit their
                            position and visual settings from the in-map menu.
                        </p>
                    </header>

                    <MapAssetEditor
                        appearance={resolvedAppearance}
                        assets={map.mapAssets}
                        mapId={map.id}
                        mapLocked={map.mapAssetsLocked}
                        nodes={map.nodes.map((node) => ({
                            id: node.id,
                            label:
                                typeof node.visualConfig.label === 'string'
                                    ? node.visualConfig.label
                                    : undefined,
                            title: node.title,
                            visualConfig: resolveThemeVariant(
                                node.visualConfig,
                                resolvedAppearance,
                            ) as Record<string, unknown>,
                        }))}
                        onSelectAsset={openEditMapAsset}
                        previewAsset={livePreviewAsset}
                        previewSecondState={mapAssetPreviewState === 'second'}
                        previewNode={livePreviewNode}
                        previewImage={previewMapTheme.imageUrl}
                        previewOverlay={previewMapTheme.overlay}
                        toolbarAction={
                            contentAuthoringTemplates ? (
                                <ContentAuthoringDialog
                                    mapId={map.id}
                                    mapTitle={map.title}
                                    templates={contentAuthoringTemplates}
                                />
                            ) : undefined
                        }
                    />

                    <section
                        className={cn(
                            'relative hidden min-h-0 flex-1 touch-none overflow-hidden bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--settings-accent)_14%,transparent),rgba(255,255,255,0.88)_64%)] select-none dark:bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--settings-accent)_16%,transparent),rgba(17,24,32,0.94)_66%)]',
                            !embedded &&
                                'rounded-[2rem] border border-slate-200 shadow-2xl dark:border-white/10',
                        )}
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
                                            'var(--settings-accent)',
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
                                <div className="max-w-sm rounded-xl border border-dashed border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-white/86 p-4 text-center text-sm shadow-lg backdrop-blur dark:bg-slate-950/72">
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
                                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-xs transition focus-visible:border-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] focus-visible:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
                                id="map-description"
                                onChange={(event) => {
                                    const description =
                                        event.currentTarget.value;

                                    setMapDetailsForm((current) => ({
                                        ...current,
                                        description,
                                    }));
                                }}
                                value={mapDetailsForm.description}
                            />
                            <InputError
                                message={mapDetailsErrors.description}
                            />
                        </div>
                    </div>

                    <DialogFooter
                        className={cn(
                            embedded &&
                                'shrink-0 border-t border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] px-5 py-4',
                        )}
                    >
                        <Button
                            onClick={() => setMapDetailsOpen(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={processing || !hasMapDetailsChanges}
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
                <SettingsConfigurationDialog className="overflow-y-auto">
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

                    <DialogFooter
                        className={cn(
                            embedded &&
                                'shrink-0 border-t border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-5 py-4',
                        )}
                    >
                        <Button
                            onClick={() => setMapVisualOpen(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={processing || !hasMapVisualChanges}
                            onClick={saveMapVisuals}
                            type="button"
                        >
                            <Save className="size-4" />
                            Save map visuals
                        </Button>
                    </DialogFooter>
                </SettingsConfigurationDialog>
            </Dialog>

            <Dialog onOpenChange={setMapAccessOpen} open={mapAccessOpen}>
                <SettingsConfigurationDialog className="overflow-y-auto">
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

                    <div className="rounded-xl border border-[color-mix(in_srgb,var(--settings-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_10%,transparent)] p-3 text-sm leading-6 text-slate-800 dark:text-slate-100">
                        Public maps can be opened without an account. Guest
                        progress, tools and items are not stored on the server;
                        server-side learning state starts after login.
                    </div>

                    <DialogFooter
                        className={cn(
                            'shrink-0',
                            embedded &&
                                'border-t border-[var(--settings-border-color)] px-4 py-3 sm:px-5 sm:py-4',
                        )}
                    >
                        <Button
                            onClick={() => setMapAccessOpen(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={processing || !hasMapAccessChanges}
                            onClick={saveMapAccess}
                            type="button"
                        >
                            <Save className="size-4" />
                            Save access
                        </Button>
                    </DialogFooter>
                </SettingsConfigurationDialog>
            </Dialog>

            <Dialog
                modal={!embedded}
                onOpenChange={(open) => {
                    if (!open) {
                        closeDialog();
                    }
                }}
                open={dialogOpen}
            >
                <SettingsConfigurationDialog
                    className={cn(
                        'flex h-[calc(100svh-8rem)] flex-col overflow-hidden',
                        embedded &&
                            'rounded-none border-y-0 border-r-0 bg-[var(--settings-panel-background)] p-0 text-slate-950 shadow-2xl sm:max-w-none dark:text-slate-100',
                    )}
                    overlayClassName={embedded ? 'bg-transparent' : ''}
                    style={nodeDialogStyle}
                >
                    <DialogHeader
                        className={cn(
                            embedded &&
                                'shrink-0 border-b border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-5 py-4',
                        )}
                    >
                        <DialogTitle>
                            {selectedMapAsset
                                ? 'Edit MapAsset'
                                : isEditingNode
                                  ? 'Edit MapAsset'
                                  : 'Add MapAsset'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure the MapAsset and its learner-facing
                            behavior, or add a visual-only MapAsset.
                        </DialogDescription>
                    </DialogHeader>

                    <SettingsConfigurationLayout
                        className={cn('min-h-0 flex-1', embedded && 'gap-0')}
                        contentClassName={cn(
                            embedded &&
                                'bg-[var(--settings-panel-background)] p-0',
                        )}
                        sidebar={
                            <NodeSettingsSwitcher
                                activeSection={activeNodeSettingsSection}
                                hasMapAsset={Boolean(selectedMapAsset)}
                                isEditingNode={Boolean(selectedNode)}
                                onChange={setActiveNodeSettingsSection}
                            />
                        }
                    >
                        <SettingsContentPane
                            aria-labelledby={`map-asset-settings-tab-${activeNodeSettingsSection}`}
                            id="map-asset-settings-panel"
                            role="tabpanel"
                            tabIndex={0}
                        >
                            <div
                                className={cn(
                                    'grid content-start gap-4',
                                    embedded && 'p-4 sm:p-5',
                                )}
                            >
                                {activeNodeSettingsSection === 'surface' &&
                                selectedMapAsset ? (
                                    <SettingsConfigurationSection
                                        description="Configure the image, placement and surface behavior for this MapAsset."
                                        title="MapAsset surface"
                                    >
                                        <MapAssetFields
                                            form={mapAssetForm}
                                            mapId={map.id}
                                            onChange={setMapAssetForm}
                                            onPreviewStateChange={
                                                setMapAssetPreviewState
                                            }
                                            previewState={mapAssetPreviewState}
                                            errors={errors}
                                        />
                                    </SettingsConfigurationSection>
                                ) : null}

                                {activeNodeSettingsSection === 'activities' &&
                                selectedNode ? (
                                    <SettingsConfigurationSection
                                        description="Open the activity graph for this MapAsset."
                                        title="Activities"
                                    >
                                        <Button
                                            asChild
                                            type="button"
                                            variant="outline"
                                        >
                                            <Link
                                                href={`/settings?panel=admin-world-builder&map=${map.id}&node=${selectedNode.id}&worldView=nodes`}
                                            >
                                                <GitBranch className="size-4" />
                                                Edit activities
                                            </Link>
                                        </Button>
                                    </SettingsConfigurationSection>
                                ) : null}

                                {activeNodeSettingsSection === 'tile-text' ? (
                                    <SettingsConfigurationSection
                                        description="Configure the learner-facing label, hover text and any visual-only fallback text."
                                        title="MapAsset text"
                                    >
                                        {selectedNode ? (
                                            <>
                                                <TextField
                                                    error={
                                                        errors[
                                                            'visual_config.label'
                                                        ]
                                                    }
                                                    label="MapAsset label"
                                                    onChange={(value) =>
                                                        setVisualTextConfig(
                                                            setForm,
                                                            'label',
                                                            value,
                                                        )
                                                    }
                                                    value={
                                                        form.visual_config.label
                                                    }
                                                />
                                                <TextField
                                                    error={
                                                        errors[
                                                            'visual_config.tooltip'
                                                        ]
                                                    }
                                                    label="Hover text"
                                                    onChange={(value) =>
                                                        setVisualTextConfig(
                                                            setForm,
                                                            'tooltip',
                                                            value,
                                                        )
                                                    }
                                                    placeholder="Shown when learners hover the MapAsset"
                                                    value={
                                                        form.visual_config
                                                            .tooltip
                                                    }
                                                />
                                                <CheckboxField
                                                    checked={
                                                        form.visual_config
                                                            .hideLabel
                                                    }
                                                    description="The label remains available in the learner panel and when the MapAsset is selected."
                                                    id="hide-label"
                                                    label="Hide MapAsset label on world map"
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        setVisualBooleanConfig(
                                                            setForm,
                                                            'hideLabel',
                                                            checked,
                                                        )
                                                    }
                                                />
                                            </>
                                        ) : null}
                                    </SettingsConfigurationSection>
                                ) : null}

                                {activeNodeSettingsSection === 'right-panel' ? (
                                    <SettingsConfigurationSection
                                        description="Name, URL slug and learner-facing summary."
                                        title="Learner panel"
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
                                                                current
                                                                    .visual_config
                                                                    .label ||
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
                                        </div>

                                        <div className="grid gap-1">
                                            <Label htmlFor="tile-description">
                                                Description
                                            </Label>
                                            <textarea
                                                className="min-h-28 resize-y rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                id="tile-description"
                                                onChange={(event) => {
                                                    const description =
                                                        event.currentTarget
                                                            .value;

                                                    setForm((current) => ({
                                                        ...current,
                                                        description,
                                                    }));
                                                }}
                                                value={form.description}
                                            />
                                            <InputError
                                                message={errors.description}
                                            />
                                        </div>
                                    </SettingsConfigurationSection>
                                ) : null}

                                {activeNodeSettingsSection ===
                                'availability' ? (
                                    <>
                                        <SettingsConfigurationSection
                                            description="Learner-facing focus, lock and visibility behavior for this MapAsset."
                                            title="Availability & rules"
                                        >
                                            <div className="grid gap-3">
                                                {form.state !== 'hidden' ? (
                                                    <CheckboxField
                                                        checked={
                                                            form.state ===
                                                            'locked'
                                                        }
                                                        description="Locked nodes stay visible with their configured visuals, but learners cannot open them yet."
                                                        id="lock-node"
                                                        label="Lock MapAsset for learners"
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            setLockedState(
                                                                setForm,
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                ) : null}
                                                {form.state === 'hidden' ? (
                                                    <CheckboxField
                                                        checked={
                                                            form.visual_config
                                                                .hideEmptySpace
                                                        }
                                                        description="The MapAsset keeps its coordinate and spacing, but learners do not see or click it."
                                                        id="hide-empty-space"
                                                        label="Hide this empty space on learner map"
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            setVisualBooleanConfig(
                                                                setForm,
                                                                'hideEmptySpace',
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                ) : null}
                                            </div>
                                        </SettingsConfigurationSection>

                                        <SettingsConfigurationSection
                                            description="Hide this node until a learner uses a configured tool at its map position."
                                            title="Discovery"
                                        >
                                            <div className="grid gap-3">
                                                <CheckboxField
                                                    checked={
                                                        form.visual_config
                                                            .reveal.enabled
                                                    }
                                                    description="The node keeps its coordinates, but learners only reveal it by equipping the chosen tool and clicking its hidden map position."
                                                    id="reveal-with-tool"
                                                    label="Hide until revealed with a tool"
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
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
                                                            !form.visual_config
                                                                .reveal.enabled
                                                        }
                                                        id="reveal-tool"
                                                        onChange={(event) =>
                                                            setRevealToolId(
                                                                setForm,
                                                                event
                                                                    .currentTarget
                                                                    .value,
                                                            )
                                                        }
                                                        value={
                                                            form.visual_config
                                                                .reveal.toolId
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
                                        </SettingsConfigurationSection>

                                        <SettingsConfigurationSection
                                            description="Keep this visible node locked until completion rules and optional tool use allow access."
                                            title="Unlocking"
                                        >
                                            <div className="grid gap-3">
                                                <CheckboxField
                                                    checked={
                                                        form.visual_config
                                                            .unlock.enabled
                                                    }
                                                    description="Learners cannot open this node until the configured rule evaluates to true."
                                                    id="unlock-rules-enabled"
                                                    label="Use unlock rules for this node"
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        setUnlockEnabled(
                                                            setForm,
                                                            checked,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={
                                                        errors[
                                                            'visual_config.unlock.enabled'
                                                        ] ??
                                                        errors[
                                                            'visual_config.unlock.rules'
                                                        ]
                                                    }
                                                />
                                                <div className="grid gap-3 rounded-md bg-slate-50 p-3 dark:bg-white/5">
                                                    <div className="grid gap-1">
                                                        <Label htmlFor="unlock-top-operator">
                                                            Combine node and
                                                            tool rules with
                                                        </Label>
                                                        <select
                                                            className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                            disabled={
                                                                !form
                                                                    .visual_config
                                                                    .unlock
                                                                    .enabled
                                                            }
                                                            id="unlock-top-operator"
                                                            onChange={(event) =>
                                                                setUnlockOperator(
                                                                    setForm,
                                                                    'topOperator',
                                                                    event
                                                                        .currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            value={
                                                                form
                                                                    .visual_config
                                                                    .unlock
                                                                    .topOperator
                                                            }
                                                        >
                                                            <option value="and">
                                                                AND - all groups
                                                                must pass
                                                            </option>
                                                            <option value="or">
                                                                OR - any group
                                                                can pass
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
                                                                !form
                                                                    .visual_config
                                                                    .unlock
                                                                    .enabled
                                                            }
                                                            id="unlock-node-operator"
                                                            onChange={(event) =>
                                                                setUnlockOperator(
                                                                    setForm,
                                                                    'nodeOperator',
                                                                    event
                                                                        .currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            value={
                                                                form
                                                                    .visual_config
                                                                    .unlock
                                                                    .nodeOperator
                                                            }
                                                        >
                                                            <option value="and">
                                                                All selected
                                                                nodes completed
                                                            </option>
                                                            <option value="or">
                                                                Any selected
                                                                node completed
                                                            </option>
                                                        </select>
                                                        <select
                                                            className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                            disabled={
                                                                !form
                                                                    .visual_config
                                                                    .unlock
                                                                    .enabled
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                addUnlockRequiredNode(
                                                                    setForm,
                                                                    event
                                                                        .currentTarget
                                                                        .value,
                                                                );
                                                                event.currentTarget.value =
                                                                    '';
                                                            }}
                                                            value=""
                                                        >
                                                            <option value="">
                                                                Add
                                                                completed-node
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
                                                                        key={
                                                                            node.id
                                                                        }
                                                                        value={
                                                                            node.id
                                                                        }
                                                                    >
                                                                        {
                                                                            node.title
                                                                        }
                                                                    </option>
                                                                ))}
                                                        </select>
                                                        <div className="flex flex-wrap gap-2">
                                                            {form.visual_config
                                                                .unlock
                                                                .requiredNodeIds
                                                                .length ===
                                                            0 ? (
                                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                    No
                                                                    completed-node
                                                                    conditions
                                                                    yet.
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
                                                                            className="rounded-full border border-[color-mix(in_srgb,var(--settings-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_10%,transparent)] px-3 py-1 text-xs text-[var(--settings-accent)] transition hover:border-[var(--settings-accent)]"
                                                                            key={
                                                                                nodeId
                                                                            }
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
                                                                            {
                                                                                ' x'
                                                                            }
                                                                        </button>
                                                                    );
                                                                },
                                                            )}
                                                        </div>
                                                        <InputError
                                                            message={
                                                                errors[
                                                                    'visual_config.unlock.requiredNodeIds.0'
                                                                ]
                                                            }
                                                        />
                                                    </div>

                                                    <div className="grid gap-1">
                                                        <Label htmlFor="unlock-role">
                                                            Learner role
                                                            condition
                                                        </Label>
                                                        <select
                                                            className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                            disabled={
                                                                !form
                                                                    .visual_config
                                                                    .unlock
                                                                    .enabled
                                                            }
                                                            id="unlock-role"
                                                            onChange={(event) =>
                                                                setUnlockRole(
                                                                    setForm,
                                                                    event
                                                                        .currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            value={
                                                                form
                                                                    .visual_config
                                                                    .unlock
                                                                    .roleSlug
                                                            }
                                                        >
                                                            <option value="">
                                                                No role
                                                                condition
                                                            </option>
                                                            {roleOptions.map(
                                                                (role) => (
                                                                    <option
                                                                        key={
                                                                            role.slug
                                                                        }
                                                                        value={
                                                                            role.slug
                                                                        }
                                                                    >
                                                                        {
                                                                            role.name
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                            Only learners with
                                                            this assigned role
                                                            can open the node.
                                                        </p>
                                                        <InputError
                                                            message={
                                                                errors[
                                                                    'visual_config.unlock.roleSlug'
                                                                ]
                                                            }
                                                        />
                                                    </div>

                                                    <CheckboxField
                                                        checked={
                                                            form.visual_config
                                                                .unlock.item
                                                                .enabled
                                                        }
                                                        description="Learners must have the selected item in their inventory. Entering the node does not consume it."
                                                        id="unlock-item-enabled"
                                                        label="Require item possession"
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            setUnlockItemEnabled(
                                                                setForm,
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                    <div className="grid gap-1">
                                                        <Label htmlFor="unlock-item">
                                                            Unlock item
                                                        </Label>
                                                        <select
                                                            className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                                            disabled={
                                                                !form
                                                                    .visual_config
                                                                    .unlock
                                                                    .enabled ||
                                                                !form
                                                                    .visual_config
                                                                    .unlock.item
                                                                    .enabled
                                                            }
                                                            id="unlock-item"
                                                            onChange={(event) =>
                                                                setUnlockItemId(
                                                                    setForm,
                                                                    event
                                                                        .currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            value={
                                                                form
                                                                    .visual_config
                                                                    .unlock.item
                                                                    .itemId
                                                            }
                                                        >
                                                            <option value="">
                                                                Select an item
                                                            </option>
                                                            {items.map(
                                                                (item) => (
                                                                    <option
                                                                        key={
                                                                            item.id
                                                                        }
                                                                        value={
                                                                            item.id
                                                                        }
                                                                    >
                                                                        {
                                                                            item.title
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                        <InputError
                                                            message={
                                                                errors[
                                                                    'visual_config.unlock.item.itemId'
                                                                ]
                                                            }
                                                        />
                                                    </div>

                                                    <CheckboxField
                                                        checked={
                                                            form.visual_config
                                                                .unlock.tool
                                                                .enabled
                                                        }
                                                        description="Learners must use the selected tool on this locked node."
                                                        id="unlock-tool-enabled"
                                                        label="Require tool use"
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
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
                                                                !form
                                                                    .visual_config
                                                                    .unlock
                                                                    .enabled ||
                                                                !form
                                                                    .visual_config
                                                                    .unlock.tool
                                                                    .enabled
                                                            }
                                                            id="unlock-tool"
                                                            onChange={(event) =>
                                                                setUnlockToolId(
                                                                    setForm,
                                                                    event
                                                                        .currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            value={
                                                                form
                                                                    .visual_config
                                                                    .unlock.tool
                                                                    .toolId
                                                            }
                                                        >
                                                            <option value="">
                                                                Select a tool
                                                            </option>
                                                            {tools.map(
                                                                (tool) => (
                                                                    <option
                                                                        key={
                                                                            tool.id
                                                                        }
                                                                        value={
                                                                            tool.id
                                                                        }
                                                                    >
                                                                        {
                                                                            tool.title
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                        <InputError
                                                            message={
                                                                errors[
                                                                    'visual_config.unlock.tool.toolId'
                                                                ]
                                                            }
                                                        />
                                                    </div>

                                                    <div className="grid gap-4 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-2 dark:border-white/10 dark:bg-slate-950/60">
                                                        <DateTimeField
                                                            description="Optional unlock condition. The rule passes when the current time is the same or later."
                                                            disabled={
                                                                !form
                                                                    .visual_config
                                                                    .unlock
                                                                    .enabled
                                                            }
                                                            error={
                                                                errors[
                                                                    'visual_config.schedule.unlockAt'
                                                                ]
                                                            }
                                                            label="Unlock not before"
                                                            onChange={(value) =>
                                                                setScheduleValue(
                                                                    setForm,
                                                                    'unlockAt',
                                                                    value,
                                                                )
                                                            }
                                                            value={
                                                                form
                                                                    .visual_config
                                                                    .schedule
                                                                    .unlockAt
                                                            }
                                                        />
                                                        <DateTimeField
                                                            description="Optional hard lock. Once this time is reached, the node is locked again."
                                                            error={
                                                                errors[
                                                                    'visual_config.schedule.lockAt'
                                                                ]
                                                            }
                                                            label="Lock after"
                                                            onChange={(value) =>
                                                                setScheduleValue(
                                                                    setForm,
                                                                    'lockAt',
                                                                    value,
                                                                )
                                                            }
                                                            value={
                                                                form
                                                                    .visual_config
                                                                    .schedule
                                                                    .lockAt
                                                            }
                                                        />
                                                    </div>
                                                    <div className="rounded-md border border-amber-500/25 bg-amber-50 p-3 dark:border-amber-300/20 dark:bg-amber-300/10">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="grid gap-1 text-sm">
                                                                <p className="font-medium text-amber-950 dark:text-amber-50">
                                                                    Reset
                                                                    learner
                                                                    unlock state
                                                                </p>
                                                                <p className="text-xs text-amber-800 dark:text-amber-100/75">
                                                                    Lock this
                                                                    node again
                                                                    for every
                                                                    learner by
                                                                    removing
                                                                    saved
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
                                                                Lock for all
                                                                users
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </SettingsConfigurationSection>
                                    </>
                                ) : null}

                                {activeNodeSettingsSection === 'visuals' ? (
                                    <SettingsConfigurationSection
                                        description="Switch between dark and light colors for the MapAsset border, labels and hover state. The MapAsset image is configured under MapAsset surface."
                                        title="Visuals"
                                    >
                                        <div className="mb-4 flex justify-end">
                                            <ConfigModeSwitch
                                                mode={nodeVisualMode}
                                                onChange={setNodeVisualMode}
                                            />
                                        </div>
                                        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
                                            <div className="max-h-[28rem] min-h-0 overflow-y-auto overscroll-contain pr-2">
                                                <NodeVisualModeFields
                                                    errors={errors}
                                                    mode={nodeVisualMode}
                                                    setForm={setForm}
                                                    values={
                                                        form.visual_config[
                                                            nodeVisualMode
                                                        ]
                                                    }
                                                />
                                                {selectedNode?.unlockDiagnostics
                                                    ?.length ? (
                                                    <div className="grid gap-1 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                                                        <p className="font-semibold">
                                                            {t(
                                                                'settings.world_builder.unlock.diagnostics.title',
                                                                'Check this opening path',
                                                            )}
                                                        </p>
                                                        <p>
                                                            {t(
                                                                'settings.world_builder.unlock.diagnostics.detail',
                                                                'This node depends on locked places without an authored opening condition:',
                                                            )}
                                                        </p>
                                                        <ul className="list-disc pl-4">
                                                            {selectedNode.unlockDiagnostics.map(
                                                                (
                                                                    diagnostic,
                                                                ) => (
                                                                    <li
                                                                        key={
                                                                            diagnostic.id
                                                                        }
                                                                    >
                                                                        {
                                                                            diagnostic.title
                                                                        }
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                        <p className="text-amber-100/75">
                                                            {t(
                                                                'settings.world_builder.unlock.diagnostics.support',
                                                                'A Learning Support opening can still make a place available when needed.',
                                                            )}
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                            <NodeVisualPreview
                                                form={form}
                                                highlightImageEnabled={
                                                    highlightImageConfig.enabled
                                                }
                                                highlightImageUrl={
                                                    highlightImageConfig.url
                                                }
                                                imageUrl={
                                                    selectedMapAsset
                                                        ? mapAssetForm.image_url
                                                        : form.visual_config[
                                                              nodeVisualMode
                                                          ].imageUrl
                                                }
                                                mode={nodeVisualMode}
                                            />
                                        </div>
                                    </SettingsConfigurationSection>
                                ) : null}

                                {activeNodeSettingsSection ===
                                    'highlight-image' && selectedMapAsset ? (
                                    <SettingsConfigurationSection
                                        description={t(
                                            'settings.world_builder.map_asset.highlight_image.description',
                                            'Use a complete image overlay for the hovered and focused state instead of the configured highlight colors.',
                                        )}
                                        title={t(
                                            'settings.world_builder.map_asset.highlight_image.title',
                                            'Highlight image',
                                        )}
                                    >
                                        <div className="mb-4 flex justify-end">
                                            <ConfigModeSwitch
                                                mode={nodeVisualMode}
                                                onChange={setNodeVisualMode}
                                            />
                                        </div>
                                        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
                                            <div className="grid content-start gap-5">
                                                <CheckboxField
                                                    checked={
                                                        highlightImageConfig.enabled
                                                    }
                                                    description={t(
                                                        'settings.world_builder.map_asset.highlight_image.toggle_description',
                                                        'When enabled, hover and focus use the overlay image instead of highlight fill and border colors.',
                                                    )}
                                                    id={`map-asset-${nodeVisualMode}-highlight-image-enabled`}
                                                    label={t(
                                                        'settings.world_builder.map_asset.highlight_image.toggle_label',
                                                        'Use highlight image',
                                                    )}
                                                    onCheckedChange={(
                                                        enabled,
                                                    ) =>
                                                        setMapAssetVisualThemeConfig(
                                                            setMapAssetForm,
                                                            nodeVisualMode,
                                                            'highlightImageEnabled',
                                                            enabled,
                                                        )
                                                    }
                                                />
                                                <NodeImageInput
                                                    description={t(
                                                        'settings.world_builder.map_asset.highlight_image.input_description',
                                                        'Upload an overlay or select one from the reusable image library.',
                                                    )}
                                                    error={
                                                        imageUploadErrors[
                                                            `mapAssetHighlight-${nodeVisualMode}`
                                                        ] ??
                                                        errors[
                                                            `visual_config.${nodeVisualMode}.highlightImageUrl`
                                                        ]
                                                    }
                                                    id={`map-asset-${nodeVisualMode}-highlight-image`}
                                                    label={t(
                                                        'settings.world_builder.map_asset.highlight_image.input_label',
                                                        `${nodeVisualMode === 'dark' ? 'Dark' : 'Light'} highlight image`,
                                                        {
                                                            mode:
                                                                nodeVisualMode ===
                                                                'dark'
                                                                    ? 'Dark'
                                                                    : 'Light',
                                                        },
                                                    )}
                                                    onChange={(url) =>
                                                        setMapAssetVisualThemeConfig(
                                                            setMapAssetForm,
                                                            nodeVisualMode,
                                                            'highlightImageUrl',
                                                            url,
                                                        )
                                                    }
                                                    onUpload={(file) =>
                                                        void uploadWorldImage(
                                                            `mapAssetHighlight-${nodeVisualMode}`,
                                                            file,
                                                            (url) =>
                                                                setMapAssetVisualThemeConfig(
                                                                    setMapAssetForm,
                                                                    nodeVisualMode,
                                                                    'highlightImageUrl',
                                                                    url,
                                                                ),
                                                        )
                                                    }
                                                    uploading={
                                                        uploadingImageKey ===
                                                        `mapAssetHighlight-${nodeVisualMode}`
                                                    }
                                                    value={
                                                        highlightImageConfig.url
                                                    }
                                                />
                                            </div>
                                            <NodeVisualPreview
                                                form={form}
                                                highlightImageEnabled={
                                                    highlightImageConfig.enabled
                                                }
                                                highlightImageUrl={
                                                    highlightImageConfig.url
                                                }
                                                imageUrl={
                                                    mapAssetForm.image_url
                                                }
                                                mode={nodeVisualMode}
                                            />
                                        </div>
                                    </SettingsConfigurationSection>
                                ) : null}

                                {activeNodeSettingsSection === 'sounds' ? (
                                    <SettingsConfigurationSection
                                        description="Optional sounds for pointer, selection and unlock interactions on this MapAsset."
                                        title="MapAsset sounds"
                                    >
                                        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
                                            <div className="grid gap-4">
                                                <NodeSoundTriggerField
                                                    description="Played when the pointer enters this MapAsset."
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
                                                        form.visual_config
                                                            .sounds.mouseEnter
                                                    }
                                                />
                                                <NodeSoundTriggerField
                                                    description="Played when learners click or tap this MapAsset."
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
                                                    value={
                                                        form.visual_config
                                                            .sounds.click
                                                    }
                                                />
                                                <NodeSoundTriggerField
                                                    description="Played when the pointer leaves this MapAsset."
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
                                                        form.visual_config
                                                            .sounds.mouseLeave
                                                    }
                                                />
                                                <NodeSoundTriggerField
                                                    description="Played after the backend confirms this MapAsset was unlocked."
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
                                                    value={
                                                        form.visual_config
                                                            .sounds.unlock
                                                    }
                                                />
                                            </div>
                                            <NodeSoundPreview
                                                sounds={
                                                    form.visual_config.sounds
                                                }
                                            />
                                        </div>
                                    </SettingsConfigurationSection>
                                ) : null}

                                {activeNodeSettingsSection === 'danger' &&
                                selectedNode ? (
                                    <SettingsConfigurationSection
                                        description="Remove this MapAsset, its activities and learner progress from the map."
                                        title="Danger zone"
                                    >
                                        <div className="rounded-md border border-red-500/25 bg-red-50 p-3 dark:border-red-300/20 dark:bg-red-500/10">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="grid gap-1 text-sm">
                                                    <p className="font-medium text-red-950 dark:text-red-50">
                                                        Delete MapAsset
                                                    </p>
                                                    <p className="text-xs text-red-800 dark:text-red-100/75">
                                                        This removes the
                                                        MapAsset, its
                                                        activities, route
                                                        buttons, portal links,
                                                        bookmarks and learner
                                                        progress. This cannot be
                                                        undone.
                                                    </p>
                                                </div>
                                                <Button
                                                    className="shrink-0 border-red-500/40 text-red-700 hover:bg-red-100 dark:border-red-200/35 dark:text-red-200 dark:hover:bg-red-200/15"
                                                    disabled={processing}
                                                    onClick={() =>
                                                        setPendingDeleteNode(
                                                            selectedNode,
                                                        )
                                                    }
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    <Trash2 className="size-4" />
                                                    Delete MapAsset
                                                </Button>
                                            </div>
                                        </div>
                                    </SettingsConfigurationSection>
                                ) : null}
                            </div>
                        </SettingsContentPane>
                    </SettingsConfigurationLayout>

                    <DialogFooter
                        className={cn(
                            'shrink-0',
                            embedded &&
                                'border-t border-[var(--settings-border-color)] px-4 py-3 sm:px-5 sm:py-4',
                        )}
                    >
                        <Button
                            onClick={closeDialog}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        {!isEditingNode && !selectedMapAsset && (
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
                            onClick={() =>
                                selectedMapAsset ? saveMapAsset() : saveNode()
                            }
                            type="button"
                        >
                            <Save className="size-4" />
                            Save MapAsset
                        </Button>
                    </DialogFooter>
                </SettingsConfigurationDialog>
            </Dialog>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteNode(null);
                    }
                }}
                open={Boolean(pendingDeleteNode)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete MapAsset?</DialogTitle>
                        <DialogDescription>
                            {pendingDeleteNode
                                ? `This removes "${pendingDeleteNode.title}" from the map, including its activities and connected learner progress. This cannot be undone.`
                                : 'This MapAsset will be removed.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            onClick={() => setPendingDeleteNode(null)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={processing}
                            onClick={deleteSelectedNode}
                            type="button"
                            variant="destructive"
                        >
                            <Trash2 className="size-4" />
                            Delete MapAsset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function nodeSettingsSections(
    t: ReturnType<typeof usePlatformTranslation>,
): Array<
    SettingsNavigationItem<NodeSettingsSection> & {
        group: 'map-asset' | 'learning' | 'presentation' | 'maintenance';
    }
> {
    return [
        {
            description: t(
                'settings.world_builder.map_asset.navigation.surface_description',
                'Image, placement and surface behavior.',
            ),
            group: 'map-asset',
            icon: Image,
            key: 'surface',
            label: t(
                'settings.world_builder.map_asset.navigation.surface',
                'Surface & placement',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.navigation.text_description',
                'MapAsset label, hover text and visibility.',
            ),
            group: 'map-asset',
            icon: Type,
            key: 'tile-text',
            label: t(
                'settings.world_builder.map_asset.navigation.text',
                'MapAsset text',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.navigation.learner_panel_description',
                'Title, slug and description shown in the learner panel.',
            ),
            group: 'map-asset',
            icon: PanelRight,
            key: 'right-panel',
            label: t(
                'settings.world_builder.map_asset.navigation.learner_panel',
                'Learner panel',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.navigation.activities_description',
                'Open the activity graph for this MapAsset.',
            ),
            group: 'learning',
            icon: GitBranch,
            key: 'activities',
            label: t(
                'settings.world_builder.map_asset.navigation.activities',
                'Activities',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.navigation.availability_description',
                'Focus, locking, discovery and unlock rules.',
            ),
            group: 'learning',
            icon: Eye,
            key: 'availability',
            label: t(
                'settings.world_builder.map_asset.navigation.availability',
                'Availability & rules',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.navigation.visuals_description',
                'Border, label and hover colors with contour-aware preview.',
            ),
            group: 'presentation',
            icon: Palette,
            key: 'visuals',
            label: t(
                'settings.world_builder.map_asset.navigation.visuals',
                'Visuals',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.highlight_image.navigation_description',
                'Overlay image for hover and focus.',
            ),
            group: 'presentation',
            icon: Layers3,
            key: 'highlight-image',
            label: t(
                'settings.world_builder.map_asset.highlight_image.navigation_label',
                'Highlight image',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.navigation.sounds_description',
                'Pointer, selection and unlock sounds for this MapAsset.',
            ),
            group: 'presentation',
            icon: Volume2,
            key: 'sounds',
            label: t(
                'settings.world_builder.map_asset.navigation.sounds',
                'Sounds',
            ),
        },
        {
            description: t(
                'settings.world_builder.map_asset.navigation.danger_description',
                'Remove the MapAsset and its learner data.',
            ),
            group: 'maintenance',
            icon: Trash2,
            key: 'danger',
            label: t(
                'settings.world_builder.map_asset.navigation.danger',
                'Danger zone',
            ),
        },
    ];
}

function NodeSettingsSwitcher({
    activeSection,
    hasMapAsset,
    isEditingNode,
    onChange,
}: {
    activeSection: NodeSettingsSection;
    hasMapAsset: boolean;
    isEditingNode: boolean;
    onChange: (section: NodeSettingsSection) => void;
}) {
    const t = usePlatformTranslation();
    const tabRefs = useRef(new Map<NodeSettingsSection, HTMLButtonElement>());
    const visibleSections = nodeSettingsSections(t).filter((section) => {
        if (hasMapAsset && !isEditingNode) {
            return !['activities', 'tile-text', 'right-panel'].includes(
                section.key,
            );
        }

        if (hasMapAsset) {
            return true;
        }

        return (
            isEditingNode ||
            (section.key !== 'activities' && section.key !== 'danger')
        );
    });
    const groups = [
        {
            key: 'map-asset' as const,
            label: t(
                'settings.world_builder.map_asset.navigation.group_map_asset',
                'MapAsset',
            ),
        },
        {
            key: 'learning' as const,
            label: t(
                'settings.world_builder.map_asset.navigation.group_learning',
                'Learning',
            ),
        },
        {
            key: 'presentation' as const,
            label: t(
                'settings.world_builder.map_asset.navigation.group_presentation',
                'Presentation',
            ),
        },
        {
            key: 'maintenance' as const,
            label: t(
                'settings.world_builder.map_asset.navigation.group_maintenance',
                'Maintenance',
            ),
        },
    ];

    const moveFocus = (
        event: ReactKeyboardEvent<HTMLButtonElement>,
        currentIndex: number,
    ) => {
        if (
            ![
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'End',
                'Home',
            ].includes(event.key)
        ) {
            return;
        }

        event.preventDefault();

        const nextIndex =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? visibleSections.length - 1
                  : (currentIndex +
                        (event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                            ? -1
                            : 1) +
                        visibleSections.length) %
                    visibleSections.length;
        const nextSection = visibleSections[nextIndex];

        onChange(nextSection.key);
        window.requestAnimationFrame(() =>
            tabRefs.current.get(nextSection.key)?.focus(),
        );
    };

    return (
        <aside className="min-h-0 overflow-y-auto border-r border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-3">
            <div
                aria-label={t(
                    'settings.world_builder.map_asset.navigation.aria_label',
                    'MapAsset settings sections',
                )}
                className="grid gap-5"
                role="tablist"
            >
                {groups.map((group) => {
                    const items = visibleSections.filter(
                        (section) => section.group === group.key,
                    );

                    if (items.length === 0) {
                        return null;
                    }

                    return (
                        <section className="grid gap-2" key={group.key}>
                            <p className="px-3 text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--settings-muted-text)] uppercase">
                                {group.label}
                            </p>
                            {items.map((item) => {
                                const sectionIndex = visibleSections.findIndex(
                                    (section) => section.key === item.key,
                                );

                                return (
                                    <SettingsSectionButton
                                        active={activeSection === item.key}
                                        ariaControls="map-asset-settings-panel"
                                        danger={item.danger}
                                        description={item.description}
                                        elementId={`map-asset-settings-tab-${item.key}`}
                                        icon={item.icon}
                                        id={item.key}
                                        key={item.key}
                                        label={item.label}
                                        onKeyDown={(event) =>
                                            moveFocus(event, sectionIndex)
                                        }
                                        onSelect={onChange}
                                        buttonRef={(element) => {
                                            if (element) {
                                                tabRefs.current.set(
                                                    item.key,
                                                    element,
                                                );
                                            } else {
                                                tabRefs.current.delete(
                                                    item.key,
                                                );
                                            }
                                        }}
                                        role="tab"
                                        tabIndex={
                                            activeSection === item.key ? 0 : -1
                                        }
                                    />
                                );
                            })}
                        </section>
                    );
                })}
            </div>
        </aside>
    );
}

function clearPendingNodeDialogReset(resetRef: { current: number | null }) {
    if (resetRef.current === null) {
        return;
    }

    window.clearTimeout(resetRef.current);
    resetRef.current = null;
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
                            'absolute top-1/2 left-1/2 grid h-[104px] w-[120px] -translate-x-1/2 -translate-y-1/2 place-items-center px-4 text-center text-xs font-semibold shadow-lg transition hover:-translate-y-[54%] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
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
                                        'absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[var(--settings-accent)] shadow-sm backdrop-blur-md transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                                        targetNode
                                            ? 'pointer-events-auto border-[color-mix(in_srgb,var(--settings-accent)_48%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] hover:border-[color-mix(in_srgb,var(--settings-accent)_78%,transparent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_22%,transparent)]'
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
                    className="pointer-events-auto grid size-14 place-items-center rounded-full border border-dashed border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] text-[var(--settings-accent)] shadow-sm backdrop-blur-md transition hover:scale-105 hover:border-[color-mix(in_srgb,var(--settings-accent)_78%,transparent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_22%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
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
            className="pointer-events-auto absolute z-10 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[color-mix(in_srgb,var(--settings-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)] shadow-sm backdrop-blur-md transition hover:scale-105 hover:border-[color-mix(in_srgb,var(--settings-accent)_82%,transparent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
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

function DateTimeField({
    description,
    disabled = false,
    error,
    label,
    onChange,
    value,
}: {
    description: string;
    disabled?: boolean;
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
                disabled={disabled}
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                step={600}
                type="datetime-local"
                value={value}
            />
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                {description}
            </p>
            <InputError message={error} />
        </div>
    );
}

function setScheduleValue(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    key: keyof NodeForm['visual_config']['schedule'],
    value: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            schedule: {
                ...current.visual_config.schedule,
                [key]: value,
            },
        },
    }));
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

function NodeSoundPreview({ sounds }: { sounds: NodeSoundFields }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                Preview
            </p>
            <button
                className="mt-4 grid min-h-44 w-full place-items-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center text-sm font-semibold text-slate-700 transition hover:border-[var(--settings-accent)] hover:bg-slate-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/5"
                onClick={() => void playNodeSound(sounds.click)}
                onMouseEnter={() => void playNodeSound(sounds.mouseEnter)}
                onMouseLeave={() => void playNodeSound(sounds.mouseLeave)}
                type="button"
            >
                <span>
                    Preview MapAsset
                    <span className="mt-2 block text-xs font-normal text-slate-500 dark:text-slate-400">
                        Hover, click, and leave this MapAsset to test configured
                        sounds.
                    </span>
                </span>
            </button>
            <Button
                className="mt-3 w-full"
                onClick={() => void playNodeSound(sounds.unlock)}
                type="button"
                variant="outline"
            >
                <Volume2 className="size-4" />
                Preview unlock sound
            </Button>
        </div>
    );
}

async function playNodeSound(sound: NodeSoundTriggerConfig): Promise<void> {
    if (!sound.enabled || !sound.url) {
        return;
    }

    const audio = new Audio(sound.url);
    audio.volume = 0.8;
    await audio.play().catch(() => undefined);
}

type NodeVisualColorKey =
    | 'borderColor'
    | 'highlightColor'
    | 'highlightBorderColor'
    | 'labelColor'
    | 'highlightedLabelColor';

type NodeVisualOpacityKey =
    | 'borderOpacity'
    | 'highlightOpacity'
    | 'highlightBorderOpacity'
    | 'labelOpacity'
    | 'highlightedLabelOpacity';

const nodeVisualFields: {
    key: NodeVisualColorKey;
    label: string;
    opacityKey: NodeVisualOpacityKey;
}[] = [
    { key: 'borderColor', label: 'Border color', opacityKey: 'borderOpacity' },
    { key: 'labelColor', label: 'Label color', opacityKey: 'labelOpacity' },
    {
        key: 'highlightColor',
        label: 'Highlight fill color',
        opacityKey: 'highlightOpacity',
    },
    {
        key: 'highlightBorderColor',
        label: 'Highlight border color',
        opacityKey: 'highlightBorderOpacity',
    },
    {
        key: 'highlightedLabelColor',
        label: 'Highlighted label color',
        opacityKey: 'highlightedLabelOpacity',
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
    { key: 'sidePanelHeadingColor', label: 'Node side panel heading' },
    { key: 'sidePanelTextColor', label: 'Node side panel text' },
    { key: 'sidePanelMutedTextColor', label: 'Node side panel muted text' },
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
    mode,
    setForm,
    values,
}: {
    errors: Record<string, string>;
    mode: ThemeMode;
    setForm: Dispatch<SetStateAction<NodeForm>>;
    values: NodeVisualThemeFields;
}) {
    const labelPrefix = mode === 'dark' ? 'Dark mode' : 'Light mode';

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div>
                <h3 className="text-sm font-semibold">{labelPrefix}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    These values define how the MapAsset appears in this mode.
                </p>
            </div>
            <div className="grid gap-3">
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
        </div>
    );
}

function NodeVisualPreview({
    form,
    highlightImageEnabled = false,
    highlightImageUrl,
    imageUrl,
    mode,
}: {
    form: NodeForm;
    highlightImageEnabled?: boolean;
    highlightImageUrl?: string;
    imageUrl?: string;
    mode: ThemeMode;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const values = form.visual_config[mode];
    const borderColor =
        withOpacity(values.borderColor || '#12343b', values.borderOpacity) ??
        '#12343b';
    const labelColor =
        withOpacity(values.labelColor || '#ffffff', values.labelOpacity) ??
        '#ffffff';
    const highlightColor =
        withOpacity(
            values.highlightColor || '#7dd3fc',
            values.highlightOpacity,
        ) ?? '#7dd3fc';
    const highlightBorderColor =
        withOpacity(
            values.highlightBorderColor || values.highlightColor || '#7dd3fc',
            values.highlightBorderOpacity ?? values.highlightOpacity,
        ) ?? '#7dd3fc';
    const highlightedLabelColor =
        withOpacity(
            values.highlightedLabelColor || '#ffffff',
            values.highlightedLabelOpacity,
        ) ?? '#ffffff';
    const previewLabel =
        form.visual_config.label || form.title || 'Preview tile';

    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                Preview
            </p>
            <div className="mt-4 grid min-h-72 place-items-center rounded-lg bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.10),transparent_58%)]">
                <div
                    aria-label="MapAsset image hover preview"
                    className="group pointer-events-none relative grid h-[180px] w-[180px] place-items-center overflow-hidden text-center focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
                    onBlur={() => setIsHovered(false)}
                    onFocus={() => setIsHovered(true)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    role="img"
                    tabIndex={0}
                >
                    <MapAssetVisual
                        backgroundColor={borderColor}
                        highlighted={isHovered}
                        highlightColor={highlightColor}
                        highlightBorderColor={highlightBorderColor}
                        highlightImageEnabled={highlightImageEnabled}
                        highlightImageUrl={highlightImageUrl}
                        highlightedLabelColor={highlightedLabelColor}
                        imageUrl={imageUrl}
                        label={previewLabel}
                        labelColor={labelColor}
                    />
                    <ImageAlphaHitArea imageUrl={imageUrl} />
                    {form.state === 'locked' ? (
                        <LockKeyhole className="relative z-20 size-9 text-white/70 drop-shadow" />
                    ) : null}
                </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {imageUrl
                    ? 'Hover or focus the image to test the highlight and label colors.'
                    : 'Select a MapAsset image under Surface & placement to preview it here.'}
            </p>
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
    const description =
        mode === 'dark'
            ? 'These values are the default map visuals.'
            : 'Empty fields inherit the dark-mode defaults.';

    return (
        <SettingsConfigurationSection
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
        </SettingsConfigurationSection>
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

function setMapAssetVisualThemeConfig(
    setForm: Dispatch<SetStateAction<AssetForm>>,
    mode: ThemeMode,
    key: 'highlightImageEnabled' | 'highlightImageUrl',
    value: boolean | string,
) {
    setForm((current) => {
        const currentTheme = visualConfigRecord(current.visual_config[mode]);

        return {
            ...current,
            visual_config: {
                ...current.visual_config,
                [mode]: {
                    ...currentTheme,
                    [key]: value,
                },
            },
        };
    });
}

function mapAssetHighlightImageConfig(
    form: AssetForm,
    mode: ThemeMode,
): { enabled: boolean; url: string } {
    const theme = visualConfigRecord(form.visual_config[mode]);

    return {
        enabled: theme.highlightImageEnabled === true,
        url:
            typeof theme.highlightImageUrl === 'string'
                ? theme.highlightImageUrl
                : '',
    };
}

function visualConfigRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
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

function setUnlockRole(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    roleSlug: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                roleSlug,
            },
        },
    }));
}

function setUnlockItemEnabled(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    enabled: boolean,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                item: {
                    ...current.visual_config.unlock.item,
                    enabled,
                },
            },
        },
    }));
}

function setUnlockItemId(
    setForm: Dispatch<SetStateAction<NodeForm>>,
    itemId: string,
) {
    setForm((current) => ({
        ...current,
        visual_config: {
            ...current.visual_config,
            unlock: {
                ...current.visual_config.unlock,
                item: {
                    ...current.visual_config.unlock.item,
                    itemId,
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
            borderColor: '#dbeafe',
            borderOpacity: '100',
            foregroundColor: '#1d4ed8',
            foregroundOpacity: '100',
            highlightColor: '#2563eb',
            highlightOpacity: '100',
            highlightBorderColor: '#1d4ed8',
            highlightBorderOpacity: '100',
            highlightedLabelColor: '#ffffff',
            highlightedLabelOpacity: '100',
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
        borderColor: '#253047',
        borderOpacity: '100',
        foregroundColor: '#bfdbfe',
        foregroundOpacity: '100',
        highlightColor: '#7dd3fc',
        highlightOpacity: '100',
        highlightBorderColor: '#bfdbfe',
        highlightBorderOpacity: '100',
        highlightedLabelColor: '#ffffff',
        highlightedLabelOpacity: '100',
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
        borderColor: '',
        borderOpacity: '',
        foregroundColor: '',
        foregroundOpacity: '',
        highlightColor: '',
        highlightOpacity: '',
        highlightBorderColor: '',
        highlightBorderOpacity: '',
        highlightedLabelColor: '',
        highlightedLabelOpacity: '',
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
        sidePanelHeadingColor: '',
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
            schedule: emptyScheduleConfig(),
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
                borderColor: '#f8fafc',
                borderOpacity: '100',
                foregroundColor: '#94a3b8',
                foregroundOpacity: '100',
                highlightColor: '#94a3b8',
                highlightOpacity: '100',
                highlightBorderColor: '#94a3b8',
                highlightBorderOpacity: '100',
                highlightedLabelColor: '#64748b',
                highlightedLabelOpacity: '100',
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
                borderColor: '#f8fafc',
                borderOpacity: '100',
                foregroundColor: '#94a3b8',
                foregroundOpacity: '100',
                highlightColor: '#94a3b8',
                highlightOpacity: '100',
                highlightBorderColor: '#94a3b8',
                highlightBorderOpacity: '100',
                highlightedLabelColor: '#64748b',
                highlightedLabelOpacity: '100',
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
            schedule: emptyScheduleConfig(),
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
            schedule: scheduleConfigFromNode(node.visualConfig.schedule),
            sounds: nodeSoundFieldsFromConfig(node.visualConfig.sounds),
            tooltip: stringConfig(node.visualConfig.tooltip, ''),
            unlock: unlockConfigFromNode(node.visualConfig.unlock),
        },
    };
}

function nodeFormFromMapAsset(asset: MapAsset): NodeForm {
    const form = emptyNodeForm(0, 0);
    const config = (asset.visualConfig ?? {}) as unknown as VisualConfig;
    const hasThemeVariants =
        isVisualConfig(config.dark) || isVisualConfig(config.light);
    const darkConfig = hasThemeVariants ? config.dark : config;
    const lightConfig = hasThemeVariants ? config.light : config;

    return {
        ...form,
        title: asset.text ?? '',
        visual_config: {
            ...form.visual_config,
            dark: nodeVisualThemeFieldsFromConfig(
                darkConfig,
                defaultNodeVisualThemeFields('dark'),
            ),
            label: stringConfig(config.label, asset.text ?? ''),
            hideLabel: booleanConfig(config.hideLabel, false),
            hideImage: booleanConfig(config.hideImage, false),
            light: nodeVisualThemeFieldsFromConfig(
                lightConfig,
                defaultNodeVisualThemeFields('light'),
            ),
            tooltip: stringConfig(config.tooltip, ''),
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
        item: {
            enabled: false,
            itemId: '',
        },
        tool: {
            enabled: false,
            toolId: '',
        },
        topOperator: 'and',
        roleSlug: '',
    };
}

function emptyScheduleConfig(): NodeForm['visual_config']['schedule'] {
    return {
        lockAt: '',
        unlockAt: '',
    };
}

function unlockConfigFromNode(
    config: VisualConfigValue,
): NodeForm['visual_config']['unlock'] {
    const unlock = isVisualConfig(config) ? config : {};
    const item = isVisualConfig(unlock.item) ? unlock.item : {};
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
        item: {
            enabled: booleanConfig(item.enabled, false),
            itemId: inputStringConfig(item.itemId, ''),
        },
        topOperator:
            stringConfig(unlock.topOperator, 'and') === 'or' ? 'or' : 'and',
        roleSlug: inputStringConfig(unlock.roleSlug, ''),
    };
}

function scheduleConfigFromNode(
    config: VisualConfigValue,
): NodeForm['visual_config']['schedule'] {
    const schedule = isVisualConfig(config) ? config : {};

    return {
        lockAt: inputStringConfig(schedule.lockAt, ''),
        unlockAt: inputStringConfig(schedule.unlockAt, ''),
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
        borderColor: stringConfig(
            themeConfig.borderColor,
            stringConfig(themeConfig.tileColor, fallback.borderColor),
        ),
        borderOpacity: stringConfig(
            themeConfig.borderOpacity,
            stringConfig(themeConfig.tileOpacity, fallback.borderOpacity),
        ),
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
        highlightBorderColor: stringConfig(
            themeConfig.highlightBorderColor,
            stringConfig(
                themeConfig.highlightColor,
                fallback.highlightBorderColor,
            ),
        ),
        highlightBorderOpacity: stringConfig(
            themeConfig.highlightBorderOpacity,
            stringConfig(
                themeConfig.highlightOpacity,
                fallback.highlightBorderOpacity,
            ),
        ),
        highlightedLabelColor: stringConfig(
            themeConfig.highlightedLabelColor,
            fallback.highlightedLabelColor,
        ),
        highlightedLabelOpacity: stringConfig(
            themeConfig.highlightedLabelOpacity,
            fallback.highlightedLabelOpacity,
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
        sidePanelHeadingColor: stringConfig(
            config?.sidePanelHeadingColor,
            fallback.sidePanelHeadingColor,
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
            schedule: {
                ...form.visual_config.schedule,
                ...override.visual_config?.schedule,
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
                item: {
                    ...form.visual_config.unlock.item,
                    ...override.visual_config?.unlock?.item,
                },
            },
        },
    };
}

function nodePayload(form: NodeForm): NodeForm {
    const rules = buildUnlockRules(
        form.visual_config.unlock,
        form.visual_config.schedule,
    );

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
    schedule: NodeForm['visual_config']['schedule'],
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

    if (unlock.item.enabled && unlock.item.itemId) {
        rules.push({
            itemId: Number(unlock.item.itemId),
            type: 'item_owned',
        });
    }

    if (unlock.roleSlug) {
        rules.push({
            roleSlug: unlock.roleSlug,
            type: 'role_has',
        });
    }

    if (schedule.unlockAt) {
        rules.push({
            type: 'time_after',
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
