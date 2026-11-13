import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    ArrowLeft,
    ArrowRight,
    BookmarkPlus,
    CircleAlert,
    CircleCheck,
    Copy,
    Download,
    FileJson,
    GitBranch,
    LockKeyhole,
    Map as MapIcon,
    Pencil,
    Plus,
    RefreshCw,
    Route,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalActivityHistoryDialog } from './original-activity-history';
import { OriginalActivityAiReviewDialog } from './original-activity-ai-review';
import { OriginalActivityEvidenceContextDialog } from './original-activity-evidence-context';
import { OriginalActivityCompletionChoiceDialog } from './original-activity-completion-choice';
import { OriginalActivityAmbientSoundDialog } from './original-activity-ambient-sound-authoring';
import { OriginalActivityFeedbackGuidanceDialog } from './original-activity-feedback-guidance';
import {
    OriginalActivityLearningDesignDialog,
    type LearningDesignSuggestions,
} from './original-activity-learning-design';
import { OriginalActivitySourceReferencesDialog } from './original-activity-source-references';
import { OriginalActivityTemplatesDialog } from './original-activity-templates';
import { ContentAuthoringDialog } from './original-content-authoring-dialog';
import { OriginalNpcDialogueEditor } from './original-npc-dialogue-editor';
import { OriginalSourceCatalogDialog } from './original-source-catalog';
import { PortalScene } from './original-portal-activity';
import { PublicMapAssetVisual } from './public-map-asset-visual';
import { type OriginalAppearance } from './original-appearance';
import {
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
    type SettingsNavigationItem,
} from './extracted-settings-configuration-shell';
import { settingsSections } from './extracted-settings-navigation';
import {
    SettingsSidebarNavigation,
    SettingsTopBar,
} from './extracted-settings-sidebar-navigation';
import { SettingsCornerNavigation } from './extracted-settings-corner-navigation';
import { usePlatformTranslation } from './original-platform-translation';

type WorldGraph = components['schemas']['AdminWorldGraph'];
type MapSummary = components['schemas']['AdminMapSummary'];
type ActivityCopyTarget = {
    id: string;
    title: string;
    nodes: Array<{ id: string; title: string }>;
};
type PortalLink = components['schemas']['AdminPortalLink'];
type EditableMap = components['schemas']['AdminEditableMap'];
type EditableNode = components['schemas']['AdminEditableNode'];
type NodeSummary = components['schemas']['AdminNodeSummary'];
type NodeState = NodeSummary['state'];
type RoleOption = components['schemas']['AdminRoleOption'];
type Activity = components['schemas']['AdminEditableActivity'];
type EditableItem = components['schemas']['AdminEditableItem'];
type EditableSound = components['schemas']['AdminEditableSound'];
type EditableMapAsset = components['schemas']['AdminEditableMapAsset'];
export type MediaAsset = components['schemas']['AdminMediaAsset'];
type MediaAssetPage = components['schemas']['AdminMediaAssetPage'];
type MapAssetRequest = components['schemas']['UpsertAdminWorldMapAssetRequest'];
type EditableTool = components['schemas']['AdminEditableTool'];
type ActivityTransition = components['schemas']['AdminActivityTransition'];
type ActivityConnector = components['schemas']['AdminActivityConnector'];
type ActivityStartRoute = components['schemas']['AdminActivityStartRoute'];
type MessageTopic = components['schemas']['AdminMessageTopicOption'];
type PortalCandidate = components['schemas']['AdminActivityPortalCandidate'];
type ReviewQueue = components['schemas']['AdminWorldReviewQueuePage'];
type MapExportPreflight = components['schemas']['AdminWorldMapExportPreflightResult'];
type WorldImportPreflight =
    components['schemas']['AdminWorldImportPreflightResult'];
type WorldDetailsVersionPage =
    components['schemas']['AdminWorldDetailsVersionPage'];
type MapDetailsVersionPage =
    components['schemas']['AdminMapDetailsVersionPage'];
type MapAssetVersionPage =
    components['schemas']['AdminMapAssetVersionPage'];
type MapLayoutVersionPage =
    components['schemas']['AdminMapLayoutVersionPage'];
type MapLayoutPreviewPage =
    components['schemas']['AdminMapLayoutPreviewPage'];
type MapVisualMode = 'dark' | 'light';
type MapVisualAssetForm = {
    id: string;
    imageUrl: string;
    opacity: number;
    width: number;
    x: number;
    y: number;
};
type MapVisualThemeForm = {
    accentColor: string;
    assets: MapVisualAssetForm[];
    imageUrl: string;
    overlay: string;
    pageBackground: string;
    panelBackground: string;
    panelBorderColor: string;
    panelMutedTextColor: string;
    panelTextColor: string;
    sideControlActiveBackground: string;
    sideControlActiveIconColor: string;
    sideControlActiveTextColor: string;
    sideControlBackground: string;
    sideControlBorderColor: string;
    sideControlIconColor: string;
    sideControlTextColor: string;
    sidePanelBackground: string;
    sidePanelBorderColor: string;
    sidePanelHeadingColor: string;
    sidePanelMutedTextColor: string;
    sidePanelTextColor: string;
};
type MapVisualForm = Record<MapVisualMode, MapVisualThemeForm>;

type WorldMapNodeData = {
    map: MapSummary;
};

type ActivityNodeData = {
    activity: Activity;
    onAmbientSound: (activity: Activity) => void;
    canReview: boolean;
    onDuplicate: (activity: Activity) => void;
    onEdit: (activity: Activity) => void;
    onDelete: (activity: Activity) => void;
    onEvidenceContext: (activity: Activity) => void;
    onCompletionChoice: (activity: Activity) => void;
    onFeedbackGuidance: (activity: Activity) => void;
    onHistory: (activity: Activity) => void;
    onReview: (activity: Activity) => void;
    onSourceReferences: (activity: Activity) => void;
    onSaveTemplate: (activity: Activity) => void;
    onUpdateTemplate: (activity: Activity) => void;
};

type WorldMapNode = Node<WorldMapNodeData, 'map'>;
type WorldPortalEdge = Edge<PortalLink>;
type ActivityNode = Node<ActivityNodeData, 'activity'>;
type SpecialNode = Node<{ kind: 'start' | 'end'; label: string }, 'special'>;
type ActivityFlowNode = ActivityNode | SpecialNode;
type SupportedActivityType =
    | 'open_practice'
    | 'reflection'
    | 'review'
    | 'markdown'
    | 'portal'
    | 'item_grant'
    | 'tool_grant'
    | 'item_obstacle'
    | 'obstacle'
    | 'question'
    | 'shared_task'
    | 'message_prompt'
    | 'message_wall';

type WorldBuilderSection = 'graph';

const worldBuilderSections = [
    {
        description: 'See maps and portal routes as a connected graph.',
        icon: GitBranch,
        key: 'graph',
        label: 'Graph',
    },
] satisfies SettingsNavigationItem<WorldBuilderSection>[];
type ObstacleForm = {
    allowedToolIds: string[];
    backgroundDark: string;
    backgroundLight: string;
    backgroundMirrored: boolean;
    bubbleBorderColorDark: string;
    bubbleBorderColorLight: string;
    bubbleColorDark: string;
    bubbleColorLight: string;
    bubbleOpacityDark: string;
    bubbleOpacityLight: string;
    imageDark: string;
    imageLight: string;
    imageMirrored: boolean;
    persistAfterSolved: boolean;
    promptText: string;
    revisitBackgroundDark: string;
    revisitBackgroundLight: string;
    revisitBackgroundMirrored: boolean;
    revisitImageDark: string;
    revisitImageLight: string;
    revisitImageMirrored: boolean;
    revisitText: string;
    successAnimation: string;
    successText: string;
    typingSpeed: string;
    width: string;
    x: string;
    y: string;
};
type MarkdownPageDraft = {
    body: string;
    id: string;
    position: { x: number; y: number };
    title: string;
    visual: {
        borderColorDark: string;
        borderColorLight: string;
        headingColorDark: string;
        headingColorLight: string;
        pageColorDark: string;
        pageColorLight: string;
        textColorDark: string;
        textColorLight: string;
    };
};
type MarkdownTransitionDraft = { from: string; id: string; to: string };
type PortalAssetDraft = {
    id: string;
    imageDark: string;
    imageLight: string;
    label: string;
    layer: 'behind-background' | 'above-background' | 'above-foreground' | 'front';
    mirrored: boolean;
    opacity: string;
    width: string;
    x: string;
    y: string;
};
type ActivityAuthorForm = {
    backgroundDark: string;
    backgroundLight: string;
    backgroundMirrored: boolean;
    bubbleBorderColorDark: string;
    bubbleBorderColorLight: string;
    bubbleColorDark: string;
    bubbleColorLight: string;
    bubbleOpacityDark: string;
    bubbleOpacityLight: string;
    fadeDurationSeconds: string;
    introduction: string;
    itemObstacleBackgroundDark: string;
    itemObstacleBackgroundLight: string;
    itemObstacleBackgroundMirrored: boolean;
    itemObstacleConsumeOnEachEntry: boolean;
    itemObstacleLockMinutes: string;
    itemObstacleMetBackgroundDark: string;
    itemObstacleMetBackgroundLight: string;
    itemObstacleMetBackgroundMirrored: boolean;
    itemObstacleOverlayDark: string;
    itemObstacleOverlayLight: string;
    itemObstacleOverlayMirrored: boolean;
    itemObstacleOverlayWidth: string;
    itemObstacleOverlayX: string;
    itemObstacleOverlayY: string;
    itemObstacleSlots: Array<{
        itemId: string;
        width: string;
        x: string;
        y: string;
    }>;
    itemObstacleSoundMetEnabled: boolean;
    itemObstacleSoundMetId: string;
    itemObstacleSoundNotMetEnabled: boolean;
    itemObstacleSoundNotMetId: string;
    itemObstacleSoundTransitionEnabled: boolean;
    itemObstacleSoundTransitionId: string;
    items: Array<{ itemId: string; quantity: string }>;
    markdownGraphLayout: {
        end?: { x: number; y: number };
        start?: { x: number; y: number };
    };
    markdownPages: MarkdownPageDraft[];
    markdownTransitions: MarkdownTransitionDraft[];
    portalAssets: PortalAssetDraft[];
    portalBackgroundDark: string;
    portalBackgroundLight: string;
    portalBackgroundMirrored: boolean;
    portalBubbleBorderColorDark: string;
    portalBubbleBorderColorLight: string;
    portalBubbleColorDark: string;
    portalBubbleColorLight: string;
    portalBubbleText: string;
    portalBubbleTextColorDark: string;
    portalBubbleTextColorLight: string;
    portalBubbleTypingSpeed: string;
    portalDurationSeconds: string;
    portalForegroundDark: string;
    portalForegroundLight: string;
    portalForegroundMirrored: boolean;
    portalForegroundWidth: string;
    portalForegroundX: string;
    portalForegroundY: string;
    portalMode: 'input' | 'output';
    portalShowOnArrival: boolean;
    portalSwirlEnabled: boolean;
    portalTargetId: string;
    portalWaitForEnter: boolean;
    nextStep: string;
    note: string;
    obstacle: ObstacleForm;
    prompt: string;
    questionAllowMultiple: boolean;
    questionExplanation: string;
    questionFeedbackCorrect: string;
    questionFeedbackIncorrect: string;
    questionOptions: Array<{
        body: string;
        feedback: string;
        isCorrect: boolean;
        key: string;
        label: string;
        outcomeKey: string;
        weights: Record<string, number>;
    }>;
    questionPrompt: string;
    messageActivityType: 'message_prompt' | 'message_wall';
    messageAllowResponses: boolean;
    messageAudience: 'peers' | 'support';
    messageAccentColorDark: string;
    messageAccentColorLight: string;
    messageCardBorderColorDark: string;
    messageCardBorderColorLight: string;
    messageCardColorDark: string;
    messageCardColorLight: string;
    messageInputLabel: string;
    messageResponsePrompt: string;
    messageSurfaceColorDark: string;
    messageSurfaceColorLight: string;
    messageTextColorDark: string;
    messageTextColorLight: string;
    messageTopicId: string;
    messageTopicTitle: string;
    sharedTaskCycleMode: string;
    sharedTaskInputLabel: string;
    sharedTaskInstructions: string;
    sharedTaskKind: string;
    sharedTaskMinimumLength: string;
    sharedTaskPeerReviewEnabled: boolean;
    sharedTaskPeerReviewPrompt: string;
    sharedTaskProjectDeliverable: string;
    sharedTaskProjectGoal: string;
    sharedTaskProjectSteps: string;
    sharedTaskRepeatPolicy: string;
    sharedTaskShowContributions: boolean;
    sharedTaskThreshold: string;
    sharedTaskValidationMode: string;
    slug: string;
    subtopic: string;
    title: string;
    topic: string;
    type: SupportedActivityType;
    probabilityPercent: string;
    slideDirection: string;
    slideDurationSeconds: string;
    text: string;
    toolId: string;
    toolMirrored: boolean;
    toolX: string;
    toolY: string;
    typingSpeed: string;
};
type StartRouteForm = {
    buttonBorderColorDark: string;
    buttonBorderColorLight: string;
    buttonColorDark: string;
    buttonColorLight: string;
    description: string;
    imageDark: string;
    imageLight: string;
    label: string;
};

/**
 * The world graph uses the Rust API seams. Its Settings workspace shell is
 * lifted from the Laravel React source; only navigation and data-loading
 * boundaries are adapted to the standalone runtime.
 */
export function OriginalWorldBuilderPage({
    appearance,
    isAuthenticated,
    onSignedOut,
    settingsAccess,
}: {
    appearance: OriginalAppearance;
    isAuthenticated: boolean;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
    if (!isAuthenticated) {
        return <Navigate replace to="/login" />;
    }

    return (
        <ReactFlowProvider>
            <WorldBuilderContent
                appearance={appearance}
                onSignedOut={onSignedOut}
                settingsAccess={settingsAccess}
            />
        </ReactFlowProvider>
    );
}

function WorldBuilderContent({
    appearance,
    onSignedOut,
    settingsAccess,
}: {
    appearance: OriginalAppearance;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const t = usePlatformTranslation();
    const [settingsMenuQuery, setSettingsMenuQuery] = useState('');
    const accessCapabilities = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(settingsAccess).map(([key, read]) => [
                    key,
                    { delete: false, read, update: false },
                ]),
            ),
        [settingsAccess],
    );
    const navigationSections = useMemo(
        () => settingsSections(t, accessCapabilities, true, settingsMenuQuery),
        [accessCapabilities, settingsMenuQuery, t],
    );
    const query = useMemo(
        () => new URLSearchParams(location.search),
        [location.search],
    );
    const selectedMapId = query.get('map');
    const selectedNodeId = query.get('node');
    const [worldGraph, setWorldGraph] = useState<WorldGraph | null>(null);
    const [editableMap, setEditableMap] = useState<EditableMap | null>(null);
    const [editableNode, setEditableNode] = useState<EditableNode | null>(null);
    const [mapReload, setMapReload] = useState(0);
    const [nodeReload, setNodeReload] = useState(0);
    const [portal, setPortal] = useState<PortalLink | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [createMapOpen, setCreateMapOpen] = useState(false);
    const [importMapOpen, setImportMapOpen] = useState(false);
    const [importWorldOpen, setImportWorldOpen] = useState(false);
    const [worldDetailsOpen, setWorldDetailsOpen] = useState(false);
    const [duplicateMapOpen, setDuplicateMapOpen] = useState(false);
    const [sourceCatalogOpen, setSourceCatalogOpen] = useState(false);
    const [reviewQueueOpen, setReviewQueueOpen] = useState(false);
    const [reviewQueue, setReviewQueue] = useState<ReviewQueue | null>(null);
    const [reviewQueueError, setReviewQueueError] = useState<string | null>(
        null,
    );
    const [reviewQueuePage, setReviewQueuePage] = useState(1);

    const selectMap = useCallback(
        (mapId: string) => {
            const next = new URLSearchParams(location.search);
            next.set('panel', 'admin-world-builder');
            next.set('map', mapId);
            next.delete('node');
            navigate(`/settings?${next.toString()}`);
        },
        [location.search, navigate],
    );

    const selectNode = useCallback(
        (mapId: string, nodeId: string) => {
            const next = new URLSearchParams(location.search);
            next.set('panel', 'admin-world-builder');
            next.set('map', mapId);
            next.set('node', nodeId);
            navigate(`/settings?${next.toString()}`);
        },
        [location.search, navigate],
    );

    const loadWorld = useCallback(async () => {
        setError(null);
        const { data, response } = await apiClient.GET('/admin/world-builder');
        if (!response.ok || !data) {
            setWorldGraph(null);
            setError('World Builder is unavailable for this account.');
            return;
        }
        setWorldGraph(data);
    }, []);

    useEffect(() => {
        void loadWorld().catch(() =>
            setError('World Builder is temporarily unavailable.'),
        );
    }, [loadWorld]);

    useEffect(() => {
        if (!selectedMapId) {
            setEditableMap(null);
            return;
        }
        let current = true;
        setEditableMap(null);
        void apiClient
            .GET('/admin/world-builder/maps/{map_id}', {
                params: { path: { map_id: selectedMapId } },
            })
            .then(({ data, response }) => {
                if (!current) {
                    return;
                }
                if (!response.ok || !data) {
                    setError(
                        'The selected map is no longer available for editing.',
                    );
                    return;
                }
                setEditableMap(data);
            })
            .catch(
                () =>
                    current &&
                    setError('The selected map could not be loaded.'),
            );
        return () => {
            current = false;
        };
    }, [mapReload, selectedMapId]);

    useEffect(() => {
        if (!selectedNodeId) {
            setEditableNode(null);
            return;
        }
        let current = true;
        setEditableNode(null);
        void apiClient
            .GET('/admin/world-builder/nodes/{node_id}', {
                params: { path: { node_id: selectedNodeId } },
            })
            .then(({ data, response }) => {
                if (!current) {
                    return;
                }
                if (!response.ok || !data) {
                    setError(
                        'The selected activity graph is no longer available for editing.',
                    );
                    return;
                }
                setEditableNode(data);
            })
            .catch(
                () =>
                    current &&
                    setError(
                        'The selected activity graph could not be loaded.',
                    ),
            );
        return () => {
            current = false;
        };
    }, [nodeReload, selectedNodeId]);

    useEffect(() => {
        if (!reviewQueueOpen) {
            return;
        }
        let current = true;
        setReviewQueue(null);
        setReviewQueueError(null);
        void apiClient
            .GET('/admin/world-builder/review-queue', {
                params: { query: { page: reviewQueuePage, per_page: 4 } },
            })
            .then(({ data, response }) => {
                if (!current) {
                    return;
                }
                if (!response.ok || !data) {
                    setReviewQueueError('The review queue could not be loaded.');
                    return;
                }
                setReviewQueue(data);
            })
            .catch(() => {
                if (current) {
                    setReviewQueueError('The review queue could not be loaded.');
                }
            });
        return () => {
            current = false;
        };
    }, [reviewQueueOpen, reviewQueuePage]);

    const reviewCount =
        worldGraph?.maps.reduce(
            (total, map) => total + map.review_count,
            0,
        ) ?? 0;

    if (error && !worldGraph) {
        return <WorldBuilderStatus message={error} />;
    }
    if (!worldGraph) {
        return <WorldBuilderStatus message="Loading World Builder…" />;
    }

    return (
        <main
            className="settings-surface h-svh min-h-0 overflow-hidden bg-[var(--settings-content-background)] text-slate-950 dark:text-slate-100"
            data-wl-id="settings.world-builder"
            style={settingsWorkspaceStyle(appearance)}
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <SettingsTopBar
                    menuQuery={settingsMenuQuery}
                    onSearchChange={setSettingsMenuQuery}
                />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <aside className="flex shrink-0 flex-col border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] lg:w-72 lg:border-r lg:border-b-0">
                        <SettingsSidebarNavigation
                            activePanel="admin-world-builder"
                            sections={navigationSections}
                        />
                        <SettingsCornerNavigation onSignedOut={onSignedOut} />
                    </aside>
                    <div className="min-h-0 flex-1 overflow-hidden bg-[var(--settings-content-background)]">
                        <SettingsNestedWorkspace
                            contentClassName="p-0 sm:p-0"
                            sidebar={
                                <SettingsSectionNavigation
                                    activeSection="graph"
                                    ariaLabel="World builder sections"
                                    items={worldBuilderSections}
                                    onChange={() => undefined}
                                />
                            }
                        >
                <div className="h-full min-h-0 overflow-auto bg-slate-100 px-4 py-4 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
            <header className="mx-auto mb-4 flex max-w-[1600px] flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div>
                    <Link
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                        to="/settings"
                    >
                        <ArrowLeft className="size-4" />
                        Settings
                    </Link>
                    <p className="mt-4 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                        World editing
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold">
                        {worldGraph.world.title}
                    </h1>
                </div>
                <p className="hidden max-w-2xl text-sm leading-6 text-slate-600 2xl:block dark:text-slate-300">
                    {worldGraph.world.description}
                </p>
                <div className="flex flex-wrap gap-2 2xl:shrink-0 2xl:justify-end">
                    <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:border-white/20 dark:hover:bg-white/10"
                        data-wl-id="authoring.source-catalog.open"
                        onClick={() => setSourceCatalogOpen(true)}
                        type="button"
                    >
                        Source catalog
                    </button>
                    <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:border-white/20 dark:hover:bg-white/10"
                        data-wl-id="authoring.world-builder.world-details.open"
                        onClick={() => setWorldDetailsOpen(true)}
                        type="button"
                    >
                        Edit world details
                    </button>
                    <button
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/20"
                        onClick={() => {
                            setReviewQueuePage(1);
                            setReviewQueueOpen(true);
                        }}
                        type="button"
                    >
                        Review queue{reviewCount > 0 ? ` (${reviewCount})` : ''}
                    </button>
                    <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:border-white/20 dark:hover:bg-white/10"
                        data-wl-id="authoring.world-builder.map-import.open"
                        onClick={() => setImportMapOpen(true)}
                        type="button"
                    >
                        <FileJson className="mr-1 inline size-4" />
                        Import map
                    </button>
                    <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:border-white/20 dark:hover:bg-white/10"
                        data-wl-id="authoring.world-builder.world-import.open"
                        onClick={() => setImportWorldOpen(true)}
                        type="button"
                    >
                        <FileJson className="mr-1 inline size-4" />
                        Import world
                    </button>
                    <a
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:border-white/20 dark:hover:bg-white/10"
                        data-wl-id="authoring.world-builder.world-export"
                        download
                        href="/api/v1/admin/world-builder/world/export"
                    >
                        <Download className="mr-1 inline size-4" />
                        Export world
                    </a>
                    <a
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:border-white/20 dark:hover:bg-white/10"
                        data-wl-id="authoring.world-builder.world-export-package"
                        download
                        href="/api/v1/admin/world-builder/world/export-package"
                    >
                        <Download className="mr-1 inline size-4" />
                        Export world package
                    </a>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        onClick={() => setCreateMapOpen(true)}
                        type="button"
                    >
                        <Plus className="mr-1 inline size-4" />
                        Create map
                    </button>
                </div>
            </header>
            {error ? (
                <p className="mx-auto mb-3 max-w-[1600px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                    {error}
                </p>
            ) : null}
            <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="min-h-[34rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
                    {editableNode ? (
                        <ActivityGraph
                            document={editableNode}
                            onReload={() =>
                                setNodeReload((current) => current + 1)
                            }
                            onSelectMap={() =>
                                selectedMapId && selectMap(selectedMapId)
                            }
                            worldGraph={worldGraph}
                        />
                    ) : editableMap && selectedMapId ? (
                        <MapAssetSurface
                            document={editableMap}
                            onOpenNode={(nodeId) =>
                                selectNode(selectedMapId, nodeId)
                            }
                            onUpdated={() => {
                                setMapReload((current) => current + 1);
                                void loadWorld();
                            }}
                        />
                    ) : (
                        <WorldGraphCanvas
                            graph={worldGraph}
                            onPortal={setPortal}
                            onSelectMap={selectMap}
                        />
                    )}
                </section>
                <aside className="min-h-[20rem] rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
                    {editableNode && selectedMapId ? (
                        <NodeDetails
                            document={editableNode}
                            onBack={() => selectMap(selectedMapId)}
                        />
                    ) : editableMap && selectedMapId ? (
                        <MapDetails
                            document={editableMap}
                            onDuplicate={() => setDuplicateMapOpen(true)}
                            onUpdated={() => {
                                setMapReload((current) => current + 1);
                                void loadWorld();
                            }}
                            onDeleted={() => {
                                setEditableMap(null);
                                setEditableNode(null);
                                setPortal(null);
                                navigate('/settings?panel=admin-world-builder');
                                void loadWorld();
                            }}
                            onSelectNode={(nodeId) =>
                                selectNode(selectedMapId, nodeId)
                            }
                        />
                    ) : portal ? (
                        <PortalDetails
                            portal={portal}
                            onSelectNode={selectNode}
                        />
                    ) : (
                        <EmptyDetails />
                    )}
                </aside>
            </div>
            {createMapOpen ? (
                <CreateMapDialog
                    onClose={() => setCreateMapOpen(false)}
                    onCreated={(mapId) => {
                        setCreateMapOpen(false);
                        void loadWorld();
                        selectMap(mapId);
                    }}
                />
            ) : null}
            {importMapOpen ? (
                <MapImportDialog
                    onClose={() => setImportMapOpen(false)}
                    onCreated={(mapId) => {
                        setImportMapOpen(false);
                        void loadWorld();
                        selectMap(mapId);
                    }}
                />
            ) : null}
            {importWorldOpen ? (
                <WorldImportDialog
                    onClose={() => setImportWorldOpen(false)}
                    onCreated={(mapIds) => {
                        setImportWorldOpen(false);
                        void loadWorld();
                        if (mapIds[0]) {
                            selectMap(mapIds[0]);
                        }
                    }}
                />
            ) : null}
            {worldDetailsOpen ? (
                <EditWorldDetailsDialog
                    onClose={() => setWorldDetailsOpen(false)}
                    onUpdated={() => void loadWorld()}
                    world={worldGraph.world}
                />
            ) : null}
            {duplicateMapOpen && editableMap ? (
                <DuplicateMapDialog
                    map={editableMap.editable_map.map}
                    onClose={() => setDuplicateMapOpen(false)}
                    onCreated={(mapId) => {
                        setDuplicateMapOpen(false);
                        void loadWorld();
                        selectMap(mapId);
                    }}
                />
            ) : null}
            {sourceCatalogOpen ? (
                <OriginalSourceCatalogDialog
                    onClose={() => setSourceCatalogOpen(false)}
                />
            ) : null}
            {reviewQueueOpen ? (
                <WorldBuilderReviewQueueDialog
                    error={reviewQueueError}
                    onClose={() => setReviewQueueOpen(false)}
                    onOpenActivity={(mapId, nodeId) => {
                        setReviewQueueOpen(false);
                        selectNode(mapId, nodeId);
                    }}
                    onPageChange={setReviewQueuePage}
                    page={reviewQueue}
                />
            ) : null}
                </div>
                        </SettingsNestedWorkspace>
                    </div>
                </div>
            </div>
        </main>
    );
}

function settingsWorkspaceStyle(
    appearance: OriginalAppearance,
): React.CSSProperties {
    const dark = appearance === 'dark';
    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark
            ? 'rgb(45 212 191 / 10%)'
            : 'rgb(15 118 110 / 10%)',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-nested-sidebar-background': dark
            ? 'rgb(5 8 22 / 96%)'
            : 'rgb(248 250 252 / 96%)',
        '--settings-sidebar-background': dark
            ? 'rgb(5 8 22 / 96%)'
            : 'rgb(248 250 252 / 96%)',
    } as React.CSSProperties;
}

function EditWorldDetailsDialog({
    onClose,
    onUpdated,
    world,
}: {
    onClose: () => void;
    onUpdated: () => void;
    world: WorldGraph['world'];
}) {
    const [title, setTitle] = useState(world.title);
    const [description, setDescription] = useState(world.description);
    const [updatedAt, setUpdatedAt] = useState(world.updated_at);
    const [history, setHistory] = useState<WorldDetailsVersionPage | null>(
        null,
    );
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [restoringVersionId, setRestoringVersionId] = useState<string | null>(
        null,
    );

    const loadHistory = useCallback(async (page = 1) => {
        setHistoryLoading(true);
        setHistoryError(false);
        try {
            const { data, response } = await apiClient.GET(
                '/admin/world-builder/world/versions',
                { params: { query: { page, per_page: 1 } } },
            );
            if (!response.ok || !data) {
                throw new Error('The world history could not be loaded.');
            }
            setHistory(data);
        } catch {
            setHistoryError(true);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim()) {
            setError('Add a world title before saving.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/world/details',
                {
                    body: {
                        description: optionalValue(description),
                        title,
                        updated_at: updatedAt,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok) {
                setError(
                    response.status === 400
                        ? 'Use a world title within the shown limits.'
                        : response.status === 409
                          ? 'These world details changed in another session. Close this dialog, reload the World Builder, then apply your changes again.'
                          : 'The world details could not be saved. Refresh the World Builder and try again.',
                );
                return;
            }
            onUpdated();
            onClose();
        } catch {
            setError(
                'The world details could not be saved. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    const restore = async (
        version: components['schemas']['AdminWorldDetailsVersion'],
    ) => {
        if (
            !window.confirm(
                'Restore this world detail version? The current details will be preserved in history.',
            )
        ) {
            return;
        }
        setRestoringVersionId(version.id);
        setHistoryError(false);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/world/versions/{version_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { version_id: version.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('The world version could not be restored.');
            }
            setTitle(data.title);
            setDescription(data.description);
            setUpdatedAt(data.updated_at);
            await loadHistory(history?.page ?? 1);
            onUpdated();
        } catch {
            setHistoryError(true);
        } finally {
            setRestoringVersionId(null);
        }
    };

    return (
        <div
            aria-labelledby="edit-world-details-title"
            aria-modal="true"
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.world-builder.world-details.dialog"
            role="dialog"
        >
            <form
                className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            World Builder
                        </p>
                        <h2
                            className="mt-1 text-xl font-semibold"
                            id="edit-world-details-title"
                        >
                            Edit world details
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Update the author-facing title and description. The
                            canonical world slug stays unchanged.
                        </p>
                    </div>
                    <button
                        aria-label="Close world details"
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        disabled={saving || restoringVersionId !== null}
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                {error ? (
                    <p
                        className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-4">
                    <label className="grid gap-1 text-sm font-medium">
                        Title
                        <input
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                            maxLength={255}
                            onChange={(event) => setTitle(event.target.value)}
                            value={title}
                        />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                        Description
                        <textarea
                            className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            value={description}
                        />
                    </label>
                </div>
                <section className="mt-6 grid gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
                    <div>
                        <h3 className="text-sm font-semibold">
                            Previous versions
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Restoring creates a new version of the current
                            details.
                        </p>
                    </div>
                    {historyLoading ? (
                        <p aria-live="polite" role="status">
                            Loading world history…
                        </p>
                    ) : historyError ? (
                        <p
                            className="text-sm text-red-700 dark:text-red-300"
                            role="status"
                        >
                            World history could not be loaded. Try again.
                        </p>
                    ) : history && history.items.length > 0 ? (
                        <div className="grid gap-2">
                            {history.items.map((version) => (
                                <div
                                    className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-white/10"
                                    key={version.id}
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="text-sm font-medium">
                                            {version.title}
                                        </p>
                                        <time className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatWorldDetailsVersionDate(
                                                version.created_at,
                                            )}
                                        </time>
                                    </div>
                                    <p className="line-clamp-1 text-xs text-slate-600 dark:text-slate-300">
                                        {version.description ||
                                            'No description'}
                                    </p>
                                    <button
                                        className="inline-flex justify-self-end rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-400/10"
                                        disabled={
                                            restoringVersionId !== null || saving
                                        }
                                        onClick={() => void restore(version)}
                                        type="button"
                                    >
                                        <RefreshCw className="mr-1 size-4" />
                                        {restoringVersionId === version.id
                                            ? 'Restoring…'
                                            : 'Restore this version'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            No earlier world details yet. The first update will
                            create one.
                        </p>
                    )}
                    {history && history.last_page > 1 ? (
                        <div className="flex items-center justify-between gap-3">
                            <button
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
                                disabled={historyLoading || history.page <= 1}
                                onClick={() => void loadHistory(history.page - 1)}
                                type="button"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Page {history.page} of {history.last_page}
                            </span>
                            <button
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
                                disabled={
                                    historyLoading ||
                                    history.page >= history.last_page
                                }
                                onClick={() => void loadHistory(history.page + 1)}
                                type="button"
                            >
                                Next
                            </button>
                        </div>
                    ) : null}
                </section>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-white/10"
                        disabled={saving || restoringVersionId !== null}
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        disabled={saving || restoringVersionId !== null}
                        type="submit"
                    >
                        {saving ? 'Saving…' : 'Save details'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function MapDetailsHistoryDialog({
    map,
    onClose,
    onRestored,
}: {
    map: EditableMap['editable_map']['map'];
    onClose: () => void;
    onRestored: (
        restored: components['schemas']['RestoreAdminWorldMapDetailsVersionResponse'],
    ) => void;
}) {
    const [history, setHistory] = useState<MapDetailsVersionPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [restoringVersionId, setRestoringVersionId] = useState<string | null>(
        null,
    );

    const loadHistory = useCallback(
        async (page = 1) => {
            setLoading(true);
            setError(false);
            try {
                const { data, response } = await apiClient.GET(
                    '/admin/world-builder/maps/{map_id}/versions',
                    {
                        params: {
                            path: { map_id: map.id },
                            query: { page, per_page: 4 },
                        },
                    },
                );
                if (!response.ok || !data) {
                    throw new Error('The map history could not be loaded.');
                }
                setHistory(data);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [map.id],
    );

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const restore = async (
        version: components['schemas']['AdminMapDetailsVersion'],
    ) => {
        if (
            !window.confirm(
                'Restore this map detail version? The current details will be preserved in history.',
            )
        ) {
            return;
        }

        setRestoringVersionId(version.id);
        setError(false);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps/{map_id}/versions/{version_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id, version_id: version.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('The map detail version could not be restored.');
            }
            onRestored(data);
            await loadHistory(history?.page ?? 1);
        } catch {
            setError(true);
        } finally {
            setRestoringVersionId(null);
        }
    };

    return (
        <div
            aria-labelledby="map-detail-history-title"
            aria-modal="true"
            className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.world-builder.map-details-history.dialog"
            role="dialog"
        >
            <section className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2
                            className="text-xl font-semibold"
                            id="map-detail-history-title"
                        >
                            Map detail history
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Review earlier map title, description, topic and
                            asset-lock settings. Restoring preserves the current
                            details as a new history entry.
                        </p>
                    </div>
                    <button
                        aria-label="Close map detail history"
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"
                        disabled={restoringVersionId !== null}
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                {loading ? (
                    <p aria-live="polite" className="mt-4" role="status">
                        Loading map history…
                    </p>
                ) : error ? (
                    <p
                        className="mt-4 text-sm text-red-700 dark:text-red-300"
                        role="status"
                    >
                        Map history could not be loaded. Try again.
                    </p>
                ) : history && history.items.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                        {history.items.map((version) => (
                            <div
                                className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-white/10"
                                key={version.id}
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-sm font-medium">
                                        {version.title}
                                    </p>
                                    <time className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatWorldDetailsVersionDate(
                                            version.created_at,
                                        )}
                                    </time>
                                </div>
                                <p className="line-clamp-1 text-xs text-slate-600 dark:text-slate-300">
                                    {version.description || 'No description'}
                                </p>
                                <button
                                    className="inline-flex justify-self-end rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-400/10"
                                    disabled={restoringVersionId !== null}
                                    onClick={() => void restore(version)}
                                    type="button"
                                >
                                    <RefreshCw className="mr-1 size-4" />
                                    {restoringVersionId === version.id
                                        ? 'Restoring…'
                                        : 'Restore this version'}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                        No earlier map details yet. The first update will create
                        one.
                    </p>
                )}
                {history && history.last_page > 1 ? (
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
                            disabled={loading || history.page <= 1}
                            onClick={() => void loadHistory(history.page - 1)}
                            type="button"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Page {history.page} of {history.last_page}
                        </span>
                        <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
                            disabled={
                                loading || history.page >= history.last_page
                            }
                            onClick={() => void loadHistory(history.page + 1)}
                            type="button"
                        >
                            Next
                        </button>
                    </div>
                ) : null}
                <div className="mt-6 flex justify-end">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-white/10"
                        disabled={restoringVersionId !== null}
                        onClick={onClose}
                        type="button"
                    >
                        Close
                    </button>
                </div>
            </section>
        </div>
    );
}

function formatWorldDetailsVersionDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(date);
}

function WorldBuilderReviewQueueDialog({
    error,
    onClose,
    onOpenActivity,
    onPageChange,
    page,
}: {
    error: string | null;
    onClose: () => void;
    onOpenActivity: (mapId: string, nodeId: string) => void;
    onPageChange: (page: number) => void;
    page: ReviewQueue | null;
}) {
    return (
        <div
            aria-labelledby="world-builder-review-queue-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-amber-700 uppercase dark:text-amber-300">
                            World Builder
                        </p>
                        <h2 className="mt-1 text-xl font-semibold" id="world-builder-review-queue-title">
                            Review queue
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Activities changed since their last AI review. Open one to inspect its authored context; this queue never includes learner data.
                        </p>
                    </div>
                    <button
                        aria-label="Close review queue"
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                {error ? (
                    <p className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : !page ? (
                    <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
                        Loading review queue…
                    </p>
                ) : page.items.length === 0 ? (
                    <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100">
                        No editable activities currently need review.
                    </p>
                ) : (
                    <div className="mt-5 grid gap-3">
                        {page.items.map((item) => (
                            <article
                                className="rounded-lg border border-slate-200 p-4 dark:border-white/10"
                                key={item.id}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-medium tracking-[0.14em] text-amber-700 uppercase dark:text-amber-300">
                                            {item.activity_type}
                                        </p>
                                        <h3 className="mt-1 font-semibold">{item.title}</h3>
                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                            {item.map.title} · {item.node.title}
                                        </p>
                                    </div>
                                    <button
                                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                                        onClick={() => onOpenActivity(item.map.id, item.node.id)}
                                        type="button"
                                    >
                                        Open activity graph
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
                {page && page.pagination.last_page > 1 ? (
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm dark:border-white/10">
                        <span>
                            Page {page.pagination.current_page} of {page.pagination.last_page}
                        </span>
                        <div className="flex gap-2">
                            <button
                                className="rounded-md border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20"
                                disabled={page.pagination.current_page === 1}
                                onClick={() => onPageChange(page.pagination.current_page - 1)}
                                type="button"
                            >
                                Previous
                            </button>
                            <button
                                className="rounded-md border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20"
                                disabled={page.pagination.current_page === page.pagination.last_page}
                                onClick={() => onPageChange(page.pagination.current_page + 1)}
                                type="button"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : null}
            </section>
        </div>
    );
}

function CreateMapDialog({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (mapId: string) => void;
}) {
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim()) {
            setError('Add a map title before creating it.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps',
                {
                    body: {
                        description: optionalValue(description),
                        slug: optionalValue(slug),
                        title,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data) {
                setError(
                    response.status === 400
                        ? 'Use a title, a lowercase slug, and a description within the shown limits.'
                        : 'The map could not be created. Refresh the World Builder and try again.',
                );
                return;
            }
            onCreated(data.map_id);
        } catch {
            setError(
                'The map could not be created. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="create-map-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <h2 className="text-xl font-semibold" id="create-map-title">
                    Create world node
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Add a standalone map to this world graph. You can connect
                    portal tiles later.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-4">
                    <ActivityTextField
                        label="Title"
                        onChange={setTitle}
                        value={title}
                    />
                    <ActivityTextField
                        label="Slug"
                        onChange={setSlug}
                        value={slug}
                    />
                    <ActivityTextField
                        label="Description"
                        onChange={setDescription}
                        textarea
                        value={description}
                    />
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950"
                        disabled={saving}
                        type="submit"
                    >
                        {saving ? 'Creating…' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function DuplicateMapDialog({
    map,
    onClose,
    onCreated,
}: {
    map: EditableMap['editable_map']['map'];
    onClose: () => void;
    onCreated: (mapId: string) => void;
}) {
    const [title, setTitle] = useState(`${map.title} copy`);
    const [slug, setSlug] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const duplicate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim()) {
            setError('Add a title for the copied map.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps/{map_id}/duplicate',
                {
                    body: { slug: optionalValue(slug), title },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok || !data) {
                setError(
                    response.status === 400
                        ? 'Use a title and a lowercase unique slug within the shown limits.'
                        : 'The map could not be duplicated. Refresh the World Builder and try again.',
                );
                return;
            }
            onCreated(data.map_id);
        } catch {
            setError(
                'The map could not be duplicated. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="duplicate-map-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void duplicate(event)}
            >
                <h2 className="text-xl font-semibold" id="duplicate-map-title">
                    Duplicate authored map
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Create a new map in this world with its authored activities,
                    routes, MapAssets, and internal connections copied over.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-4">
                    <ActivityTextField
                        label="New map title"
                        onChange={setTitle}
                        value={title}
                    />
                    <ActivityTextField
                        label="Slug (optional)"
                        onChange={setSlug}
                        value={slug}
                    />
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Learner history, map history, review runs, and editor groups
                    are not copied. Activities return to authoring review;
                    portals leaving this map retain their destination.
                </p>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950"
                        disabled={saving}
                        type="submit"
                    >
                        <Copy className="mr-1 inline size-4" />
                        {saving ? 'Duplicating…' : 'Duplicate map'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function WorldBuilderStatus({ message }: { message: string }) {
    return (
        <main className="grid min-h-svh place-items-center bg-slate-100 p-6 text-slate-700 dark:bg-[#0b1117] dark:text-slate-200">
            <p role="status">{message}</p>
        </main>
    );
}

function WorldGraphCanvas({
    graph,
    onPortal,
    onSelectMap,
}: {
    graph: WorldGraph;
    onPortal: (portal: PortalLink | null) => void;
    onSelectMap: (mapId: string) => void;
}) {
    const initialNodes = useMemo<WorldMapNode[]>(
        () =>
            graph.maps.map((map, index) => ({
                id: map.id,
                type: 'map',
                data: { map },
                position: circlePosition(index, graph.maps.length),
            })),
        [graph.maps],
    );
    const initialEdges = useMemo<WorldPortalEdge[]>(
        () =>
            graph.portal_links.map((link) => ({
                id: link.id,
                source: link.source_map_id,
                target: link.target_map_id,
                label: link.label ?? 'Portal',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: link,
                style: { stroke: 'rgb(13 148 136)', strokeWidth: 2 },
            })),
        [graph.portal_links],
    );
    const [nodes, , onNodesChange] = useNodesState<WorldMapNode>(initialNodes);
    const [edges, , onEdgesChange] =
        useEdgesState<WorldPortalEdge>(initialEdges);

    useEffect(() => onPortal(null), [graph, onPortal]);

    return (
        <ReactFlow<WorldMapNode, WorldPortalEdge>
            edges={edges}
            fitView
            minZoom={0.12}
            nodeTypes={{ map: MapGraphCard }}
            nodes={nodes}
            onEdgeClick={(_, edge) => onPortal(edge.data ?? null)}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => onSelectMap(node.id)}
            onEdgesChange={onEdgesChange}
            proOptions={{ hideAttribution: true }}
        >
            <Background gap={20} />
            <Controls />
        </ReactFlow>
    );
}

function MapGraphCard({
    data,
    selected,
}: {
    data: WorldMapNodeData;
    selected: boolean;
}) {
    const { map } = data;
    return (
        <div
            className={`w-56 rounded-xl border bg-slate-50 p-4 text-left shadow-lg dark:border-white/10 dark:bg-slate-950 ${selected ? 'border-teal-500 ring-2 ring-teal-500/25' : 'border-slate-200'}`}
        >
            <Handle position={Position.Left} type="target" />
            <Handle position={Position.Right} type="source" />
            <MapIcon className="size-5 text-teal-700 dark:text-teal-300" />
            <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">
                {map.title}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {map.node_count} tile{map.node_count === 1 ? '' : 's'}
            </p>
            <p
                className={`mt-3 rounded-md px-2 py-1 text-xs font-medium ${map.review_count > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200'}`}
            >
                {map.review_count > 0
                    ? `${map.review_count} activity${map.review_count === 1 ? '' : 'ies'} awaiting review`
                    : 'Activity reviews current'}
            </p>
        </div>
    );
}

function MapAssetSurface({
    document,
    onOpenNode,
    onUpdated,
}: {
    document: EditableMap;
    onOpenNode: (nodeId: string) => void;
    onUpdated: () => void;
}) {
    const { map } = document.editable_map;
    const [selected, setSelected] = useState<EditableMapAsset | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        setCreating(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/maps/{map_id}/assets',
                {
                    body: defaultMapAssetRequest(),
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('create');
            }
            onUpdated();
        } catch {
            setError(
                'The MapAsset could not be added. Check its map access and try again.',
            );
        } finally {
            setCreating(false);
        }
    };

    const choose = (asset: EditableMapAsset) => {
        setSelected(asset);
        setEditorOpen(true);
    };

    return (
        <div
            className="relative min-h-[34rem] overflow-hidden bg-slate-950"
            data-wl-id="authoring.map-asset.surface"
        >
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(94,234,212,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(94,234,212,.12) 1px, transparent 1px)',
                    backgroundSize: '2rem 2rem',
                }}
            />
            <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4">
                <div className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-white shadow-xl backdrop-blur-sm">
                    <p className="text-xs font-medium tracking-[.18em] text-teal-300 uppercase">
                        MapAsset surface
                    </p>
                    <p className="mt-1 text-sm text-white/75">
                        Select an area to edit its learner-facing placement and
                        behavior.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <button
                        className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-white shadow-xl hover:bg-slate-900 disabled:opacity-60"
                        data-wl-id="authoring.map-asset.import.open"
                        disabled={creating || map.map_assets_locked}
                        onClick={() => setImportOpen(true)}
                        type="button"
                    >
                        <FileJson className="size-4" />
                        Import
                    </button>
                    <button
                        className="inline-flex items-center gap-2 rounded-md bg-teal-400 px-3 py-2 text-sm font-semibold text-slate-950 shadow-xl hover:bg-teal-300 disabled:opacity-60"
                        data-wl-id="authoring.map-asset.add"
                        disabled={creating || map.map_assets_locked}
                        onClick={() => void add()}
                        type="button"
                    >
                        <Plus className="size-4" />
                        {creating ? 'Adding…' : 'Add MapAsset'}
                    </button>
                </div>
            </div>
            {map.map_assets_locked ? (
                <p className="absolute top-16 right-4 z-20 rounded-md border border-amber-200/40 bg-amber-950/75 px-3 py-2 text-xs text-amber-100 shadow-lg">
                    The map surface is locked in Map details.
                </p>
            ) : null}
            {error ? (
                <p className="absolute bottom-4 left-4 z-20 rounded-md border border-amber-300/30 bg-amber-950/90 px-3 py-2 text-sm text-amber-100">
                    {error}
                </p>
            ) : null}
            <div className="absolute inset-0">
                {map.map_assets.map((asset) => (
                    <button
                        aria-label={`Edit ${asset.text || 'MapAsset'}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-lg transition outline-none hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-teal-300"
                        data-wl-id={`authoring.map-asset.select.${asset.id}`}
                        key={asset.id}
                        onClick={() => choose(asset)}
                        style={{
                            left: `${asset.x}%`,
                            opacity: asset.opacity,
                            top: `${asset.y}%`,
                            width: `${asset.width}%`,
                            zIndex: asset.z + 10,
                        }}
                        type="button"
                    >
                        <PublicMapAssetVisual
                            backgroundColor={
                                stringValue(asset.visual_config, 'tileColor') ||
                                '#0f766e'
                            }
                            highlighted={selected?.id === asset.id}
                            highlightColor={
                                stringValue(
                                    asset.visual_config,
                                    'highlightColor',
                                ) || '#5eead4'
                            }
                            imageFit={stringValue(
                                asset.visual_config,
                                'imageFit',
                            )}
                            imagePosition={stringValue(
                                asset.visual_config,
                                'imagePosition',
                            )}
                            imageUrl={asset.image_url}
                            label={asset.text}
                        />
                    </button>
                ))}
            </div>
            {map.map_assets.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
                    <div className="max-w-sm rounded-xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-2xl backdrop-blur-sm">
                        <p className="font-semibold">No MapAssets yet</p>
                        <p className="mt-2 text-sm leading-6 text-white/70">
                            Add the first visual area at the center of this map,
                            then select it to configure its image, placement and
                            learner interaction.
                        </p>
                    </div>
                </div>
            ) : null}
            {editorOpen && selected ? (
                <MapAssetEditorDialog
                    asset={selected}
                    mapId={map.id}
                    onClose={() => setEditorOpen(false)}
                    onDeleted={() => {
                        setEditorOpen(false);
                        setSelected(null);
                        onUpdated();
                    }}
                    onOpenNode={onOpenNode}
                    onSaved={() => {
                        setEditorOpen(false);
                        onUpdated();
                    }}
                    sounds={document.sounds}
                />
            ) : null}
            {importOpen ? (
                <MapAssetImportDialog
                    mapId={map.id}
                    onClose={() => setImportOpen(false)}
                    onImported={() => {
                        setImportOpen(false);
                        onUpdated();
                    }}
                />
            ) : null}
        </div>
    );
}

function MapAssetHistoryDialog({
    assetId,
    onClose,
    onRestored,
}: {
    assetId: string;
    onClose: () => void;
    onRestored: (
        restored: components['schemas']['RestoreAdminWorldMapAssetVersionResponse'],
    ) => void;
}) {
    const [history, setHistory] = useState<MapAssetVersionPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [restoringVersionId, setRestoringVersionId] = useState<string | null>(
        null,
    );

    const loadHistory = useCallback(
        async (page = 1) => {
            setLoading(true);
            setError(false);
            try {
                const { data, response } = await apiClient.GET(
                    '/admin/world-builder/assets/{asset_id}/versions',
                    {
                        params: {
                            path: { asset_id: assetId },
                            query: { page, per_page: 4 },
                        },
                    },
                );
                if (!response.ok || !data) {
                    throw new Error('The MapAsset history could not be loaded.');
                }
                setHistory(data);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [assetId],
    );

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const restore = async (
        version: components['schemas']['AdminMapAssetVersion'],
    ) => {
        if (
            !window.confirm(
                'Restore this MapAsset version? The current configuration will be preserved in history.',
            )
        ) {
            return;
        }

        setRestoringVersionId(version.id);
        setError(false);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/assets/{asset_id}/versions/{version_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { asset_id: assetId, version_id: version.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('The MapAsset version could not be restored.');
            }
            onRestored(data);
            await loadHistory(history?.page ?? 1);
        } catch {
            setError(true);
        } finally {
            setRestoringVersionId(null);
        }
    };

    return (
        <div
            aria-labelledby="map-asset-history-title"
            aria-modal="true"
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.map-asset-history.dialog"
            role="dialog"
        >
            <section className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold" id="map-asset-history-title">
                            MapAsset history
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Review earlier learner-facing configuration and restore a version without losing the current state.
                        </p>
                    </div>
                    <button
                        aria-label="Close MapAsset history"
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"
                        disabled={restoringVersionId !== null}
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                {loading ? (
                    <p aria-live="polite" className="mt-4" role="status">
                        Loading MapAsset history…
                    </p>
                ) : error ? (
                    <p
                        className="mt-4 text-sm text-red-700 dark:text-red-300"
                        role="status"
                    >
                        MapAsset history could not be loaded. Try again.
                    </p>
                ) : history && history.items.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                        {history.items.map((version) => (
                            <div
                                className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-white/10"
                                key={version.id}
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-sm font-medium">
                                        {version.text || 'Untitled MapAsset'}
                                    </p>
                                    <time className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatWorldDetailsVersionDate(
                                            version.created_at,
                                        )}
                                    </time>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {version.image_url || 'No image'} ·{' '}
                                    {version.interaction_mode || 'default'}
                                </p>
                                <button
                                    className="inline-flex justify-self-end rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-400/10"
                                    disabled={restoringVersionId !== null}
                                    onClick={() => void restore(version)}
                                    type="button"
                                >
                                    <RefreshCw className="mr-1 size-4" />
                                    {restoringVersionId === version.id
                                        ? 'Restoring…'
                                        : 'Restore this version'}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                        No earlier MapAsset configuration yet. The first update
                        will create one.
                    </p>
                )}
                {history && history.last_page > 1 ? (
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
                            disabled={loading || history.page <= 1}
                            onClick={() => void loadHistory(history.page - 1)}
                            type="button"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Page {history.page} of {history.last_page}
                        </span>
                        <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
                            disabled={loading || history.page >= history.last_page}
                            onClick={() => void loadHistory(history.page + 1)}
                            type="button"
                        >
                            Next
                        </button>
                    </div>
                ) : null}
                <div className="mt-6 flex justify-end">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-white/10"
                        disabled={restoringVersionId !== null}
                        onClick={onClose}
                        type="button"
                    >
                        Close
                    </button>
                </div>
            </section>
        </div>
    );
}

function MapAssetEditorDialog({
    asset,
    mapId,
    onClose,
    onDeleted,
    onOpenNode,
    onSaved,
    sounds,
}: {
    asset: EditableMapAsset;
    mapId: string;
    onClose: () => void;
    onDeleted: () => void;
    onOpenNode: (nodeId: string) => void;
    onSaved: () => void;
    sounds: EditableSound[];
}) {
    const [form, setForm] = useState<MapAssetRequest>(() =>
        mapAssetForm(asset),
    );
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [mediaOpen, setMediaOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [hasRestoredVersion, setHasRestoredVersion] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isToggle = form.interaction_mode === 'toggle';

    const close = () => {
        onClose();
        if (hasRestoredVersion) {
            onSaved();
        }
    };

    const set = <Key extends keyof MapAssetRequest>(
        key: Key,
        value: MapAssetRequest[Key],
    ) => setForm((current) => ({ ...current, [key]: value }));
    const updateToggleState = (
        state: 'first' | 'second',
        key: 'imageUrl' | 'x' | 'y' | 'width',
        value: string | number | null,
    ) => {
        setForm((current) => ({
            ...current,
            interaction_config: {
                ...(current.interaction_config ?? {}),
                states: {
                    ...objectValue(current.interaction_config, 'states'),
                    [state]: {
                        ...toggleState(current.interaction_config, state),
                        [key]: value,
                    },
                },
            },
        }));
    };
    const updateSound = (
        trigger: MapAssetSoundTrigger,
        change: Partial<MapAssetInteractionSound>,
    ) => {
        setForm((current) => ({
            ...current,
            visual_config: {
                ...(current.visual_config ?? {}),
                sounds: {
                    ...objectValue(current.visual_config, 'sounds'),
                    [trigger]: {
                        ...mapAssetInteractionSound(
                            current.visual_config ?? {},
                            trigger,
                        ),
                        ...change,
                    },
                },
            },
        }));
    };
    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/assets/{asset_id}',
                {
                    body: form,
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { asset_id: asset.id },
                    },
                },
            );
            if (!response.ok) throw new Error('save');
            onSaved();
        } catch {
            setError(
                'The MapAsset could not be saved. Check every numeric field and toggle-state placement.',
            );
        } finally {
            setSaving(false);
        }
    };
    const remove = async () => {
        if (
            !window.confirm(
                'Delete this MapAsset? Its route data will be removed, while its legacy activity tile remains unattached.',
            )
        )
            return;
        setDeleting(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/assets/{asset_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { asset_id: asset.id },
                    },
                },
            );
            if (!response.ok) throw new Error('delete');
            onDeleted();
        } catch {
            setError('The MapAsset could not be deleted.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div
            aria-labelledby="map-asset-editor-title"
            aria-modal="true"
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4"
            role="dialog"
        >
            <div className="mx-auto my-5 w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-white/10">
                    <div>
                        <p className="text-xs font-medium tracking-[.18em] text-teal-700 uppercase dark:text-teal-300">
                            MapAsset editor
                        </p>
                        <h2
                            className="mt-1 text-xl font-semibold"
                            id="map-asset-editor-title"
                        >
                            {asset.text || 'MapAsset'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            The same learner-facing surface controls used by the
                            source World Builder.
                        </p>
                    </div>
                    <button
                        aria-label="Close MapAsset editor"
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={close}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </header>
                <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <form
                        className="grid gap-5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void save();
                        }}
                    >
                        <fieldset>
                            <legend className="font-semibold">
                                Learner interaction
                            </legend>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Choose the clear behavior learners encounter on
                                this map.
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {(
                                    [
                                        [
                                            'focusable',
                                            'Normal MapAsset',
                                            'Opens its learner panel and activities.',
                                        ],
                                        [
                                            'decorative',
                                            'Not focusable',
                                            'Stays visible without opening a learner panel.',
                                        ],
                                        [
                                            'hide_on_hover',
                                            'Hide on hover',
                                            'Lets underlying objects be selected.',
                                        ],
                                        [
                                            'toggle',
                                            'Change state on click',
                                            'Switches two positioned state sprites.',
                                        ],
                                    ] as const
                                ).map(([mode, label, description]) => (
                                    <label
                                        className={`rounded-lg border p-3 text-sm ${form.interaction_mode === mode ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10' : 'border-slate-200 dark:border-white/10'}`}
                                        key={mode}
                                    >
                                        <input
                                            checked={
                                                form.interaction_mode === mode
                                            }
                                            className="mr-2 accent-teal-700"
                                            name="interaction"
                                            onChange={() =>
                                                set('interaction_mode', mode)
                                            }
                                            type="radio"
                                        />{' '}
                                        <span className="font-medium">
                                            {label}
                                        </span>
                                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                                            {description}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                        {!isToggle ? (
                            <fieldset className="border-t border-slate-200 pt-5 dark:border-white/10">
                                <legend className="font-semibold">Image</legend>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                    Use an existing reusable visual or a
                                    source-compatible URL.
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <input
                                        aria-label="MapAsset image URL"
                                        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-white/20"
                                        onChange={(event) =>
                                            set(
                                                'image_url',
                                                event.target.value || null,
                                            )
                                        }
                                        value={form.image_url ?? ''}
                                    />
                                    <button
                                        className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10"
                                        onClick={() => setMediaOpen(true)}
                                        type="button"
                                    >
                                        Select existing
                                    </button>
                                </div>
                            </fieldset>
                        ) : (
                            <ToggleStateFields
                                form={form}
                                onChange={updateToggleState}
                            />
                        )}
                        <fieldset className="border-t border-slate-200 pt-5 dark:border-white/10">
                            <legend className="font-semibold">
                                Image framing
                            </legend>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <SelectField
                                    label="Fit"
                                    onChange={(value) =>
                                        set('visual_config', {
                                            ...(form.visual_config ?? {}),
                                            imageFit: value,
                                        })
                                    }
                                    options={[
                                        ['contain', 'Show full image'],
                                        ['cover', 'Fill frame and crop'],
                                    ]}
                                    value={
                                        stringValue(
                                            form.visual_config,
                                            'imageFit',
                                        ) || 'contain'
                                    }
                                />
                                <SelectField
                                    label="Anchor"
                                    onChange={(value) =>
                                        set('visual_config', {
                                            ...(form.visual_config ?? {}),
                                            imagePosition: value,
                                        })
                                    }
                                    options={[
                                        ['center', 'Center'],
                                        ['top', 'Top'],
                                        ['right', 'Right'],
                                        ['bottom', 'Bottom'],
                                        ['left', 'Left'],
                                    ]}
                                    value={
                                        stringValue(
                                            form.visual_config,
                                            'imagePosition',
                                        ) || 'center'
                                    }
                                />
                            </div>
                        </fieldset>
                        <fieldset className="border-t border-slate-200 pt-5 dark:border-white/10">
                            <legend className="font-semibold">
                                MapAsset sounds
                            </legend>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Optional effects for pointer, selection, and
                                confirmed unlock interactions. Sounds come from
                                the managed reusable library.
                            </p>
                            <div className="mt-3 grid gap-3">
                                {mapAssetSoundTriggers.map(
                                    ({ description, key, label }) => {
                                        const configured =
                                            mapAssetInteractionSound(
                                                form.visual_config ?? {},
                                                key,
                                            );
                                        const selected = sounds.find(
                                            (sound) =>
                                                sound.id === configured.soundId,
                                        );
                                        return (
                                            <div
                                                className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end dark:border-white/10"
                                                key={key}
                                            >
                                                <div>
                                                    <label className="flex items-start gap-2 text-sm font-medium">
                                                        <input
                                                            aria-label={`Enable ${label} sound`}
                                                            checked={
                                                                configured.enabled
                                                            }
                                                            className="mt-1 accent-teal-700"
                                                            onChange={(event) =>
                                                                updateSound(
                                                                    key,
                                                                    {
                                                                        enabled:
                                                                            event
                                                                                .currentTarget
                                                                                .checked,
                                                                    },
                                                                )
                                                            }
                                                            type="checkbox"
                                                        />
                                                        <span>
                                                            {label}
                                                            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                                                                {description}
                                                            </span>
                                                        </span>
                                                    </label>
                                                    <select
                                                        aria-label={`${label} sound`}
                                                        className="mt-3 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-white/20"
                                                        onChange={(event) =>
                                                            updateSound(key, {
                                                                soundId:
                                                                    event
                                                                        .currentTarget
                                                                        .value ||
                                                                    null,
                                                            })
                                                        }
                                                        value={
                                                            configured.soundId ??
                                                            ''
                                                        }
                                                    >
                                                        <option value="">
                                                            Select reusable sound
                                                        </option>
                                                        {sounds.map((sound) => (
                                                            <option
                                                                key={sound.id}
                                                                value={sound.id}
                                                            >
                                                                {sound.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button
                                                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
                                                    disabled={!selected}
                                                    onClick={() => {
                                                        if (selected) {
                                                            previewMapAssetSound(selected);
                                                        }
                                                    }}
                                                    type="button"
                                                >
                                                    Preview
                                                </button>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        </fieldset>
                        <fieldset className="border-t border-slate-200 pt-5 dark:border-white/10">
                            <legend className="font-semibold">Placement</legend>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                X and Y use map percentages. Higher Z appears
                                above lower layers.
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {(
                                    [
                                        [
                                            'position_x',
                                            'Horizontal position (X)',
                                            0,
                                            100,
                                        ],
                                        [
                                            'position_y',
                                            'Vertical position (Y)',
                                            0,
                                            100,
                                        ],
                                        [
                                            'position_z',
                                            'Layer depth (Z)',
                                            -10000,
                                            10000,
                                        ],
                                        ['width', 'MapAsset size', 1, 100],
                                        ['opacity', 'Opacity', 0, 1],
                                    ] as const
                                ).map(([key, label, min, max]) => (
                                    <NumberField
                                        key={key}
                                        label={label}
                                        max={max}
                                        min={min}
                                        onChange={(value) => set(key, value)}
                                        value={form[key]}
                                    />
                                ))}
                            </div>
                            <label className="mt-4 flex items-start gap-2 text-sm">
                                <input
                                    checked={form.locked}
                                    className="mt-1 accent-teal-700"
                                    onChange={(event) =>
                                        set('locked', event.target.checked)
                                    }
                                    type="checkbox"
                                />
                                <span>
                                    <strong className="block">
                                        Lock MapAsset position
                                    </strong>
                                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                                        Prevents movement on the map surface;
                                        numeric placement stays editable.
                                    </span>
                                </span>
                            </label>
                        </fieldset>
                        <fieldset className="border-t border-slate-200 pt-5 dark:border-white/10">
                            <legend className="font-semibold">Map text</legend>
                            <label
                                className="mt-3 block text-sm"
                                htmlFor="map-asset-text"
                            >
                                Label shown on the MapAsset
                                <input
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20"
                                    id="map-asset-text"
                                    maxLength={255}
                                    onChange={(event) =>
                                        set('text', event.target.value || null)
                                    }
                                    value={form.text ?? ''}
                                />
                            </label>
                        </fieldset>
                        {error ? (
                            <p
                                className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100"
                                role="alert"
                            >
                                {error}
                            </p>
                        ) : null}
                        <div className="flex flex-wrap justify-between gap-3">
                            <span className="flex gap-2">
                                <button
                                    className="rounded-md px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-200 dark:hover:bg-teal-400/10"
                                    disabled={deleting || saving}
                                    onClick={() => setHistoryOpen(true)}
                                    type="button"
                                >
                                    Previous versions
                                </button>
                                <a
                                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                                    data-wl-id="authoring.map-asset.export"
                                    href={`/api/v1/admin/world-builder/assets/${asset.id}/export`}
                                >
                                    Export MapAsset
                                </a>
                                <a
                                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                                    data-wl-id="authoring.map-asset.export-package"
                                    download
                                    href={`/api/v1/admin/world-builder/assets/${asset.id}/export-package`}
                                >
                                    Export MapAsset package
                                </a>
                                <button
                                    className="rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-300/10"
                                    disabled={deleting || saving}
                                    onClick={() => void remove()}
                                    type="button"
                                >
                                    {deleting ? 'Deleting…' : 'Delete MapAsset'}
                                </button>
                            </span>
                            <span className="flex gap-2">
                                <button
                                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                                    onClick={close}
                                    type="button"
                                >
                                    Cancel
                                </button>
                                <button
                                    className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950"
                                    disabled={saving || deleting}
                                    type="submit"
                                >
                                    {saving ? 'Saving…' : 'Save MapAsset'}
                                </button>
                            </span>
                        </div>
                    </form>
                    <aside className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white dark:border-white/10">
                        <p className="text-xs font-medium tracking-[.18em] text-teal-300 uppercase">
                            Live learner preview
                        </p>
                        <div className="mt-4 grid min-h-64 place-items-center rounded-lg border border-white/10 bg-slate-900 p-5">
                            <div
                                style={{
                                    width: `${form.width}%`,
                                    maxWidth: '13rem',
                                    opacity: form.opacity,
                                }}
                            >
                                <PublicMapAssetVisual
                                    backgroundColor={
                                        stringValue(
                                            form.visual_config,
                                            'tileColor',
                                        ) || '#0f766e'
                                    }
                                    highlighted
                                    imageFit={stringValue(
                                        form.visual_config,
                                        'imageFit',
                                    )}
                                    imagePosition={stringValue(
                                        form.visual_config,
                                        'imagePosition',
                                    )}
                                    imageUrl={form.image_url}
                                    label={form.text}
                                />
                            </div>
                        </div>
                        {asset.node_id ? (
                            <button
                                className="mt-4 w-full rounded-md border border-teal-300/50 px-3 py-2 text-sm font-medium text-teal-100 hover:bg-teal-300/10"
                                onClick={() => onOpenNode(asset.node_id!)}
                                type="button"
                            >
                                Open activities and rules
                            </button>
                        ) : (
                            <p className="mt-4 text-sm leading-6 text-white/70">
                                This legacy MapAsset has no attached activity
                                tile.
                            </p>
                        )}
                    </aside>
                </div>
                {mediaOpen ? (
                    <MediaPicker
                        onClose={() => setMediaOpen(false)}
                        onSelect={(media) => {
                            set('image_url', media.url);
                            setMediaOpen(false);
                        }}
                    />
                ) : null}
                {historyOpen ? (
                    <MapAssetHistoryDialog
                        assetId={asset.id}
                        onClose={() => setHistoryOpen(false)}
                        onRestored={(restored) => {
                            setForm({
                                image_url: restored.image_url,
                                text: restored.text,
                                position_x: restored.position_x,
                                position_y: restored.position_y,
                                position_z: restored.position_z,
                                width: restored.width,
                                opacity: restored.opacity,
                                locked: restored.locked,
                                interaction_mode: restored.interaction_mode,
                                interaction_config: restored.interaction_config,
                                visual_config: restored.visual_config,
                                sound_config: restored.sound_config,
                            });
                            setHasRestoredVersion(true);
                        }}
                    />
                ) : null}
            </div>
        </div>
    );
}

function ToggleStateFields({
    form,
    onChange,
}: {
    form: MapAssetRequest;
    onChange: (
        state: 'first' | 'second',
        key: 'imageUrl' | 'x' | 'y' | 'width',
        value: string | number | null,
    ) => void;
}) {
    return (
        <fieldset className="border-t border-slate-200 pt-5 dark:border-white/10">
            <legend className="font-semibold">State sprites</legend>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                A learner click switches between these independently positioned
                images.
            </p>
            <div className="mt-4 grid gap-4">
                {(['first', 'second'] as const).map((state, index) => {
                    const values = toggleState(form.interaction_config, state);
                    return (
                        <section
                            className="rounded-lg border border-slate-200 p-4 dark:border-white/10"
                            key={state}
                        >
                            <h3 className="font-medium">State {index + 1}</h3>
                            <label className="mt-3 block text-sm">
                                State image URL
                                <input
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20"
                                    onChange={(event) =>
                                        onChange(
                                            state,
                                            'imageUrl',
                                            event.target.value || null,
                                        )
                                    }
                                    value={stringValue(values, 'imageUrl')}
                                />
                            </label>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <NumberField
                                    label="Horizontal position (X)"
                                    max={100}
                                    min={0}
                                    onChange={(value) =>
                                        onChange(state, 'x', value)
                                    }
                                    value={numberValue(values, 'x', 50)}
                                />
                                <NumberField
                                    label="Vertical position (Y)"
                                    max={100}
                                    min={0}
                                    onChange={(value) =>
                                        onChange(state, 'y', value)
                                    }
                                    value={numberValue(values, 'y', 50)}
                                />
                                <NumberField
                                    label="Size %"
                                    max={100}
                                    min={1}
                                    onChange={(value) =>
                                        onChange(state, 'width', value)
                                    }
                                    value={numberValue(values, 'width', 14)}
                                />
                            </div>
                        </section>
                    );
                })}
            </div>
        </fieldset>
    );
}

export function MediaPicker({
    onClose,
    onSelect,
}: {
    onClose: () => void;
    onSelect: (asset: MediaAsset) => void;
}) {
    const [page, setPage] = useState<MediaAssetPage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [uploading, setUploading] = useState(false);
    const upload = useRef<HTMLInputElement>(null);
    useEffect(() => {
        let current = true;
        void apiClient
            .GET('/admin/media-assets', {
                params: {
                    query: {
                        page: 1,
                        per_page: 12,
                        q: query.trim() || undefined,
                    },
                },
            })
            .then(({ data, response }) => {
                if (!current) return;
                if (!response.ok || !data) {
                    setError(
                        'Reusable visuals are unavailable for this account.',
                    );
                    return;
                }
                setPage(data);
            })
            .catch(
                () =>
                    current &&
                    setError(
                        'Reusable visuals are unavailable for this account.',
                    ),
            );
        return () => {
            current = false;
        };
    }, [query]);
    const uploadImage = async (file: File | null) => {
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const form = new FormData();
            form.append('file', file);
            const response = await fetch('/api/v1/admin/media-assets', {
                body: form,
                credentials: 'same-origin',
                headers: { 'X-CSRF-Token': token },
                method: 'POST',
            });
            if (!response.ok) throw new Error('upload failed');
            const data = await response.json() as { asset: MediaAsset };
            onSelect(data.asset);
        } catch {
            setError('This image could not be stored. Use a GIF, JPEG, PNG, WebP, or SVG under 5 MiB.');
        } finally {
            setUploading(false);
            if (upload.current) upload.current.value = '';
        }
    };
    return (
        <div
            aria-label="Select existing visual"
            aria-modal="true"
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4"
            role="dialog"
        >
            <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">
                            Select existing visual
                        </h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Selection stores a stable Rust-owned media
                            reference, so this visual is protected from deletion
                            while authored content uses it.
                        </p>
                    </div>
                    <button
                        aria-label="Close media picker"
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input accept="image/gif,image/jpeg,image/png,image/webp,image/svg+xml" className="sr-only" onChange={(event) => void uploadImage(event.currentTarget.files?.[0] ?? null)} ref={upload} type="file" />
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10" disabled={uploading} onClick={() => upload.current?.click()} type="button">{uploading ? 'Uploading…' : 'Upload image'}</button>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Or select a reusable visual below.</p>
                </div>
                <label className="mt-4 grid gap-1 text-sm font-medium">
                    Search reusable visuals
                    <input
                        aria-label="Search reusable visuals"
                        className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20"
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Name, category, or tag"
                        type="search"
                        value={query}
                    />
                </label>
                {error ? (
                    <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
                        {error}
                    </p>
                ) : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {page?.items.map((asset) => (
                            <button
                                className="overflow-hidden rounded-lg border border-slate-200 text-left hover:border-teal-500 dark:border-white/10"
                                key={asset.id}
                                onClick={() => onSelect(asset)}
                                type="button"
                            >
                                <div className="grid aspect-video place-items-center bg-slate-100 dark:bg-slate-900">
                                    <img
                                        alt=""
                                        className="max-h-full max-w-full object-contain"
                                        src={asset.url}
                                    />
                                </div>
                                <span className="block p-3 text-sm font-medium">
                                    {asset.display_name}
                                </span>
                            </button>
                        )) ?? (
                            <p className="col-span-full py-6 text-sm text-slate-500">
                                Loading visuals…
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function defaultMapAssetRequest(): MapAssetRequest {
    return {
        image_url: null,
        interaction_config: {},
        interaction_mode: 'focusable',
        locked: false,
        opacity: 1,
        position_x: 50,
        position_y: 50,
        position_z: 0,
        sound_config: {},
        text: null,
        visual_config: {},
        width: 14,
    };
}

type MapAssetSoundTrigger = 'mouseEnter' | 'click' | 'mouseLeave' | 'unlock';
type MapAssetInteractionSound = { enabled: boolean; soundId: string | null };

const mapAssetSoundTriggers: Array<{
    key: MapAssetSoundTrigger;
    label: string;
    description: string;
}> = [
    {
        key: 'mouseEnter',
        label: 'Mouse enter',
        description: 'Played when the pointer enters this MapAsset.',
    },
    {
        key: 'click',
        label: 'Click',
        description: 'Played when learners click or tap this MapAsset.',
    },
    {
        key: 'mouseLeave',
        label: 'Mouse leave',
        description: 'Played when the pointer leaves this MapAsset.',
    },
    {
        key: 'unlock',
        label: 'Unlock',
        description: 'Played after the server confirms this MapAsset was unlocked.',
    },
];

function mapAssetInteractionSound(
    visualConfig: Record<string, unknown>,
    trigger: MapAssetSoundTrigger,
): MapAssetInteractionSound {
    const config = objectValue(objectValue(visualConfig, 'sounds'), trigger);
    return {
        enabled: config.enabled === true,
        soundId: typeof config.soundId === 'string' ? config.soundId : null,
    };
}

function previewMapAssetSound(sound: EditableSound): void {
    const audio = new Audio(sound.url);
    audio.volume = Math.max(0, Math.min(100, sound.volume)) / 100;
    void audio.play().catch(() => undefined);
}

function mapAssetForm(asset: EditableMapAsset): MapAssetRequest {
    return {
        image_url: asset.image_url,
        interaction_config: asset.interaction_config,
        interaction_mode: asset.interaction_mode,
        locked: asset.locked,
        opacity: asset.opacity,
        position_x: asset.x,
        position_y: asset.y,
        position_z: asset.z,
        sound_config: asset.sound_config,
        text: asset.text,
        visual_config: asset.visual_config,
        width: asset.width,
    };
}
function objectValue(value: unknown, key: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const candidate = (value as Record<string, unknown>)[key];
    return candidate &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate)
        ? (candidate as Record<string, unknown>)
        : {};
}
function stringValue(value: unknown, key: string): string {
    const candidate = objectValue({ value }, 'value')[key];
    return typeof candidate === 'string' ? candidate : '';
}
function numberValue(
    value: Record<string, unknown>,
    key: string,
    fallback: number,
): number {
    const candidate = value[key];
    return typeof candidate === 'number' && Number.isFinite(candidate)
        ? candidate
        : fallback;
}
function toggleState(
    value: unknown,
    state: 'first' | 'second',
): Record<string, unknown> {
    return objectValue(objectValue(value, 'states'), state);
}
function NumberField({
    label,
    max,
    min,
    onChange,
    value,
}: {
    label: string;
    max: number;
    min: number;
    onChange: (value: number) => void;
    value: number;
}) {
    return (
        <label className="block text-sm">
            {label}
            <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20"
                max={max}
                min={min}
                onChange={(event) => onChange(Number(event.target.value))}
                step="any"
                type="number"
                value={value}
            />
        </label>
    );
}
function SelectField({
    label,
    onChange,
    options,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    options: Array<[string, string]>;
    value: string;
}) {
    return (
        <label className="block text-sm">
            {label}
            <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20"
                onChange={(event) => onChange(event.target.value)}
                value={value}
            >
                {options.map(([key, option]) => (
                    <option key={key} value={key}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );
}

function MapNodePlacementDialog({
    node,
    onClose,
    onSaved,
}: {
    node: components['schemas']['AdminNodeSummary'];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [q, setQ] = useState(String(node.position.q));
    const [r, setR] = useState(String(node.position.r));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const position = { q: Number(q), r: Number(r) };
        if (!Number.isInteger(position.q) || !Number.isInteger(position.r)) {
            setError('Use whole-number hex-grid coordinates.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/nodes/{node_id}/position',
                { body: position, params: { header: { 'X-CSRF-Token': token }, path: { node_id: node.id } } },
            );
            if (!response.ok) {
                setError(response.status === 404
                    ? 'That hex tile is already occupied or is no longer available.'
                    : 'The tile position could not be saved. Try again.');
                return;
            }
            onSaved();
        } catch {
            setError('The tile position could not be saved. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };
    return <div aria-labelledby="map-node-placement-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4" role="dialog"><form className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950" onSubmit={(event) => void save(event)}><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold" id="map-node-placement-title">Place map tile</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Set <span className="font-medium">{node.title}</span> on the source hex grid. Saving preserves the outgoing layout in history.</p></div><button aria-label="Close tile placement" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button"><X className="size-5" /></button></div>{error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">{error}</p> : null}<div className="mt-5 grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-medium">Grid q<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" inputMode="numeric" onChange={(event) => setQ(event.target.value)} value={q} /></label><label className="grid gap-1 text-sm font-medium">Grid r<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" inputMode="numeric" onChange={(event) => setR(event.target.value)} value={r} /></label></div><div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10"><button className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save placement'}</button></div></form></div>;
}

/**
 * Lifted from the source map-node dialog. Metadata edits intentionally retain
 * the complete authored visual configuration until its source controls are
 * lifted too, so a title or state change cannot discard opening rules, sound,
 * appearance, or managed-media references.
 */
function OriginalWorldNodeDialog({
    items,
    mapId,
    node,
    nodes,
    onClose,
    onSaved,
    roleOptions,
    sounds,
    tools,
}: {
    items: EditableItem[];
    mapId: string;
    node: NodeSummary | null;
    nodes: NodeSummary[];
    onClose: () => void;
    onSaved: () => void;
    roleOptions: RoleOption[];
    sounds: EditableSound[];
    tools: EditableTool[];
}) {
    const isEditing = node !== null;
    const [title, setTitle] = useState(node?.title ?? '');
    const [slug, setSlug] = useState(node?.slug ?? '');
    const [description, setDescription] = useState(node?.description ?? '');
    const [q, setQ] = useState(String(node?.position.q ?? 0));
    const [r, setR] = useState(String(node?.position.r ?? 0));
    const [state, setState] = useState(node?.state ?? 'available');
    const [visualConfig, setVisualConfig] = useState<Record<string, unknown>>(
        () => node?.visual_config ?? {},
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const request = (): components['schemas']['UpsertAdminWorldNodeRequest'] | null => {
        const positionQ = Number(q);
        const positionR = Number(r);
        if (!title.trim() || !Number.isInteger(positionQ) || !Number.isInteger(positionR)) {
            setError('Enter a title and whole-number hex-grid coordinates.');
            return null;
        }
        return {
            title: title.trim(),
            slug: slug.trim() || null,
            description: description.trim() || null,
            position_q: positionQ,
            position_r: positionR,
            state,
            visual_config: visualConfig,
        };
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const body = request();
        if (!body) return;
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const result = node
                ? await apiClient.PATCH('/admin/world-builder/nodes/{node_id}', { body, params: { header: { 'X-CSRF-Token': token }, path: { node_id: node.id } } })
                : await apiClient.POST('/admin/world-builder/maps/{map_id}/nodes', { body, params: { header: { 'X-CSRF-Token': token }, path: { map_id: mapId } } });
            if (!result.response.ok) {
                setError(result.response.status === 404
                    ? 'That tile position is occupied or the map is no longer editable.'
                    : 'The map tile could not be saved. Check the fields and try again.');
                return;
            }
            onSaved();
        } catch {
            setError('The map tile could not be saved. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    const deleteNode = async () => {
        if (!node || !window.confirm(`Delete "${node.title}" and its MapAsset graph? This cannot be undone.`)) return;
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE('/admin/world-builder/nodes/{node_id}', { params: { header: { 'X-CSRF-Token': token }, path: { node_id: node.id } } });
            if (!response.ok) {
                setError('The map tile could not be deleted. Refresh the map and try again.');
                return;
            }
            onSaved();
        } catch {
            setError('The map tile could not be deleted. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    const resetToolUnlocks = async () => {
        if (!node || !window.confirm(`Lock "${node.title}" for all users again? This resets learner-specific tool unlocks for this tile.`)) return;
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/reset-unlocks', { params: { header: { 'X-CSRF-Token': token }, path: { node_id: node.id } } });
            if (!response.ok) {
                setError('Learner-specific tool unlocks could not be reset. Refresh the map and try again.');
            }
        } catch {
            setError('Learner-specific tool unlocks could not be reset. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return <div aria-labelledby="world-node-dialog-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4" data-wl-id="authoring.world-builder.node.dialog" role="dialog"><form className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950" onSubmit={(event) => void save(event)}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium tracking-[.18em] text-teal-700 uppercase dark:text-teal-300">Map tile</p><h2 className="mt-1 text-xl font-semibold" id="world-node-dialog-title">{isEditing ? 'Edit map tile' : 'Add map tile'}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Set the source tile identity, state and hex position. Edit its visual presentation, availability, and managed interaction sounds below.</p></div><button aria-label="Close map tile dialog" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button"><X className="size-5" /></button></div>{error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}<div className="mt-5 grid gap-4"><ActivityTextField label="Title" onChange={setTitle} value={title} /><ActivityTextField label="Slug" onChange={setSlug} value={slug} /><ActivityTextField label="Description" onChange={setDescription} textarea value={description} /><div className="grid gap-4 sm:grid-cols-3"><label className="grid gap-1 text-sm font-medium">Grid q<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" inputMode="numeric" onChange={(event) => setQ(event.target.value)} value={q} /></label><label className="grid gap-1 text-sm font-medium">Grid r<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" inputMode="numeric" onChange={(event) => setR(event.target.value)} value={r} /></label><label className="grid gap-1 text-sm font-medium">State<select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => setState(event.target.value as typeof state)} value={state}>{[['active', 'Active'], ['available', 'Available'], ['completed', 'Completed'], ['hidden', 'Hidden'], ['hinted', 'Hinted'], ['locked', 'Locked'], ['recommended', 'Recommended']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></div><NodeVisualPresentationFields config={visualConfig} onChange={setVisualConfig} /><NodeAvailabilityFields config={visualConfig} currentNodeId={node?.id ?? null} diagnostics={node?.unlock_diagnostics ?? []} items={items} nodes={nodes} onChange={setVisualConfig} onStateChange={setState} roleOptions={roleOptions} tools={tools} /><NodeSoundFields config={visualConfig} onChange={setVisualConfig} sounds={sounds} />{node ? <section className="mt-5 rounded-lg border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-300/25 dark:bg-amber-300/10"><h3 className="text-sm font-semibold text-amber-950 dark:text-amber-50">Learner-specific unlocks</h3><p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-100">Lock this tile again for every learner by removing only saved tool-derived unlocks. Discovery and support overrides remain unchanged.</p><button className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-500/40 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-200/35 dark:text-amber-50 dark:hover:bg-amber-200/15" disabled={saving} onClick={() => void resetToolUnlocks()} type="button"><LockKeyhole className="size-4" />Lock for all users</button></section> : null}<div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">{node ? <button className="mr-auto inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-60 dark:border-red-400/50 dark:text-red-200 dark:hover:bg-red-400/10" disabled={saving} onClick={() => void deleteNode()} type="button"><Trash2 className="size-4" />Delete map tile</button> : null}<button className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={saving} type="submit">{saving ? 'Saving…' : isEditing ? 'Save map tile' : 'Add map tile'}</button></div></form></div>;
}

function NodeVisualPresentationFields({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
    const [mode, setMode] = useState<'dark' | 'light'>('dark');
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const theme = nodeVisualObject(config[mode]);
    const text = (key: string): string => typeof config[key] === 'string' ? config[key] : '';
    const themeText = (key: string): string => typeof theme[key] === 'string' || typeof theme[key] === 'number' ? String(theme[key]) : '';
    const update = (key: string, value: unknown) => onChange((current) => ({ ...current, [key]: value }));
    const updateTheme = (key: string, value: string) => onChange((current) => ({ ...current, [mode]: { ...nodeVisualObject(current[mode]), [key]: value } }));
    const updateFlag = (key: 'hideEmptySpace' | 'hideImage' | 'hideLabel', checked: boolean) => update(key, checked);
    const themeColors: Array<[string, string]> = [
        ['tileColor', 'Tile color'],
        ['borderColor', 'Border color'],
        ['foregroundColor', 'Foreground color'],
        ['labelColor', 'Label color'],
        ['highlightColor', 'Highlight color'],
        ['highlightBorderColor', 'Highlight border color'],
        ['highlightedLabelColor', 'Highlighted label color'],
    ];
    const themeNumbers: Array<[string, string, number, number]> = [
        ['imageX', 'Image X %', 0, 100],
        ['imageY', 'Image Y %', 0, 100],
        ['imageWidth', 'Image size %', 10, 200],
        ['imageRotation', 'Image rotation', -360, 360],
    ];

    return (
        <section className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10">
            <div>
                <h3 className="text-lg font-semibold">Tile presentation</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">The lifted source controls retain learner-visible text and the dark/light tile appearance. Selecting reusable media keeps its managed reference attached to this tile.</p>
            </div>
            <div className="mt-4 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <ActivityTextField label="MapAsset label" onChange={(value) => update('label', value)} value={text('label')} />
                    <ActivityTextField label="Hover text" onChange={(value) => update('tooltip', value)} value={text('tooltip')} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {([['hideEmptySpace', 'Hide empty space'], ['hideImage', 'Hide image'], ['hideLabel', 'Hide label']] as const).map(([key, label]) => (
                        <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10" key={key}>
                            <input checked={config[key] === true} onChange={(event) => updateFlag(key, event.target.checked)} type="checkbox" />
                            {label}
                        </label>
                    ))}
                </div>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h4 className="font-semibold">Theme appearance</h4>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Edit the authored {mode} appearance.</p>
                        </div>
                        <label className="grid gap-1 text-sm font-medium">Theme
                            <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => setMode(event.target.value as 'dark' | 'light')} value={mode}>
                                <option value="dark">Dark mode</option>
                                <option value="light">Light mode</option>
                            </select>
                        </label>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {themeColors.map(([key, label]) => <ActivityTextField key={key} label={label} onChange={(value) => updateTheme(key, value)} value={themeText(key)} />)}
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <ActivityTextField label={`${mode === 'dark' ? 'Dark' : 'Light'} mode image`} onChange={(value) => updateTheme('imageUrl', value)} onSelectExisting={() => setMediaPickerOpen(true)} value={themeText('imageUrl')} />
                        <div className="grid grid-cols-2 gap-3">
                            {themeNumbers.map(([key, label, min, max]) => (
                                <label className="grid gap-1 text-sm font-medium" key={key}>{label}
                                    <input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" max={max} min={min} onChange={(event) => updateTheme(key, event.target.value)} step="any" type="number" value={themeText(key)} />
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {(['tileOpacity', 'foregroundOpacity', 'labelOpacity', 'highlightOpacity', 'borderOpacity', 'highlightBorderOpacity', 'highlightedLabelOpacity'] as const).map((key) => (
                            <label className="grid gap-1 text-sm font-medium" key={key}>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}
                                <input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" max="100" min="0" onChange={(event) => updateTheme(key, event.target.value)} step="any" type="number" value={themeText(key)} />
                            </label>
                        ))}
                    </div>
                    <div className="mt-4 min-h-28 rounded-lg border p-4" style={{ background: themeText('tileColor') || (mode === 'dark' ? '#253047' : '#dbeafe'), borderColor: themeText('borderColor') || themeText('tileColor'), color: themeText('labelColor') || (mode === 'dark' ? '#fff' : '#0f172a') }}>
                        <p className="font-semibold">{text('label') || 'MapAsset label'}</p>
                        {themeText('imageUrl') && !config.hideImage ? <img alt="Tile visual preview" className="mx-auto mt-2 max-h-20 object-contain" src={themeText('imageUrl')} style={{ transform: `rotate(${themeText('imageRotation') || '0'}deg)`, width: `${themeText('imageWidth') || '100'}%` }} /> : null}
                    </div>
                </div>
            </div>
            {mediaPickerOpen ? <MediaPicker onClose={() => setMediaPickerOpen(false)} onSelect={(asset) => { updateTheme('imageUrl', asset.url); setMediaPickerOpen(false); }} /> : null}
        </section>
    );
}

function nodeVisualObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function NodeAvailabilityFields({
    config,
    currentNodeId,
    diagnostics,
    items,
    nodes,
    onChange,
    onStateChange,
    roleOptions,
    tools,
}: {
    config: Record<string, unknown>;
    currentNodeId: string | null;
    diagnostics: components['schemas']['AdminUnlockDiagnostic'][];
    items: EditableItem[];
    nodes: NodeSummary[];
    onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
    onStateChange: React.Dispatch<React.SetStateAction<NodeState>>;
    roleOptions: RoleOption[];
    tools: EditableTool[];
}) {
    const reveal = nodeVisualObject(config.reveal);
    const unlock = nodeVisualObject(config.unlock);
    const schedule = nodeVisualObject(config.schedule);
    const revealEnabled = reveal.enabled === true;
    const unlockEnabled = unlock.enabled === true;
    const requiredNodeIds = Array.isArray(unlock.requiredNodeIds)
        ? unlock.requiredNodeIds.filter((value): value is string => typeof value === 'string')
        : [];
    const operator = (value: unknown): 'and' | 'or' => value === 'or' ? 'or' : 'and';
    const updateReveal = (enabled: boolean) => {
        onStateChange((current) => enabled ? 'hidden' : current === 'hidden' ? 'available' : current);
        onChange((current) => ({
            ...current,
            hideEmptySpace: enabled ? true : current.hideEmptySpace,
            reveal: { ...nodeVisualObject(current.reveal), enabled },
        }));
    };
    const updateRevealTool = (toolId: string) => onChange((current) => ({
        ...current,
        reveal: { ...nodeVisualObject(current.reveal), toolId },
    }));
    const updateUnlock = (changes: Record<string, unknown>) => {
        onChange((current) => {
            const next = { ...nodeVisualObject(current.unlock), ...changes };
            const withoutRules = { ...next };
            delete withoutRules.rules;
            const rules = nodeUnlockRules(withoutRules, nodeVisualObject(current.schedule));
            return {
                ...current,
                unlock: rules ? { ...withoutRules, rules } : withoutRules,
            };
        });
    };
    const updateSchedule = (key: 'lockAt' | 'unlockAt', value: string) => {
        onChange((current) => {
            const nextSchedule = { ...nodeVisualObject(current.schedule), [key]: value };
            const currentUnlock = nodeVisualObject(current.unlock);
            const withoutRules = { ...currentUnlock };
            delete withoutRules.rules;
            const rules = nodeUnlockRules(withoutRules, nextSchedule);
            return {
                ...current,
                schedule: nextSchedule,
                unlock: rules ? { ...withoutRules, rules } : withoutRules,
            };
        });
    };
    const updateUnlockEnabled = (enabled: boolean) => {
        onStateChange((current) => enabled ? 'locked' : current === 'locked' ? 'available' : current);
        updateUnlock({ enabled });
    };
    const item = nodeVisualObject(unlock.item);
    const tool = nodeVisualObject(unlock.tool);

    return (
        <section className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10" data-wl-id="authoring.world-builder.node.availability">
            <div>
                <h3 className="text-lg font-semibold">Availability &amp; rules</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Keep learner-facing availability server-owned while configuring discovery, prerequisites and optional schedule boundaries.</p>
            </div>
            <fieldset className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <legend className="px-1 font-semibold">Discovery</legend>
                <label className="flex items-start gap-3 text-sm font-medium">
                    <input checked={revealEnabled} className="mt-1" onChange={(event) => updateReveal(event.currentTarget.checked)} type="checkbox" />
                    <span>Hide until revealed with a tool<span className="mt-1 block text-xs font-normal leading-5 text-slate-500">Learners must equip the chosen tool and use it at this hidden tile position.</span></span>
                </label>
                <label className="mt-4 grid gap-1 text-sm font-medium">Reveal tool
                    <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!revealEnabled} onChange={(event) => updateRevealTool(event.currentTarget.value)} value={typeof reveal.toolId === 'string' ? reveal.toolId : ''}>
                        <option value="">Select a tool</option>
                        {tools.map((candidate) => <option key={candidate.id} value={candidate.slug}>{candidate.title}</option>)}
                    </select>
                </label>
            </fieldset>
            <fieldset className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <legend className="px-1 font-semibold">Unlocking</legend>
                <label className="flex items-start gap-3 text-sm font-medium">
                    <input checked={unlockEnabled} className="mt-1" onChange={(event) => updateUnlockEnabled(event.currentTarget.checked)} type="checkbox" />
                    <span>Use unlock rules for this tile<span className="mt-1 block text-xs font-normal leading-5 text-slate-500">Learners cannot open it until the configured rule evaluates to true.</span></span>
                </label>
                <div className="mt-4 grid gap-4 rounded-lg bg-slate-50 p-4 dark:bg-white/5">
                    <label className="grid gap-1 text-sm font-medium">Combine node and tool rules with
                        <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!unlockEnabled} onChange={(event) => updateUnlock({ topOperator: operator(event.currentTarget.value) })} value={operator(unlock.topOperator)}>
                            <option value="and">AND — all groups must pass</option>
                            <option value="or">OR — any group can pass</option>
                        </select>
                    </label>
                    <div className="grid gap-2">
                        <label className="grid gap-1 text-sm font-medium">Completed-node rule
                            <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!unlockEnabled} onChange={(event) => updateUnlock({ nodeOperator: operator(event.currentTarget.value) })} value={operator(unlock.nodeOperator)}>
                                <option value="and">All selected tiles completed</option>
                                <option value="or">Any selected tile completed</option>
                            </select>
                        </label>
                        <select aria-label="Add completed-node condition" className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!unlockEnabled} onChange={(event) => { if (event.currentTarget.value) updateUnlock({ requiredNodeIds: requiredNodeIds.includes(event.currentTarget.value) ? requiredNodeIds : [...requiredNodeIds, event.currentTarget.value] }); }} value="">
                            <option value="">Add completed-node condition</option>
                            {nodes.filter((candidate) => candidate.id !== currentNodeId).map((candidate) => <option disabled={requiredNodeIds.includes(candidate.id)} key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
                        </select>
                        <div className="flex flex-wrap gap-2">
                            {requiredNodeIds.length === 0 ? <span className="text-xs text-slate-500">No completed-node conditions yet.</span> : null}
                            {requiredNodeIds.map((nodeId) => <button className="rounded-full border border-teal-700/30 bg-teal-50 px-3 py-1 text-xs text-teal-800 hover:bg-teal-100 disabled:opacity-60 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-200 dark:hover:bg-teal-300/20" disabled={!unlockEnabled} key={nodeId} onClick={() => updateUnlock({ requiredNodeIds: requiredNodeIds.filter((candidate) => candidate !== nodeId) })} type="button">{nodes.find((candidate) => candidate.id === nodeId)?.title ?? 'Unavailable tile'} ×</button>)}
                        </div>
                    </div>
                    <label className="grid gap-1 text-sm font-medium">Learner role condition
                        <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!unlockEnabled} onChange={(event) => updateUnlock({ roleSlug: event.currentTarget.value })} value={typeof unlock.roleSlug === 'string' ? unlock.roleSlug : ''}>
                            <option value="">No role condition</option>
                            {roleOptions.map((role) => <option key={role.slug} value={role.slug}>{role.name}</option>)}
                        </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="flex items-start gap-3 text-sm font-medium"><input checked={item.enabled === true} disabled={!unlockEnabled} onChange={(event) => updateUnlock({ item: { ...item, enabled: event.currentTarget.checked } })} type="checkbox" /><span>Require item possession<span className="mt-1 block text-xs font-normal text-slate-500">Entering does not consume it.</span></span></label>
                            <label className="mt-3 grid gap-1 text-sm font-medium">Unlock item
                                <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!unlockEnabled || item.enabled !== true} onChange={(event) => updateUnlock({ item: { ...item, itemId: event.currentTarget.value } })} value={typeof item.itemId === 'string' ? item.itemId : ''}>
                                    <option value="">Select an item</option>
                                    {items.map((candidate) => <option key={candidate.id} value={candidate.slug}>{candidate.title}</option>)}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="flex items-start gap-3 text-sm font-medium"><input checked={tool.enabled === true} disabled={!unlockEnabled} onChange={(event) => updateUnlock({ tool: { ...tool, enabled: event.currentTarget.checked } })} type="checkbox" /><span>Require tool use<span className="mt-1 block text-xs font-normal text-slate-500">Learners use the chosen tool on this locked tile.</span></span></label>
                            <label className="mt-3 grid gap-1 text-sm font-medium">Unlock tool
                                <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!unlockEnabled || tool.enabled !== true} onChange={(event) => updateUnlock({ tool: { ...tool, toolId: event.currentTarget.value } })} value={typeof tool.toolId === 'string' ? tool.toolId : ''}>
                                    <option value="">Select a tool</option>
                                    {tools.map((candidate) => <option key={candidate.id} value={candidate.slug}>{candidate.title}</option>)}
                                </select>
                            </label>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-medium">Unlock not before
                            <input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-white/20" disabled={!unlockEnabled} onChange={(event) => updateSchedule('unlockAt', event.currentTarget.value)} type="datetime-local" value={nodeDateTimeInputValue(schedule.unlockAt)} />
                            <span className="text-xs font-normal leading-5 text-slate-500">Optional condition; the rule passes at or after this UTC time.</span>
                        </label>
                        <label className="grid gap-1 text-sm font-medium">Lock after
                            <input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => updateSchedule('lockAt', event.currentTarget.value)} type="datetime-local" value={nodeDateTimeInputValue(schedule.lockAt)} />
                            <span className="text-xs font-normal leading-5 text-slate-500">Optional hard lock at this UTC time.</span>
                        </label>
                    </div>
                </div>
            </fieldset>
            {diagnostics.length > 0 ? <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-50" data-wl-id="authoring.world-builder.node.unlock-diagnostics"><h4 className="font-semibold">Check this opening path</h4><p className="mt-1 text-sm leading-6">This tile depends on locked places without an authored opening condition:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{diagnostics.map((diagnostic) => <li key={diagnostic.id}>{diagnostic.title}</li>)}</ul><p className="mt-3 text-sm leading-6">A Learning Support opening can still make a place available when needed.</p></section> : null}
        </section>
    );
}

function NodeSoundFields({
    config,
    onChange,
    sounds,
}: {
    config: Record<string, unknown>;
    onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
    sounds: EditableSound[];
}) {
    const updateSound = (
        trigger: MapAssetSoundTrigger,
        change: Partial<MapAssetInteractionSound>,
    ) => onChange((current) => ({
        ...current,
        sounds: {
            ...objectValue(current, 'sounds'),
            [trigger]: {
                ...mapAssetInteractionSound(current, trigger),
                ...change,
            },
        },
    }));

    return (
        <section className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10" data-wl-id="authoring.world-builder.node.sounds">
            <h3 className="text-lg font-semibold">Interaction sounds</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Select managed reusable sounds for the source tile’s four interaction moments. Learners receive only published sound URLs.</p>
            <div className="mt-4 grid gap-3">
                {mapAssetSoundTriggers.map(({ description, key, label }) => {
                    const configured = mapAssetInteractionSound(config, key);
                    const selected = sounds.find((sound) => sound.id === configured.soundId);
                    return (
                        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end dark:border-white/10" key={key}>
                            <div>
                                <label className="flex items-start gap-2 text-sm font-medium">
                                    <input aria-label={`Enable ${label} sound`} checked={configured.enabled} className="mt-1 accent-teal-700" onChange={(event) => updateSound(key, { enabled: event.currentTarget.checked })} type="checkbox" />
                                    <span>{label}<span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{description.replace('this MapAsset', 'this map tile')}</span></span>
                                </label>
                                <select aria-label={`${label} sound`} className="mt-3 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-white/20" onChange={(event) => updateSound(key, { soundId: event.currentTarget.value || null })} value={configured.soundId ?? ''}>
                                    <option value="">Select reusable sound</option>
                                    {sounds.map((sound) => <option key={sound.id} value={sound.id}>{sound.name}</option>)}
                                </select>
                            </div>
                            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10" disabled={!selected} onClick={() => selected && previewMapAssetSound(selected)} type="button">Preview</button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function nodeDateTimeInputValue(value: unknown): string {
    if (typeof value !== 'string') return '';
    const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return match?.[1] ?? '';
}

function nodeUnlockRules(unlock: Record<string, unknown>, schedule: Record<string, unknown>): Record<string, unknown> | undefined {
    const rules: Record<string, unknown>[] = [];
    const requiredNodeIds = Array.isArray(unlock.requiredNodeIds)
        ? unlock.requiredNodeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [];
    if (requiredNodeIds.length > 0) {
        rules.push({ operator: unlock.nodeOperator === 'or' ? 'or' : 'and', rules: requiredNodeIds.map((nodeId) => ({ nodeId, type: 'node_completed' })), type: 'group' });
    }
    const tool = nodeVisualObject(unlock.tool);
    if (tool.enabled === true && typeof tool.toolId === 'string' && tool.toolId) rules.push({ type: 'tool_used' });
    const item = nodeVisualObject(unlock.item);
    if (item.enabled === true && typeof item.itemId === 'string' && item.itemId) rules.push({ itemId: item.itemId, type: 'item_owned' });
    if (typeof unlock.roleSlug === 'string' && unlock.roleSlug) rules.push({ roleSlug: unlock.roleSlug, type: 'role_has' });
    if (typeof schedule.unlockAt === 'string' && schedule.unlockAt) rules.push({ type: 'time_after' });
    if (unlock.enabled !== true || rules.length === 0) return undefined;
    return rules.length === 1 ? rules[0] : { operator: unlock.topOperator === 'or' ? 'or' : 'and', rules, type: 'group' };
}

const hexDirections = [
    { q: 1, r: 0, label: 'east', rotation: 0 },
    { q: 1, r: -1, label: 'north-east', rotation: -60 },
    { q: 0, r: -1, label: 'north-west', rotation: -120 },
    { q: -1, r: 0, label: 'west', rotation: 180 },
    { q: -1, r: 1, label: 'south-west', rotation: 120 },
    { q: 0, r: 1, label: 'south-east', rotation: 60 },
] as const;

function MapNodeSwapControls({
    node,
    nodes,
    onSwapped,
}: {
    node: components['schemas']['AdminNodeSummary'];
    nodes: components['schemas']['AdminNodeSummary'][];
    onSwapped: () => void;
}) {
    const [swapping, setSwapping] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const swap = async (direction: (typeof hexDirections)[number]) => {
        const neighbor = nodes.find((candidate) => candidate.position.q === node.position.q + direction.q && candidate.position.r === node.position.r + direction.r);
        if (!neighbor) return;
        setSwapping(direction.label);
        setError(false);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH('/admin/world-builder/nodes/{node_id}/swap', { body: { q: direction.q, r: direction.r }, params: { header: { 'X-CSRF-Token': token }, path: { node_id: node.id } } });
            if (!response.ok) throw new Error('swap unavailable');
            onSwapped();
        } catch {
            setError(true);
        } finally {
            setSwapping(null);
        }
    };
    const neighbors = hexDirections.filter((direction) => nodes.some((candidate) => candidate.position.q === node.position.q + direction.q && candidate.position.r === node.position.r + direction.r));
    if (neighbors.length === 0) return null;
    return <div className="border-t border-slate-200 px-3 py-2 dark:border-white/10"><p className="text-xs text-slate-500 dark:text-slate-400">Swap with neighboring hex tile</p><div className="mt-1 flex flex-wrap gap-1">{neighbors.map((direction) => { const neighbor = nodes.find((candidate) => candidate.position.q === node.position.q + direction.q && candidate.position.r === node.position.r + direction.r)!; return <button aria-label={`Swap ${node.title} with ${neighbor.title} ${direction.label}`} className="grid size-7 place-items-center rounded-full border border-teal-700/35 text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-300/35 dark:text-teal-300 dark:hover:bg-teal-300/10" data-wl-id={`authoring.map-node-swap.${node.id}.${direction.q}.${direction.r}`} disabled={swapping !== null} key={direction.label} onClick={() => void swap(direction)} title={`Swap with ${neighbor.title} ${direction.label}`} type="button"><ArrowRight className="size-4" style={{ transform: `rotate(${direction.rotation}deg)` }} /></button>; })}</div>{error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300" role="status">The adjacent tiles could not be swapped. Refresh the map and try again.</p> : null}</div>;
}

function MapNodeInsertControls({
    node,
    nodes,
    onInserted,
}: {
    node: components['schemas']['AdminNodeSummary'];
    nodes: components['schemas']['AdminNodeSummary'][];
    onInserted: () => void;
}) {
    const [inserting, setInserting] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const insert = async (direction: (typeof hexDirections)[number]) => {
        const neighbor = nodes.find((candidate) => candidate.position.q === node.position.q + direction.q && candidate.position.r === node.position.r + direction.r);
        if (!neighbor) return;
        setInserting(direction.label);
        setError(false);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/insert-map-asset', { body: { direction: { q: direction.q, r: direction.r }, asset: defaultMapAssetRequest() }, params: { header: { 'X-CSRF-Token': token }, path: { node_id: node.id } } });
            if (!response.ok) throw new Error('insertion unavailable');
            onInserted();
        } catch {
            setError(true);
        } finally {
            setInserting(null);
        }
    };
    const directions = hexDirections.filter((direction) => nodes.some((candidate) => candidate.position.q === node.position.q + direction.q && candidate.position.r === node.position.r + direction.r) && node.id < nodes.find((candidate) => candidate.position.q === node.position.q + direction.q && candidate.position.r === node.position.r + direction.r)!.id);
    if (directions.length === 0) return null;
    return <div className="border-t border-slate-200 px-3 py-2 dark:border-white/10"><p className="text-xs text-slate-500 dark:text-slate-400">Insert a MapAsset between adjacent hex tiles</p><div className="mt-1 flex flex-wrap gap-1">{directions.map((direction) => { const neighbor = nodes.find((candidate) => candidate.position.q === node.position.q + direction.q && candidate.position.r === node.position.r + direction.r)!; return <button aria-label={`Insert MapAsset between ${node.title} and ${neighbor.title}`} className="grid size-7 place-items-center rounded-full border border-teal-700/35 text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-300/35 dark:text-teal-300 dark:hover:bg-teal-300/10" data-wl-id={`authoring.map-node-insert.${node.id}.${direction.q}.${direction.r}`} disabled={inserting !== null} key={direction.label} onClick={() => void insert(direction)} title={`Insert between ${node.title} and ${neighbor.title}`} type="button"><Plus className="size-4" /></button>; })}</div>{error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300" role="status">The MapAsset could not be inserted. Refresh the map and try again.</p> : null}</div>;
}

function MapLayoutHistoryDialog({ map, onClose, onRestored }: { map: EditableMap['editable_map']['map']; onClose: () => void; onRestored: () => void }) {
    const [history, setHistory] = useState<MapLayoutVersionPage | null>(null);
    const [preview, setPreview] = useState<MapLayoutPreviewPage | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState<string | null>(null);
    const load = useCallback(async (page = 1) => {
        setLoading(true); setError(false);
        try {
            const { data, response } = await apiClient.GET('/admin/world-builder/maps/{map_id}/layout-versions', { params: { path: { map_id: map.id }, query: { page, per_page: 6 } } });
            if (!response.ok || !data) throw new Error('history unavailable');
            setHistory(data);
        } catch { setError(true); } finally { setLoading(false); }
    }, [map.id]);
    useEffect(() => { void load(); }, [load]);
    const showPreview = async (id: string) => {
        try {
            const { data, response } = await apiClient.GET('/admin/world-builder/maps/{map_id}/layout-versions/{version_id}/preview', { params: { path: { map_id: map.id, version_id: id }, query: { page: 1, per_page: 24 } } });
            if (!response.ok || !data) throw new Error('preview unavailable');
            setPreview(data);
        } catch { setError(true); }
    };
    const restore = async (id: string) => {
        if (!window.confirm('Restore this tile layout? The current layout will be preserved in history.')) return;
        setRestoring(id); setError(false);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/admin/world-builder/maps/{map_id}/layout-versions/{version_id}/restore', { params: { header: { 'X-CSRF-Token': token }, path: { map_id: map.id, version_id: id } } });
            if (!response.ok) throw new Error('restore unavailable');
            onRestored(); await load(history?.page ?? 1);
        } catch { setError(true); } finally { setRestoring(null); }
    };
    return <div aria-labelledby="map-layout-history-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4" data-wl-id="authoring.world-builder.map-layout-history.dialog" role="dialog"><section className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold" id="map-layout-history-title">Tile layout history</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Review source hex-grid positions before restoring them. Restoring first preserves the current layout.</p></div><button aria-label="Close tile layout history" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10" disabled={restoring !== null} onClick={onClose} type="button"><X className="size-5" /></button></div>{loading ? <p className="mt-4" role="status">Loading tile layout history…</p> : error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300" role="status">Tile layout history could not be loaded. Try again.</p> : history?.items.length ? <div className="mt-4 grid gap-2">{history.items.map((version) => <div className="rounded-md border border-slate-200 p-3 dark:border-white/10" key={version.id}><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-medium">{version.node_count} tile{version.node_count === 1 ? '' : 's'}</p><time className="text-xs text-slate-500 dark:text-slate-400">{formatWorldDetailsVersionDate(version.created_at)}</time></div><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{version.restorable ? 'Ready to restore.' : 'Not restorable because tile membership changed.'}</p><div className="mt-2 flex gap-2"><button className="rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-400/10" onClick={() => void showPreview(version.id)} type="button">Preview positions</button><button className="rounded-md px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-400/10" disabled={!version.restorable || restoring !== null} onClick={() => void restore(version.id)} type="button">{restoring === version.id ? 'Restoring…' : 'Restore layout'}</button></div></div>)}</div> : <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No earlier tile layouts yet. Moving a tile will create one.</p>}{history && history.last_page > 1 ? <div className="mt-4 flex items-center justify-between"><button className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-white/20" disabled={loading || history.page <= 1} onClick={() => void load(history.page - 1)} type="button">Previous</button><span className="text-xs text-slate-500">Page {history.page} of {history.last_page}</span><button className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-white/20" disabled={loading || history.page >= history.last_page} onClick={() => void load(history.page + 1)} type="button">Next</button></div> : null}{preview ? <section className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10"><div className="flex items-center justify-between"><h3 className="font-semibold">Saved positions</h3><button className="text-sm text-teal-700 hover:underline dark:text-teal-300" onClick={() => setPreview(null)} type="button">Close preview</button></div><div className="mt-3 grid gap-2">{preview.items.map((item) => <p className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-white/10" key={item.node_id}><span className="font-medium">{item.title}</span>: saved ({item.position.q}, {item.position.r}){item.current_position ? ` · current (${item.current_position.q}, ${item.current_position.r})` : ' · Removed node'}</p>)}</div></section> : null}<div className="mt-6 flex justify-end"><button className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10" disabled={restoring !== null} onClick={onClose} type="button">Close</button></div></section></div>;
}

function MapDetails({
    document,
    onDuplicate,
    onDeleted,
    onUpdated,
    onSelectNode,
}: {
    document: EditableMap;
    onDuplicate: () => void;
    onDeleted: () => void;
    onUpdated: () => void;
    onSelectNode: (nodeId: string) => void;
}) {
    const { map } = document.editable_map;
    const [editOpen, setEditOpen] = useState(false);
    const [visualsOpen, setVisualsOpen] = useState(false);
    const [layoutHistoryOpen, setLayoutHistoryOpen] = useState(false);
    const [placementNode, setPlacementNode] = useState<components['schemas']['AdminNodeSummary'] | null>(null);
    const [nodeDialog, setNodeDialog] = useState<components['schemas']['AdminNodeSummary'] | 'create' | null>(null);
    const [accessOpen, setAccessOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [preflightOpen, setPreflightOpen] = useState(false);

    const deleteMap = async () => {
        setDeleteError(null);
        setDeleting(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/maps/{map_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setDeleteError(
                    'The map could not be deleted. Refresh the World Builder and try again.',
                );
                return;
            }
            onDeleted();
        } catch {
            setDeleteError(
                'The map could not be deleted. Check your connection and try again.',
            );
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                Map
            </p>
            <h2 className="mt-2 text-xl font-semibold">{map.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {map.description || 'No description yet.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
                <Detail label="Slug" value={map.slug} />
                <Detail label="Tiles" value={String(map.node_count)} />
            </dl>
            <button
                className="mt-5 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                onClick={() => setEditOpen(true)}
                type="button"
            >
                Edit map details
            </button>
            <button
                className="mt-3 block rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10"
                data-wl-id="authoring.map-visuals.open"
                onClick={() => setVisualsOpen(true)}
                type="button"
            >
                Configure map visuals
            </button>
            <button
                className="mt-3 block rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10"
                data-wl-id="authoring.map-layout-history.open"
                onClick={() => setLayoutHistoryOpen(true)}
                type="button"
            >
                Tile layout history
            </button>
            <div className="mt-3">
                <ContentAuthoringDialog
                    mapId={map.id}
                    mapTitle={map.title}
                    onApplied={onUpdated}
                />
            </div>
            <button
                className="mt-3 block rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10"
                data-wl-id="authoring.map-node-create.open"
                onClick={() => setNodeDialog('create')}
                type="button"
            >
                <Plus className="mr-1 inline size-4" />
                Add map tile
            </button>
            <button
                className="mt-3 block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                onClick={onDuplicate}
                type="button"
            >
                <Copy className="mr-1 inline size-4" />
                Duplicate map
            </button>
            <a
                className="mt-3 block rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                href={`/api/v1/admin/world-builder/maps/${map.id}/export`}
            >
                Export map
            </a>
            <a
                className="mt-3 block rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                download
                href={`/api/v1/admin/world-builder/maps/${map.id}/export-package`}
            >
                Export map package
            </a>
            <button
                className="mt-3 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                onClick={() => setPreflightOpen(true)}
                type="button"
            >
                Validate map export
            </button>
            {document.can_manage_map_access ? (
                <button
                    className="mt-3 block rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10"
                    onClick={() => setAccessOpen(true)}
                    type="button"
                >
                    Manage map access
                </button>
            ) : null}
            <section className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
                <h3 className="text-sm font-semibold">MapAssets</h3>
                <div className="mt-3 grid gap-2">
                    {map.nodes.map((node) => (
                        <div className="rounded-lg border border-slate-200 dark:border-white/10" key={node.id}>
                            <button className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => onSelectNode(node.id)} type="button"><span className="block font-medium">{node.title}</span><span className="text-xs text-slate-500 dark:text-slate-400">{node.activity_review_count} activities awaiting review</span></button>
                            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs dark:border-white/10"><span className="text-slate-500 dark:text-slate-400">Hex ({node.position.q}, {node.position.r})</span><span className="flex items-center gap-3"><button className="font-medium text-teal-700 hover:underline dark:text-teal-300" data-wl-id={`authoring.map-node-edit.${node.id}`} onClick={() => setNodeDialog(node)} type="button">Edit tile</button><button className="font-medium text-teal-700 hover:underline dark:text-teal-300" data-wl-id={`authoring.map-node-position.${node.id}`} onClick={() => setPlacementNode(node)} type="button">Place tile</button></span></div>
                            <MapNodeSwapControls node={node} nodes={map.nodes} onSwapped={onUpdated} />
                            <MapNodeInsertControls node={node} nodes={map.nodes} onInserted={onUpdated} />
                        </div>
                    ))}
                </div>
            </section>
            {document.can_delete_world_maps ? (
                <section className="mt-6 border-t border-red-200 pt-4 dark:border-red-400/30">
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                        Delete map
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Remove this map and all of its authored tiles and
                        learning state.
                    </p>
                    <button
                        className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-400/50 dark:text-red-200 dark:hover:bg-red-400/10"
                        onClick={() => setDeleteOpen(true)}
                        type="button"
                    >
                        <Trash2 className="size-4" />
                        Delete map
                    </button>
                </section>
            ) : null}
            {deleteOpen ? (
                <div
                    aria-labelledby="delete-map-title"
                    aria-modal="true"
                    className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
                    role="dialog"
                >
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                        <h2
                            className="text-xl font-semibold"
                            id="delete-map-title"
                        >
                            Delete world map?
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            This removes the map, its tiles, activities, portal
                            links and learner progress for those tiles. This
                            cannot be undone.
                        </p>
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-100">
                            <span className="font-semibold">{map.title}</span>
                            <span className="mt-1 block text-red-800 dark:text-red-200/80">
                                {map.node_count} tile
                                {map.node_count === 1 ? '' : 's'} will be
                                deleted with this map.
                            </span>
                        </div>
                        {deleteError ? (
                            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                                {deleteError}
                            </p>
                        ) : null}
                        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                            <button
                                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                                disabled={deleting}
                                onClick={() => setDeleteOpen(false)}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 dark:bg-red-500 dark:text-slate-950 dark:hover:bg-red-400"
                                disabled={deleting}
                                onClick={() => void deleteMap()}
                                type="button"
                            >
                                <Trash2 className="size-4" />
                                {deleting ? 'Deleting…' : 'Delete world map'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {editOpen ? (
                <EditMapDetailsDialog
                    document={document}
                    onClose={() => setEditOpen(false)}
                    onRestored={onUpdated}
                    onSaved={() => {
                        setEditOpen(false);
                        onUpdated();
                    }}
                />
            ) : null}
            {visualsOpen ? (
                <MapVisualsDialog
                    document={document}
                    onClose={() => setVisualsOpen(false)}
                    onSaved={() => {
                        setVisualsOpen(false);
                        onUpdated();
                    }}
                />
            ) : null}
            {layoutHistoryOpen ? <MapLayoutHistoryDialog map={map} onClose={() => setLayoutHistoryOpen(false)} onRestored={onUpdated} /> : null}
            {placementNode ? <MapNodePlacementDialog node={placementNode} onClose={() => setPlacementNode(null)} onSaved={() => { setPlacementNode(null); onUpdated(); }} /> : null}
            {nodeDialog ? <OriginalWorldNodeDialog items={document.items} key={nodeDialog === 'create' ? 'create' : nodeDialog.id} mapId={map.id} node={nodeDialog === 'create' ? null : nodeDialog} nodes={map.nodes} onClose={() => setNodeDialog(null)} onSaved={() => { setNodeDialog(null); onUpdated(); }} roleOptions={document.role_options} sounds={document.sounds} tools={document.tools} /> : null}
            {accessOpen ? (
                <EditMapAccessDialog
                    document={document}
                    onClose={() => setAccessOpen(false)}
                    onUpdated={() => {
                        setAccessOpen(false);
                        onUpdated();
                    }}
                />
            ) : null}
            {preflightOpen ? (
                <MapExportPreflightDialog
                    onClose={() => setPreflightOpen(false)}
                />
            ) : null}
        </div>
    );
}

function MapExportPreflightDialog({ onClose }: { onClose: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<MapExportPreflight | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    const check = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!file) {
            setError('Choose a JSON export file first.');
            return;
        }
        setChecking(true);
        setError(null);
        setResult(null);
        const body = new FormData();
        body.append('manifest', file);
        try {
            const token = await getCsrfToken();
            const response = await fetch(
                '/api/v1/admin/world-builder/map-exports/preflight',
                {
                    body,
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-Token': token },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as MapExportPreflight;
            if (!response.ok) {
                throw new Error('The manifest could not be checked.');
            }
            setResult(payload);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The manifest could not be checked.',
            );
        } finally {
            setChecking(false);
        }
    };

    return (
        <div
            aria-labelledby="map-export-preflight-title"
            aria-modal="true"
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void check(event)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">World Builder</p>
                        <h2 className="mt-1 text-xl font-semibold" id="map-export-preflight-title">Validate map export</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Check a JSON export without creating or changing any content.</p>
                    </div>
                    <button aria-label="Close map export validation" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="size-5" /></button>
                </div>
                <label className="mt-5 block text-sm font-medium">
                    JSON export file
                    <input accept=".json,application/json,text/plain" className="mt-2 block w-full text-sm" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); setResult(null); }} type="file" />
                </label>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{file?.name ?? 'No file selected.'}</p>
                {error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}
                {result ? (
                    <section className="mt-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10" role="status">
                        <p className="font-medium">{result.summary}</p>
                        <p className="mt-2 text-slate-600 dark:text-slate-300">{result.counts.nodes} nodes · {result.counts.activities} activities · {result.counts.mapAssets} MapAssets · {result.counts.portalTargets} portals · {result.counts.mediaReferences} media references</p>
                        {result.errors.map((message) => <p className="mt-2 text-red-700 dark:text-red-300" key={message}>{message}</p>)}
                        {result.warnings.map((message) => <p className="mt-2 text-amber-700 dark:text-amber-300" key={message}>{message}</p>)}
                    </section>
                ) : null}
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button">Close</button>
                    <button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={checking} type="submit"><FileJson className="size-4" />{checking ? 'Checking…' : 'Check manifest'}</button>
                </div>
            </form>
        </div>
    );
}

function MapImportDialog({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (mapId: string) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [result, setResult] = useState<MapExportPreflight | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const [importing, setImporting] = useState(false);

    const check = async () => {
        if (!file) {
            setError('Choose a JSON export file first.');
            return;
        }
        setChecking(true);
        setError(null);
        setResult(null);
        const body = new FormData();
        body.append('manifest', file);
        try {
            const token = await getCsrfToken();
            const response = await fetch(
                '/api/v1/admin/world-builder/map-exports/preflight',
                {
                    body,
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-Token': token },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as MapExportPreflight;
            if (!response.ok) {
                throw new Error('The manifest could not be checked.');
            }
            setResult(payload);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The manifest could not be checked.',
            );
        } finally {
            setChecking(false);
        }
    };

    const importMap = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!file || !result?.valid) {
            setError('Check a valid map export before importing.');
            return;
        }
        if (!title.trim()) {
            setError('Add a title for the imported map.');
            return;
        }
        setImporting(true);
        setError(null);
        const body = new FormData();
        body.append('manifest', file);
        body.append('title', title);
        if (slug.trim()) {
            body.append('slug', slug);
        }
        try {
            const token = await getCsrfToken();
            const response = await fetch(
                '/api/v1/admin/world-builder/map-exports/import',
                {
                    body,
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-Token': token },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as { map_id?: string };
            if (!response.ok || !payload.map_id) {
                throw new Error(
                    response.status === 400
                        ? 'This export cannot be imported into the current World. Check its workspace, portal targets, and managed media references.'
                        : 'The map could not be imported. Refresh the World Builder and try again.',
                );
            }
            onCreated(payload.map_id);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The map could not be imported.',
            );
        } finally {
            setImporting(false);
        }
    };

    return (
        <div
            aria-labelledby="map-import-title"
            aria-modal="true"
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.world-builder.map-import.dialog"
            role="dialog"
        >
            <form
                className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void importMap(event)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            World Builder
                        </p>
                        <h2 className="mt-1 text-xl font-semibold" id="map-import-title">
                            Import authored map
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Create a new draft from a validated JSON map export. Learner records, access rules, review history and editor assignments stay outside the transfer.
                        </p>
                    </div>
                    <button aria-label="Close map import" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" disabled={checking || importing} onClick={onClose} type="button"><X className="size-5" /></button>
                </div>
                <label className="mt-5 block text-sm font-medium">
                    JSON export file
                    <input accept=".json,application/json,text/plain" className="mt-2 block w-full text-sm" disabled={checking || importing} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); setResult(null); }} type="file" />
                </label>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{file?.name ?? 'No file selected.'}</p>
                <button className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10" disabled={!file || checking || importing} onClick={() => void check()} type="button"><CircleCheck className="size-4" />{checking ? 'Checking…' : 'Check export'}</button>
                {result ? (
                    <section className="mt-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10" role="status">
                        <p className="font-medium">{result.summary}</p>
                        <p className="mt-2 text-slate-600 dark:text-slate-300">{result.counts.nodes} nodes · {result.counts.activities} activities · {result.counts.mapAssets} MapAssets · {result.counts.portalTargets} portals · {result.counts.mediaReferences} media references</p>
                        {result.errors.map((message) => <p className="mt-2 text-red-700 dark:text-red-300" key={message}>{message}</p>)}
                        {result.warnings.map((message) => <p className="mt-2 text-amber-700 dark:text-amber-300" key={message}>{message}</p>)}
                    </section>
                ) : null}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <ActivityTextField label="Map title" onChange={setTitle} value={title} />
                    <ActivityTextField label="Slug (optional)" onChange={setSlug} value={slug} />
                </div>
                {error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-white/10" disabled={checking || importing} onClick={onClose} type="button">Cancel</button>
                    <button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={!result?.valid || !file || !title.trim() || checking || importing} type="submit"><FileJson className="size-4" />{importing ? 'Importing…' : 'Import map'}</button>
                </div>
            </form>
        </div>
    );
}

function MapAssetImportDialog({
    mapId,
    onClose,
    onImported,
}: {
    mapId: string;
    onClose: () => void;
    onImported: () => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<MapExportPreflight | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const [importing, setImporting] = useState(false);

    const check = async () => {
        if (!file) {
            setError('Choose a JSON MapAsset export first.');
            return;
        }
        setChecking(true);
        setError(null);
        setResult(null);
        const body = new FormData();
        body.append('manifest', file);
        try {
            const response = await fetch(
                `/api/v1/admin/world-builder/maps/${mapId}/asset-exports/preflight`,
                { body, credentials: 'same-origin', method: 'POST' },
            );
            const payload = (await response.json()) as MapExportPreflight;
            if (!response.ok) {
                throw new Error('The MapAsset export could not be checked.');
            }
            setResult(payload);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The MapAsset export could not be checked.',
            );
        } finally {
            setChecking(false);
        }
    };

    const importAsset = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!file || !result?.valid) {
            setError('Check a valid MapAsset export before importing.');
            return;
        }
        setImporting(true);
        setError(null);
        const body = new FormData();
        body.append('manifest', file);
        try {
            const token = await getCsrfToken();
            const response = await fetch(
                `/api/v1/admin/world-builder/maps/${mapId}/asset-exports/import`,
                {
                    body,
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-Token': token },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as { asset_id?: string };
            if (!response.ok || !payload.asset_id) {
                throw new Error(
                    response.status === 400
                        ? 'This export cannot be imported into this map. Check its workspace and managed media references.'
                        : 'The MapAsset could not be imported. Refresh the World Builder and try again.',
                );
            }
            onImported();
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The MapAsset could not be imported.',
            );
        } finally {
            setImporting(false);
        }
    };

    return (
        <div
            aria-labelledby="map-asset-import-title"
            aria-modal="true"
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.map-asset.import.dialog"
            role="dialog"
        >
            <form
                className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void importAsset(event)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            World Builder
                        </p>
                        <h2 className="mt-1 text-xl font-semibold" id="map-asset-import-title">
                            Import authored MapAsset
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Add one fresh MapAsset and its optional activity graph to this map from a validated JSON export. Learner records, portals, permissions, history and media bytes are not transferred.
                        </p>
                    </div>
                    <button aria-label="Close MapAsset import" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" disabled={checking || importing} onClick={onClose} type="button"><X className="size-5" /></button>
                </div>
                <label className="mt-5 block text-sm font-medium">
                    JSON MapAsset export
                    <input accept=".json,application/json,text/plain" className="mt-2 block w-full text-sm" disabled={checking || importing} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); setResult(null); }} type="file" />
                </label>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{file?.name ?? 'No file selected.'}</p>
                <button className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10" disabled={!file || checking || importing} onClick={() => void check()} type="button"><CircleCheck className="size-4" />{checking ? 'Checking…' : 'Check export'}</button>
                {result ? (
                    <section className="mt-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10" role="status">
                        <p className="font-medium">{result.summary}</p>
                        <p className="mt-2 text-slate-600 dark:text-slate-300">{result.counts.nodes} node{result.counts.nodes === 1 ? '' : 's'} · {result.counts.activities} activities · {result.counts.mapAssets} MapAsset · {result.counts.mediaReferences} media references</p>
                        {result.errors.map((message) => <p className="mt-2 text-red-700 dark:text-red-300" key={message}>{message}</p>)}
                        {result.warnings.map((message) => <p className="mt-2 text-amber-700 dark:text-amber-300" key={message}>{message}</p>)}
                    </section>
                ) : null}
                {error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-white/10" disabled={checking || importing} onClick={onClose} type="button">Cancel</button>
                    <button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={!result?.valid || !file || checking || importing} type="submit"><FileJson className="size-4" />{importing ? 'Importing…' : 'Import MapAsset'}</button>
                </div>
            </form>
        </div>
    );
}

function WorldImportDialog({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (mapIds: string[]) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<WorldImportPreflight | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const [importing, setImporting] = useState(false);

    const check = async () => {
        if (!file) {
            setError('Choose a JSON world export first.');
            return;
        }
        setChecking(true);
        setError(null);
        setResult(null);
        const body = new FormData();
        body.append('manifest', file);
        try {
            const response = await fetch(
                '/api/v1/admin/world-builder/world-exports/preflight',
                { body, credentials: 'same-origin', method: 'POST' },
            );
            const payload = (await response.json()) as WorldImportPreflight;
            if (!response.ok) {
                throw new Error('The world bundle could not be checked.');
            }
            setResult(payload);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The world bundle could not be checked.',
            );
        } finally {
            setChecking(false);
        }
    };

    const importWorld = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!file || !result?.valid) {
            setError('Check a valid world export before importing.');
            return;
        }
        setImporting(true);
        setError(null);
        const body = new FormData();
        body.append('manifest', file);
        try {
            const token = await getCsrfToken();
            const response = await fetch(
                '/api/v1/admin/world-builder/world-exports/import',
                {
                    body,
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-Token': token },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as { map_ids?: string[] };
            if (!response.ok || !payload.map_ids?.length) {
                throw new Error(
                    response.status === 400
                        ? 'This world export cannot be imported into the current workspace. Check its workspace, portal targets, and managed media references.'
                        : 'The world could not be imported. Refresh the World Builder and try again.',
                );
            }
            onCreated(payload.map_ids);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The world could not be imported.',
            );
        } finally {
            setImporting(false);
        }
    };

    return (
        <div
            aria-labelledby="world-import-title"
            aria-modal="true"
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.world-builder.world-import.dialog"
            role="dialog"
        >
            <form
                className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void importWorld(event)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            World Builder
                        </p>
                        <h2 className="mt-1 text-xl font-semibold" id="world-import-title">
                            Import authored world
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Create fresh maps from a validated JSON world export. Links between included maps are remapped after every map is populated; learner records, history, access restrictions and editor assignments stay outside the transfer.
                        </p>
                    </div>
                    <button aria-label="Close world import" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" disabled={checking || importing} onClick={onClose} type="button"><X className="size-5" /></button>
                </div>
                <label className="mt-5 block text-sm font-medium">
                    JSON world export
                    <input accept=".json,application/json,text/plain" className="mt-2 block w-full text-sm" disabled={checking || importing} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); setResult(null); }} type="file" />
                </label>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{file?.name ?? 'No file selected.'}</p>
                <button className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10" disabled={!file || checking || importing} onClick={() => void check()} type="button"><CircleCheck className="size-4" />{checking ? 'Checking…' : 'Check export'}</button>
                {result ? (
                    <section className="mt-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10" role="status">
                        <p className="font-medium">{result.summary}</p>
                        <p className="mt-2 text-slate-600 dark:text-slate-300">{result.maps} {result.maps === 1 ? 'map' : 'maps'} ready for transfer.</p>
                        {result.errors.map((message) => <p className="mt-2 text-red-700 dark:text-red-300" key={message}>{message}</p>)}
                    </section>
                ) : null}
                {error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-white/10" disabled={checking || importing} onClick={onClose} type="button">Cancel</button>
                    <button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={!result?.valid || !file || checking || importing} type="submit"><FileJson className="size-4" />{importing ? 'Importing…' : 'Import world'}</button>
                </div>
            </form>
        </div>
    );
}

function EditMapAccessDialog({
    document,
    onClose,
    onUpdated,
}: {
    document: EditableMap;
    onClose: () => void;
    onUpdated: () => void;
}) {
    const { map } = document.editable_map;
    const [accessRoles, setAccessRoles] = useState(map.access_roles);
    const [editingGroupIds, setEditingGroupIds] = useState(
        map.editing_group_ids,
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const toggleRole = (role: string, enabled: boolean) => {
        setAccessRoles((current) => {
            if (enabled) {
                return current.includes(role) ? current : [...current, role];
            }
            const next = current.filter((candidate) => candidate !== role);
            return next.length > 0 ? next : current;
        });
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (accessRoles.length === 0) {
            setError('Choose at least one group that can visit this map.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/maps/{map_id}/access',
                {
                    body: { access_roles: accessRoles },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    response.status === 400
                        ? 'Choose at least one current access group.'
                        : 'Map access could not be saved. Refresh the World Builder and try again.',
                );
                return;
            }
            onUpdated();
        } catch {
            setError(
                'Map access could not be saved. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    const saveEditingGroups = async () => {
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/maps/{map_id}/editing-groups',
                {
                    body: { group_ids: editingGroupIds },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    response.status === 400
                        ? 'Choose only groups you can manage.'
                        : 'Map editor groups could not be saved. Refresh the World Builder and try again.',
                );
                return;
            }
            onUpdated();
        } catch {
            setError(
                'Map editor groups could not be saved. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="edit-map-access-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="max-h-[calc(100svh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <h2
                    className="text-xl font-semibold"
                    id="edit-map-access-title"
                >
                    Access permissions
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Choose which groups may visit this map and the tiles inside
                    it. Configuration remains restricted to authorized admins.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <fieldset className="mt-5 grid gap-3">
                    <legend className="sr-only">Map access groups</legend>
                    {document.access_groups.map((group) => (
                        <label
                            className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10"
                            key={group.slug}
                        >
                            <input
                                checked={accessRoles.includes(group.slug)}
                                className="mt-0.5 size-4 accent-teal-700"
                                onChange={(event) =>
                                    toggleRole(group.slug, event.target.checked)
                                }
                                type="checkbox"
                            />
                            <span>
                                <span className="block font-medium">
                                    {group.label}
                                </span>
                                {group.description ? (
                                    <span className="mt-1 block text-slate-600 dark:text-slate-300">
                                        {group.description}
                                    </span>
                                ) : null}
                            </span>
                        </label>
                    ))}
                </fieldset>
                <section className="mt-6 border-t border-slate-200 pt-5 dark:border-white/10">
                    <h3 className="text-sm font-semibold">Group editors</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Selected groups can configure this map and its tiles,
                        but cannot delete the map.
                    </p>
                    <fieldset className="mt-4 grid gap-3">
                        <legend className="sr-only">Map editor groups</legend>
                        {document.learning_groups.map((group) => (
                            <label
                                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10"
                                key={group.id}
                            >
                                <input
                                    checked={editingGroupIds.includes(group.id)}
                                    className="mt-0.5 size-4 accent-teal-700"
                                    onChange={(event) =>
                                        setEditingGroupIds((current) =>
                                            event.target.checked
                                                ? current.includes(group.id)
                                                    ? current
                                                    : [...current, group.id]
                                                : current.filter(
                                                      (id) => id !== group.id,
                                                  ),
                                        )
                                    }
                                    type="checkbox"
                                />
                                <span>
                                    <span className="block font-medium">
                                        {group.name}
                                    </span>
                                    {group.description ? (
                                        <span className="mt-1 block text-slate-600 dark:text-slate-300">
                                            {group.description}
                                        </span>
                                    ) : null}
                                </span>
                            </label>
                        ))}
                        {document.learning_groups.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-white/20">
                                Create or manage a group in Settings before
                                assigning map editors.
                            </p>
                        ) : null}
                    </fieldset>
                    <button
                        className="mt-4 rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10"
                        disabled={saving}
                        onClick={() => void saveEditingGroups()}
                        type="button"
                    >
                        {saving ? 'Saving…' : 'Save editor groups'}
                    </button>
                </section>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950"
                        disabled={saving}
                        type="submit"
                    >
                        {saving ? 'Saving…' : 'Save access'}
                    </button>
                </div>
            </form>
        </div>
    );
}

const mapVisualSections = [
    {
        id: 'general',
        label: 'General',
        description: 'Overlay, page background and accent color.',
        fields: [
            ['overlay', 'Map overlay'],
            ['pageBackground', 'Map background'],
            ['accentColor', 'Accent'],
        ],
    },
    {
        id: 'titlePanel',
        label: 'Map title panel',
        description: 'The current-map title panel in the top-left corner.',
        fields: [
            ['panelBackground', 'Background'],
            ['panelBorderColor', 'Border'],
            ['panelTextColor', 'Text'],
            ['panelMutedTextColor', 'Muted text'],
        ],
    },
    {
        id: 'sidePanel',
        label: 'MapAsset side panel',
        description: 'The focused MapAsset description panel.',
        fields: [
            ['sidePanelBackground', 'Background'],
            ['sidePanelBorderColor', 'Border'],
            ['sidePanelHeadingColor', 'Heading'],
            ['sidePanelTextColor', 'Text'],
            ['sidePanelMutedTextColor', 'Muted text'],
        ],
    },
    {
        id: 'rightControl',
        label: 'Right control',
        description: 'Inventory, tools and future player controls.',
        fields: [
            ['sideControlBackground', 'Background'],
            ['sideControlBorderColor', 'Border'],
            ['sideControlIconColor', 'Icon'],
            ['sideControlTextColor', 'Text'],
            ['sideControlActiveBackground', 'Active background'],
            ['sideControlActiveIconColor', 'Active icon'],
            ['sideControlActiveTextColor', 'Active text'],
        ],
    },
] as const;

function emptyMapVisualTheme(): MapVisualThemeForm {
    return {
        accentColor: '',
        assets: [],
        imageUrl: '',
        overlay: '',
        pageBackground: '',
        panelBackground: '',
        panelBorderColor: '',
        panelMutedTextColor: '',
        panelTextColor: '',
        sideControlActiveBackground: '',
        sideControlActiveIconColor: '',
        sideControlActiveTextColor: '',
        sideControlBackground: '',
        sideControlBorderColor: '',
        sideControlIconColor: '',
        sideControlTextColor: '',
        sidePanelBackground: '',
        sidePanelBorderColor: '',
        sidePanelHeadingColor: '',
        sidePanelMutedTextColor: '',
        sidePanelTextColor: '',
    };
}

function mapVisualTheme(value: unknown): MapVisualThemeForm {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    const theme = emptyMapVisualTheme();
    for (const key of Object.keys(theme)) {
        if (key === 'assets') continue;
        if (typeof source[key] === 'string') {
            theme[key as Exclude<keyof MapVisualThemeForm, 'assets'>] = source[key] as never;
        }
    }
    if (Array.isArray(source.assets)) {
        theme.assets = source.assets.flatMap((asset) => {
            if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return [];
            const candidate = asset as Record<string, unknown>;
            return [{
                id: typeof candidate.id === 'string' ? candidate.id : crypto.randomUUID(),
                imageUrl: typeof candidate.imageUrl === 'string' ? candidate.imageUrl : '',
                opacity: typeof candidate.opacity === 'number' ? candidate.opacity : 100,
                width: typeof candidate.width === 'number' ? candidate.width : 20,
                x: typeof candidate.x === 'number' ? candidate.x : 50,
                y: typeof candidate.y === 'number' ? candidate.y : 50,
            }];
        });
    }
    return theme;
}

function mapVisualForm(value: unknown): MapVisualForm {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    return {
        dark: mapVisualTheme(source.dark),
        light: mapVisualTheme(source.light),
    };
}

function MapVisualsDialog({
    document,
    onClose,
    onSaved,
}: {
    document: EditableMap;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { map } = document.editable_map;
    const [form, setForm] = useState(() => mapVisualForm(map.background_config));
    const [mode, setMode] = useState<MapVisualMode>('dark');
    const [section, setSection] = useState<'general' | 'titlePanel' | 'sidePanel' | 'rightControl' | 'backgroundImage' | 'assets'>('general');
    const [mediaTarget, setMediaTarget] = useState<{ assetId?: string; mode: MapVisualMode } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const values = form[mode];
    const selectedSection = mapVisualSections.find((candidate) => candidate.id === section);

    const updateTheme = (patch: Partial<MapVisualThemeForm>) => {
        setForm((current) => ({
            ...current,
            [mode]: { ...current[mode], ...patch },
        }));
    };
    const updateAsset = (id: string, patch: Partial<MapVisualAssetForm>) => {
        setForm((current) => ({
            ...current,
            [mode]: {
                ...current[mode],
                assets: current[mode].assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset),
            },
        }));
    };
    const chooseMedia = (asset: MediaAsset) => {
        if (!mediaTarget) return;
        if (mediaTarget.assetId) {
            setForm((current) => ({
                ...current,
                [mediaTarget.mode]: {
                    ...current[mediaTarget.mode],
                    assets: current[mediaTarget.mode].assets.map((layer) => layer.id === mediaTarget.assetId ? { ...layer, imageUrl: asset.url } : layer),
                },
            }));
        } else {
            setForm((current) => ({
                ...current,
                [mediaTarget.mode]: { ...current[mediaTarget.mode], imageUrl: asset.url },
            }));
        }
        setMediaTarget(null);
    };
    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/maps/{map_id}/visuals',
                {
                    body: { background_config: form },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setError(response.status === 400
                    ? 'Use valid colors and image URLs; decorative layers must stay within their allowed bounds.'
                    : 'The map visuals could not be saved. Refresh the World Builder and try again.');
                return;
            }
            onSaved();
        } catch {
            setError('The map visuals could not be saved. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div aria-labelledby="map-visuals-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog">
            <form className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950" onSubmit={(event) => void save(event)}>
                <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold" id="map-visuals-title">Configure map visuals</h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Adapted from the Laravel map configuration: set a complete dark and light learner-facing map scene.</p>
                        </div>
                        <button aria-label="Close map visuals" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button"><X className="size-5" /></button>
                    </div>
                    <div className="mt-4 flex gap-2" role="tablist" aria-label="Map visual mode">
                        {(['dark', 'light'] as const).map((candidate) => <button aria-selected={mode === candidate} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === candidate ? 'bg-teal-700 text-white dark:bg-teal-400 dark:text-slate-950' : 'border border-slate-300 hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10'}`} key={candidate} onClick={() => setMode(candidate)} role="tab" type="button">{candidate === 'dark' ? 'Dark mode' : 'Light mode'}</button>)}
                    </div>
                </div>
                {error ? <p className="mx-5 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">{error}</p> : null}
                <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[13rem_minmax(0,1fr)]">
                    <nav className="border-b border-slate-200 p-3 dark:border-white/10 md:border-r md:border-b-0" aria-label="Map visual sections">
                        {[...mapVisualSections, { id: 'backgroundImage' as const, label: 'Background image', description: 'The main map background image for this mode.' }, { id: 'assets' as const, label: 'Assets', description: 'Decorative map layers placed over the background.' }].map((candidate) => <button className={`mb-1 block w-full rounded-md px-3 py-2 text-left text-sm ${section === candidate.id ? 'bg-teal-50 font-semibold text-teal-950 dark:bg-teal-400/15 dark:text-teal-100' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`} key={candidate.id} onClick={() => setSection(candidate.id)} type="button">{candidate.label}</button>)}
                    </nav>
                    <div className="p-5">
                        {selectedSection ? <><h3 className="text-lg font-semibold">{selectedSection.label}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedSection.description}</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{selectedSection.fields.map(([key, label]) => <label className="grid gap-1 text-sm font-medium" key={key}>{label}<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => updateTheme({ [key]: event.target.value } as Partial<MapVisualThemeForm>)} placeholder="CSS color, gradient, or overlay" value={values[key as Exclude<keyof MapVisualThemeForm, 'assets'>] as string} /></label>)}</div><MapVisualPreview theme={values} /></> : null}
                        {section === 'backgroundImage' ? <><h3 className="text-lg font-semibold">Background image</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">The main map background image for {mode} mode.</p><label className="mt-5 grid gap-1 text-sm font-medium">Image URL<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => updateTheme({ imageUrl: event.target.value })} value={values.imageUrl} /></label><button className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" onClick={() => setMediaTarget({ mode })} type="button">Upload or select visual</button><MapVisualPreview theme={values} /></> : null}
                        {section === 'assets' ? <><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Map assets</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add decorative layers over the map background.</p></div><button className="inline-flex items-center gap-2 rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-400/10" onClick={() => updateTheme({ assets: [...values.assets, { id: crypto.randomUUID(), imageUrl: '', opacity: 100, width: 20, x: 50, y: 50 }] })} type="button"><Plus className="size-4" />Add layer</button></div>{values.assets.length === 0 ? <p className="mt-5 rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/20">No map assets configured for {mode} mode yet.</p> : <div className="mt-5 grid gap-5">{values.assets.map((asset, index) => <section className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0 dark:border-white/10" key={asset.id}><div className="flex items-center justify-between"><h4 className="font-semibold">Asset {index + 1}</h4><button className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:underline dark:text-red-300" onClick={() => updateTheme({ assets: values.assets.filter((layer) => layer.id !== asset.id) })} type="button"><Trash2 className="size-4" />Remove</button></div><label className="mt-3 grid gap-1 text-sm font-medium">Asset image<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => updateAsset(asset.id, { imageUrl: event.target.value })} value={asset.imageUrl} /></label><button className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" onClick={() => setMediaTarget({ assetId: asset.id, mode })} type="button">Upload or select visual</button><div className="mt-3 grid gap-3 sm:grid-cols-4"><NumberField label="X %" max={100} min={0} onChange={(x) => updateAsset(asset.id, { x })} value={asset.x} /><NumberField label="Y %" max={100} min={0} onChange={(y) => updateAsset(asset.id, { y })} value={asset.y} /><NumberField label="Size %" max={200} min={1} onChange={(width) => updateAsset(asset.id, { width })} value={asset.width} /><NumberField label="Transparency %" max={100} min={0} onChange={(opacity) => updateAsset(asset.id, { opacity })} value={asset.opacity} /></div></section>)}</div>}<MapVisualPreview theme={values} /></> : null}
                    </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10"><button className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" data-wl-id="authoring.map-visuals.save" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save map visuals'}</button></div>
            </form>
            {mediaTarget ? <MediaPicker onClose={() => setMediaTarget(null)} onSelect={chooseMedia} /> : null}
        </div>
    );
}

function MapVisualPreview({ theme }: { theme: MapVisualThemeForm }) {
    return <div className="relative mt-6 aspect-video overflow-hidden rounded-lg border border-slate-300 bg-slate-950 dark:border-white/20" style={{ background: theme.pageBackground || '#0f172a', backgroundImage: theme.imageUrl ? `url(${theme.imageUrl})` : undefined, backgroundPosition: 'center', backgroundSize: 'cover' }}><div className="absolute inset-0" style={{ background: theme.overlay }} />{theme.assets.map((asset) => asset.imageUrl ? <img alt="" className="absolute -translate-x-1/2 -translate-y-1/2 object-contain" key={asset.id} src={asset.imageUrl} style={{ left: `${asset.x}%`, opacity: asset.opacity / 100, top: `${asset.y}%`, width: `${asset.width}%` }} /> : null)}<div className="absolute top-3 left-3 rounded border p-2 text-xs" style={{ background: theme.panelBackground || 'rgba(15,23,42,.88)', borderColor: theme.panelBorderColor || 'rgba(255,255,255,.25)', color: theme.panelTextColor || '#fff' }}>Current map<br /><span style={{ color: theme.panelMutedTextColor || '#cbd5e1' }}>Learner preview</span></div><div className="absolute top-3 right-3 rounded border p-2 text-xs" style={{ background: theme.sideControlBackground || 'rgba(15,23,42,.88)', borderColor: theme.sideControlBorderColor || 'rgba(255,255,255,.25)', color: theme.sideControlTextColor || '#fff' }}>Controls</div></div>;
}

function EditMapDetailsDialog({
    document,
    onClose,
    onRestored,
    onSaved,
}: {
    document: EditableMap;
    onClose: () => void;
    onRestored: () => void;
    onSaved: () => void;
}) {
    const { map } = document.editable_map;
    const [title, setTitle] = useState(map.title);
    const [description, setDescription] = useState(map.description);
    const [topicId, setTopicId] = useState(map.topic_id ?? '');
    const [updatedAt, setUpdatedAt] = useState(map.updated_at);
    const [mapAssetsLocked, setMapAssetsLocked] = useState(
        map.map_assets_locked,
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [hasRestoredVersion, setHasRestoredVersion] = useState(false);

    const close = () => {
        onClose();
        if (hasRestoredVersion) {
            onRestored();
        }
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim()) {
            setError('Add a map title before saving.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/maps/{map_id}/details',
                {
                    body: {
                        description: optionalValue(description),
                        map_assets_locked: mapAssetsLocked,
                        title,
                        topic_id: optionalValue(topicId),
                        updated_at: updatedAt,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { map_id: map.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    response.status === 400
                        ? 'Use a title and description within the shown limits, and choose a current learning topic.'
                        : response.status === 409
                          ? 'This map changed in another session. Close this dialog, reload the map, then apply your changes again.'
                          : 'The map details could not be saved. Refresh the World Builder and try again.',
                );
                return;
            }
            onSaved();
        } catch {
            setError(
                'The map details could not be saved. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="edit-map-details-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <h2
                    className="text-xl font-semibold"
                    id="edit-map-details-title"
                >
                    Edit map details
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Name this map, connect it to a learning topic, and decide
                    whether its MapAsset surface is locked for editing.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-4">
                    <ActivityTextField
                        label="Title"
                        onChange={setTitle}
                        value={title}
                    />
                    <label className="grid gap-1 text-sm font-medium">
                        Learning topic
                        <select
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                            onChange={(event) => setTopicId(event.target.value)}
                            value={topicId}
                        >
                            <option value="">No learning topic</option>
                            {document.topic_options.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <ActivityTextField
                        label="Description"
                        onChange={setDescription}
                        textarea
                        value={description}
                    />
                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                        <input
                            checked={mapAssetsLocked}
                            className="mt-0.5 size-4 accent-teal-700"
                            onChange={(event) =>
                                setMapAssetsLocked(event.target.checked)
                            }
                            type="checkbox"
                        />
                        <span>
                            <span className="block font-medium">
                                Lock MapAsset surface
                            </span>
                            <span className="mt-1 block text-slate-600 dark:text-slate-300">
                                Keep the map surface locked while you work on
                                its activity tiles.
                            </span>
                        </span>
                    </label>
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="mr-auto rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={() => setHistoryOpen(true)}
                        type="button"
                    >
                        Previous versions
                    </button>
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={close}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950"
                        disabled={saving}
                        type="submit"
                    >
                        {saving ? 'Saving…' : 'Save details'}
                    </button>
                </div>
            </form>
            {historyOpen ? (
                <MapDetailsHistoryDialog
                    map={map}
                    onClose={() => setHistoryOpen(false)}
                    onRestored={(restored) => {
                        setTitle(restored.title);
                        setDescription(restored.description);
                        setTopicId(restored.topic_id ?? '');
                        setMapAssetsLocked(restored.map_assets_locked);
                        setUpdatedAt(restored.updated_at);
                        setHasRestoredVersion(true);
                    }}
                />
            ) : null}
        </div>
    );
}

function NodeDetails({
    document,
    onBack,
}: {
    document: EditableNode;
    onBack: () => void;
}) {
    const graph = document.activity_graph;
    return (
        <div>
            <button
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
                onClick={onBack}
                type="button"
            >
                <ArrowLeft className="size-4" />
                {graph.map.title}
            </button>
            <p className="mt-5 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                Activity graph
            </p>
            <h2 className="mt-2 text-xl font-semibold">{graph.node.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {graph.node.description || 'No description yet.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
                <Detail
                    label="Activities"
                    value={String(graph.activities.length)}
                />
                <Detail
                    label="Start routes"
                    value={String(graph.node.start_routes.length)}
                />
            </dl>
            <section className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
                <h3 className="text-sm font-semibold">Learner starts</h3>
                {graph.node.start_routes.length > 0 ? (
                    <ol className="mt-3 grid gap-2">
                        {graph.node.start_routes.map((route) => (
                            <li
                                className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-white/5"
                                key={route.id}
                            >
                                {route.label}
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="mt-2 text-sm text-slate-500">
                        No route starts are configured.
                    </p>
                )}
            </section>
        </div>
    );
}

function ActivityGraph({
    document,
    onReload,
    onSelectMap,
    worldGraph,
}: {
    document: EditableNode;
    onReload: () => void;
    onSelectMap: () => void;
    worldGraph: WorldGraph | null;
}) {
    const graph = document.activity_graph;
    const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
    const [evidenceContextActivity, setEvidenceContextActivity] = useState<Activity | null>(null);
    const [completionChoiceActivity, setCompletionChoiceActivity] = useState<Activity | null>(null);
    const [ambientSoundActivity, setAmbientSoundActivity] = useState<Activity | null>(null);
    const [feedbackGuidanceActivity, setFeedbackGuidanceActivity] = useState<Activity | null>(null);
    const [historyActivity, setHistoryActivity] = useState<Activity | null>(
        null,
    );
    const [reviewActivity, setReviewActivity] = useState<Activity | null>(null);
    const [sourceReferencesActivity, setSourceReferencesActivity] = useState<Activity | null>(null);
    const [learningDesignDraft, setLearningDesignDraft] = useState<{
        activity: Activity;
        suggestions: LearningDesignSuggestions;
    } | null>(null);
    const [templateDialog, setTemplateDialog] = useState<{
        activity?: Activity;
        mode: 'library' | 'save' | 'update';
    } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [pendingStartRouteDeletion, setPendingStartRouteDeletion] =
        useState<ActivityStartRoute | null>(null);
    const [deletingStartRoute, setDeletingStartRoute] = useState(false);
    const [startRouteError, setStartRouteError] = useState<string | null>(null);
    const [selectedStartRoute, setSelectedStartRoute] =
        useState<ActivityStartRoute | null>(null);
    const initialNodes = useMemo<ActivityFlowNode[]>(() => {
        const start: SpecialNode = {
            id: '__start',
            type: 'special',
            data: { kind: 'start', label: 'Start' },
            position: graphPosition(graph.node.graph_layout, 'start', -260, 0),
        };
        const activities: ActivityNode[] = graph.activities.map(
            (activity, index) => ({
                id: activity.id,
                type: 'activity',
                data: {
                    activity,
                    onAmbientSound: setAmbientSoundActivity,
                    canReview: graph.can_manage_ai_review,
                    onDuplicate: (candidate) => {
                        if (isSupportedActivityType(candidate.activity_type)) {
                            setEditor({
                                template: activityCopyTemplate(candidate),
                                type: candidate.activity_type,
                            });
                        }
                    },
                    onEdit: (candidate) => {
                        if (isSupportedActivityType(candidate.activity_type)) {
                            setEditor({
                                activity: candidate,
                                type: candidate.activity_type,
                            });
                        }
                    },
                    onDelete: setPendingDelete,
                    onEvidenceContext: setEvidenceContextActivity,
                    onCompletionChoice: setCompletionChoiceActivity,
                    onFeedbackGuidance: setFeedbackGuidanceActivity,
                    onHistory: setHistoryActivity,
                    onReview: setReviewActivity,
                    onSourceReferences: setSourceReferencesActivity,
                    onSaveTemplate: (candidate) =>
                        setTemplateDialog({
                            activity: candidate,
                            mode: 'save',
                        }),
                    onUpdateTemplate: (candidate) =>
                        setTemplateDialog({
                            activity: candidate,
                            mode: 'update',
                        }),
                },
                position: {
                    x: activity.position.x ?? (index % 3) * 310,
                    y: activity.position.y ?? Math.floor(index / 3) * 220,
                },
            }),
        );
        const end: SpecialNode = {
            id: '__end',
            type: 'special',
            data: { kind: 'end', label: 'End' },
            position: graphPosition(graph.node.graph_layout, 'end', 720, 0),
        };

        return [start, ...activities, end];
    }, [graph]);
    const initialEdges = useMemo<Edge[]>(
        () => [
            ...(graph.node.start_routes.length > 0
                ? graph.node.start_routes.map((route) => ({
                      id: `__start-edge:${route.id}`,
                      source: '__start',
                      sourceHandle: 'start',
                      target: route.activity_id,
                      targetHandle: 'in',
                      label: route.label,
                      markerEnd: { type: MarkerType.ArrowClosed },
                  }))
                : graph.node.start_activity_id
                  ? [
                        {
                            id: '__start-edge:legacy',
                            source: '__start',
                            sourceHandle: 'start',
                            target: graph.node.start_activity_id,
                            targetHandle: 'in',
                            markerEnd: { type: MarkerType.ArrowClosed },
                        },
                    ]
                  : []),
            ...graph.transitions.map((transition) => ({
                id: transition.id,
                source: transition.from_activity_id,
                sourceHandle: transition.from_connector,
                target: transition.to_activity_id ?? '__end',
                targetHandle:
                    transition.to_activity_id === null
                        ? 'end'
                        : transition.to_connector,
                label: transition.label ?? transition.trigger,
                markerEnd: { type: MarkerType.ArrowClosed },
            })),
        ],
        [graph],
    );
    const [nodes, setNodes, onNodesChange] =
        useNodesState<ActivityFlowNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [savingActivityId, setSavingActivityId] = useState<string | null>(
        null,
    );
    const [editor, setEditor] = useState<{
        activity?: Activity;
        template?: ActivityCopyTemplate;
        type: SupportedActivityType;
    } | null>(null);
    const [npcDialogueActivity, setNpcDialogueActivity] = useState<
        Activity | 'create' | null
    >(null);
    const [selectedTransition, setSelectedTransition] =
        useState<ActivityTransition | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const copyTargets = useMemo<ActivityCopyTarget[]>(() => {
        const maps = (worldGraph?.maps ?? [])
            .filter((map) => map.nodes.length > 0)
            .map((map) => ({
                id: map.id,
                nodes: map.nodes.map((node) => ({
                    id: node.id,
                    title: node.title,
                })),
                title: map.title,
            }));
        const includesCurrentNode = maps.some((map) =>
            map.nodes.some((node) => node.id === graph.node.id),
        );

        return includesCurrentNode
            ? maps
            : [
                  {
                      id: graph.map.id,
                      nodes: [
                          { id: graph.node.id, title: graph.node.title },
                      ],
                      title: graph.map.title,
                  },
                  ...maps,
              ];
    }, [graph.map, graph.node, worldGraph]);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialEdges, initialNodes, setEdges, setNodes]);

    const savePosition = useCallback(
        async (node: ActivityFlowNode) => {
            setSavingActivityId(node.id);
            try {
                const token = await getCsrfToken();
                if (node.id === '__start' || node.id === '__end') {
                    const { response } = await apiClient.PATCH(
                        '/admin/world-builder/nodes/{node_id}/activity-graph-layout',
                        {
                            body: {
                                node: node.id === '__start' ? 'start' : 'end',
                                position: node.position,
                            },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { node_id: graph.node.id },
                            },
                        },
                    );
                    if (!response.ok) {
                        throw new Error('graph layout unavailable');
                    }
                    return;
                }
                const { response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/graph-position',
                    {
                        body: { position: node.position },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: node.id },
                        },
                    },
                );
                if (!response.ok) {
                    throw new Error('position unavailable');
                }
            } finally {
                setSavingActivityId(null);
            }
        },
        [graph.node.id],
    );

    const deleteActivity = async () => {
        if (!pendingDelete) {
            return;
        }

        setDeleteError(null);
        setDeleting(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/activities/{activity_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_id: pendingDelete.id },
                    },
                },
            );
            if (!response.ok) {
                setDeleteError(
                    'The activity could not be deleted. Reload the graph and try again.',
                );
                return;
            }
            setPendingDelete(null);
            onReload();
        } catch {
            setDeleteError(
                'The activity could not be deleted. Check your connection and try again.',
            );
        } finally {
            setDeleting(false);
        }
    };

    const selectTransition = useCallback(
        (transitionId: string) => {
            const transition = graph.transitions.find(
                (candidate) => candidate.id === transitionId,
            );
            if (transition) {
                setSelectedTransition(transition);
            }
        },
        [graph.transitions],
    );

    const openStartRoute = useCallback(
        (activityId: string) => {
            const route = graph.node.start_routes.find(
                (candidate) => candidate.activity_id === activityId,
            );
            if (route) {
                setStartRouteError(null);
                setSelectedStartRoute(route);
            }
        },
        [graph.node.start_routes],
    );

    const deleteStartRoute = useCallback(async () => {
        if (!pendingStartRouteDeletion) {
            return;
        }
        setStartRouteError(null);
        setDeletingStartRoute(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/start-routes/{start_route_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_route_id: pendingStartRouteDeletion.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('start route unavailable');
            }
            setPendingStartRouteDeletion(null);
            onReload();
        } catch {
            setStartRouteError(
                'The learner start could not be deleted. Reload the graph and try again.',
            );
        } finally {
            setDeletingStartRoute(false);
        }
    }, [onReload, pendingStartRouteDeletion]);

    const connectActivities = useCallback(
        async (connection: Connection) => {
            if (!connection.source || !connection.target) {
                return;
            }
            setConnectionError(null);
            try {
                const token = await getCsrfToken();
                if (connection.source === '__start') {
                    if (connection.target === '__end') {
                        return;
                    }
                    const { response } = await apiClient.POST(
                        '/admin/world-builder/nodes/{node_id}/start-routes',
                        {
                            body: { activity_id: connection.target },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { node_id: graph.node.id },
                            },
                        },
                    );
                    if (!response.ok) {
                        throw new Error('start route unavailable');
                    }
                    onReload();
                    return;
                }
                if (connection.source.startsWith('__')) {
                    return;
                }
                const { response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/activity-transitions',
                    {
                        body: {
                            from_activity_id: connection.source,
                            from_connector:
                                connection.sourceHandle ?? 'completed',
                            to_activity_id:
                                connection.target === '__end'
                                    ? null
                                    : connection.target,
                            to_connector:
                                connection.target === '__end'
                                    ? 'end'
                                    : (connection.targetHandle ?? 'in'),
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: graph.node.id },
                        },
                    },
                );
                if (!response.ok) {
                    throw new Error('transition unavailable');
                }
                onReload();
            } catch {
                setConnectionError(
                    'The connection could not be saved. Check the graph and try again.',
                );
            }
        },
        [graph.node.id, onReload],
    );

    if (npcDialogueActivity) {
        return (
            <OriginalNpcDialogueEditor
                activityId={
                    npcDialogueActivity === 'create'
                        ? undefined
                        : npcDialogueActivity.id
                }
                nodeId={graph.node.id}
                onClose={() => {
                    setNpcDialogueActivity(null);
                    onReload();
                }}
                tools={document.tools}
            />
        );
    }

    return (
        <>
            <div className="h-[34rem]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm dark:border-white/10">
                    <button
                        className="inline-flex items-center gap-2 font-medium text-teal-700 hover:underline dark:text-teal-300"
                        onClick={onSelectMap}
                        type="button"
                    >
                        <ArrowLeft className="size-4" />
                        Back to map
                    </button>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="hidden text-slate-500 lg:inline">
                            {savingActivityId
                                ? 'Saving position…'
                                : 'Drag activity cards to arrange this graph.'}
                        </span>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            data-wl-id="authoring.activity-templates.open"
                            onClick={() =>
                                setTemplateDialog({ mode: 'library' })
                            }
                            type="button"
                        >
                            <BookmarkPlus className="size-3.5" />
                            Activity templates
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'open_practice' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Open practice
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'reflection' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Reflection
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'review' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Review / revisit
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'markdown' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Markdown
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'portal' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Portal
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setNpcDialogueActivity('create')}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            NPC dialogue
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'item_grant' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Item grant
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'tool_grant' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Tool grant
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'item_obstacle' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Item obstacle
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'obstacle' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Obstacle
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'question' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Question
                        </button>
                        <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setEditor({ type: 'shared_task' })}
                            type="button"
                        >
                            <Plus className="size-3.5" />
                            Shared task
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10" onClick={() => setEditor({ type: 'message_prompt' })} type="button"><Plus className="size-3.5" />Message prompt</button>
                        <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10" onClick={() => setEditor({ type: 'message_wall' })} type="button"><Plus className="size-3.5" />Message wall</button>
                    </div>
                </div>
                {connectionError ? (
                    <p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {connectionError}
                    </p>
                ) : null}
                <ReactFlow<ActivityFlowNode, Edge>
                    edges={edges}
                    fitView
                    minZoom={0.12}
                    nodeTypes={{
                        activity: ActivityGraphCard,
                        special: SpecialGraphNode,
                    }}
                    nodes={nodes}
                    onEdgesChange={onEdgesChange}
                    onEdgeClick={(_, edge) => {
                        if (edge.id.startsWith('__start-edge:')) {
                            openStartRoute(edge.target);
                            return;
                        }
                        selectTransition(edge.id);
                    }}
                    onConnect={(connection) =>
                        void connectActivities(connection)
                    }
                    onNodeClick={(_, node) => {
                        if (
                            node.type === 'activity' &&
                            node.data.activity.activity_type === 'npc_dialogue'
                        ) {
                            setNpcDialogueActivity(node.data.activity);
                            return;
                        }
                        if (
                            node.type === 'activity' &&
                            isSupportedActivityType(
                                node.data.activity.activity_type,
                            )
                        ) {
                            setEditor({
                                activity: node.data.activity,
                                type: node.data.activity.activity_type,
                            });
                        }
                    }}
                    onNodeDragStop={(_, node) => void savePosition(node)}
                    onNodesChange={onNodesChange}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background gap={20} />
                    <Controls />
                </ReactFlow>
            </div>
            {editor ? (
                <ActivityAuthorDialog
                    activity={editor.activity}
                    items={document.items}
                    sounds={document.sounds}
                    messageTopics={document.activity_graph.message_topics}
                    portalCandidates={document.activity_graph.portal_candidates}
                    tools={document.tools}
                    nodeId={graph.node.id}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        setEditor(null);
                        onReload();
                    }}
                    template={editor.template}
                    type={editor.type}
                    copyTargets={copyTargets}
                />
            ) : null}
            {pendingDelete ? (
                <DeleteActivityDialog
                    activity={pendingDelete}
                    error={deleteError}
                    onCancel={() => {
                        if (!deleting) {
                            setDeleteError(null);
                            setPendingDelete(null);
                        }
                    }}
                    onConfirm={() => void deleteActivity()}
                    processing={deleting}
                />
            ) : null}
            {selectedTransition ? (
                <TransitionEditorDialog
                    onClose={() => setSelectedTransition(null)}
                    onSaved={() => {
                        setSelectedTransition(null);
                        onReload();
                    }}
                    transition={selectedTransition}
                />
            ) : null}
            {selectedStartRoute ? (
                <StartRouteEditorDialog
                    activity={
                        graph.activities.find(
                            (activity) =>
                                activity.id === selectedStartRoute.activity_id,
                        ) ?? null
                    }
                    onClose={() => setSelectedStartRoute(null)}
                    onDelete={() => {
                        setSelectedStartRoute(null);
                        setPendingStartRouteDeletion(selectedStartRoute);
                    }}
                    onSaved={() => {
                        setSelectedStartRoute(null);
                        onReload();
                    }}
                    route={selectedStartRoute}
                    routeIndex={graph.node.start_routes.findIndex(
                        (route) => route.id === selectedStartRoute.id,
                    )}
                    routeTotal={graph.node.start_routes.length}
                />
            ) : null}
            {pendingStartRouteDeletion ? (
                <DeleteStartRouteDialog
                    error={startRouteError}
                    onCancel={() => {
                        if (!deletingStartRoute) {
                            setStartRouteError(null);
                            setPendingStartRouteDeletion(null);
                        }
                    }}
                    onConfirm={() => void deleteStartRoute()}
                    processing={deletingStartRoute}
                />
            ) : null}
            {historyActivity ? (
                <OriginalActivityHistoryDialog
                    activityId={historyActivity.id}
                    activityTitle={historyActivity.title}
                    onClose={() => setHistoryActivity(null)}
                    onRestored={() => {
                        setHistoryActivity(null);
                        onReload();
                    }}
                />
            ) : null}
            {reviewActivity ? (
                <OriginalActivityAiReviewDialog
                    activity={reviewActivity}
                    onClose={() => setReviewActivity(null)}
                    onEditLearningDesign={(activity, suggestions) => {
                        setReviewActivity(null);
                        setLearningDesignDraft({ activity, suggestions });
                    }}
                    onReviewed={onReload}
                    templates={graph.ai_review_templates}
                />
            ) : null}
            {learningDesignDraft ? (
                <OriginalActivityLearningDesignDialog
                    activity={learningDesignDraft.activity}
                    competenceTopicOptions={graph.competence_topic_options}
                    onClose={() => setLearningDesignDraft(null)}
                    onSaved={() => {
                        setLearningDesignDraft(null);
                        onReload();
                    }}
                    suggestions={learningDesignDraft.suggestions}
                />
            ) : null}
            {evidenceContextActivity ? <OriginalActivityEvidenceContextDialog activity={evidenceContextActivity} conceptOptions={graph.evidence_concept_options} onClose={() => setEvidenceContextActivity(null)} onSaved={() => { setEvidenceContextActivity(null); onReload(); }} /> : null}
            {completionChoiceActivity ? <OriginalActivityCompletionChoiceDialog activity={completionChoiceActivity} onClose={() => setCompletionChoiceActivity(null)} onSaved={() => { setCompletionChoiceActivity(null); onReload(); }} /> : null}
            {ambientSoundActivity ? <OriginalActivityAmbientSoundDialog activity={ambientSoundActivity} onClose={() => setAmbientSoundActivity(null)} onSaved={() => { setAmbientSoundActivity(null); onReload(); }} sounds={document.sounds} /> : null}
            {feedbackGuidanceActivity ? <OriginalActivityFeedbackGuidanceDialog activity={feedbackGuidanceActivity} onClose={() => setFeedbackGuidanceActivity(null)} onSaved={() => { setFeedbackGuidanceActivity(null); onReload(); }} /> : null}
            {sourceReferencesActivity ? (
                <OriginalActivitySourceReferencesDialog
                    activity={sourceReferencesActivity}
                    evidenceConceptOptions={graph.evidence_concept_options}
                    onClose={() => setSourceReferencesActivity(null)}
                    onSaved={() => {
                        setSourceReferencesActivity(null);
                        onReload();
                    }}
                    sourceRecords={graph.source_records.items}
                />
            ) : null}
            {templateDialog ? (
                <OriginalActivityTemplatesDialog
                    activity={templateDialog.activity}
                    mode={templateDialog.mode}
                    onClose={() => setTemplateDialog(null)}
                    onUseTemplate={(template) => {
                        if (!isSupportedActivityType(template.activity_type)) {
                            setConnectionError(
                                'This template uses an activity type that is not yet available in the Rust editor.',
                            );
                            return;
                        }
                        setTemplateDialog(null);
                        setEditor({
                            template,
                            type: template.activity_type,
                        });
                    }}
                />
            ) : null}
        </>
    );
}

function ActivityGraphCard({
    data,
    selected,
}: {
    data: ActivityNodeData;
    selected: boolean;
}) {
    const { activity } = data;
    return (
        <div
            className={`w-64 rounded-xl border bg-slate-50 p-4 shadow-lg dark:border-white/10 dark:bg-slate-950 ${selected ? 'border-teal-500 ring-2 ring-teal-500/25' : 'border-slate-200'}`}
        >
            <ActivityConnectorHandles
                connectors={activity.connectors.inputs}
                position={Position.Left}
                type="target"
            />
            <ActivityConnectorHandles
                connectors={activity.connectors.outputs}
                position={Position.Right}
                type="source"
            />
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.16em] text-teal-700 uppercase dark:text-teal-300">
                    {activity.activity_type}
                </p>
                <button
                    aria-label={`Delete ${activity.title}`}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-300/10 dark:hover:text-red-300"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onDelete(activity);
                    }}
                    type="button"
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {activity.title}
            </h3>
            {activity.introduction ? (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {activity.introduction}
                </p>
            ) : null}
            <p
                className={`mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${activity.ai_review_status === 'reviewed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200'}`}
            >
                {activity.ai_review_status === 'reviewed' ? (
                    <CircleCheck className="size-3" />
                ) : (
                    <CircleAlert className="size-3" />
                )}
                {activity.ai_review_status === 'reviewed'
                    ? 'AI reviewed'
                    : 'Needs AI review'}
            </p>
            {activity.connectors.outputs.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                    {activity.connectors.outputs.map((connector) => (
                        <span
                            className="rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800 dark:bg-teal-300/10 dark:text-teal-200"
                            key={connector.id}
                        >
                            {connector.label}
                        </span>
                    ))}
                </div>
            ) : null}
            <button
                className="mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10"
                data-wl-id="authoring.activity-history.open"
                onClick={(event) => {
                    event.stopPropagation();
                    data.onHistory(activity);
                }}
                type="button"
            >
                Activity history
            </button>
            <button className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10" data-wl-id="authoring.activity-evidence-context.open" onClick={(event) => { event.stopPropagation(); data.onEvidenceContext(activity); }} type="button">Learner orientation</button>
            <button className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10" data-wl-id="authoring.activity-completion-choice.open" onClick={(event) => { event.stopPropagation(); data.onCompletionChoice(activity); }} type="button">Choice context</button>
            <button className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10" data-wl-id="authoring.activity-ambient-sound.open" onClick={(event) => { event.stopPropagation(); data.onAmbientSound(activity); }} type="button">Scene ambience</button>
            <button className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10" data-wl-id="authoring.activity-feedback-guidance.open" onClick={(event) => { event.stopPropagation(); data.onFeedbackGuidance(activity); }} type="button">Feedback guidance</button>
            <button
                className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-300/10"
                data-wl-id="authoring.activity-source-references.open"
                onClick={(event) => {
                    event.stopPropagation();
                    data.onSourceReferences(activity);
                }}
                type="button"
            >
                Sources
            </button>
            {data.canReview && data.activity.ai_review_status === 'needs_review' ? (
                <button
                    className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-50 dark:text-violet-200 dark:hover:bg-violet-300/10"
                    onClick={(event) => {
                        event.stopPropagation();
                        data.onReview(activity);
                    }}
                    type="button"
                >
                    <Sparkles className="size-3" />
                    Review activity
                </button>
            ) : null}
            {activity.activity_type !== 'npc_dialogue' ? (
                <div className="mt-1 flex flex-wrap gap-1">
                    <button
                        aria-label={`Edit ${activity.title}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                        onClick={(event) => {
                            event.stopPropagation();
                            data.onEdit(activity);
                        }}
                        type="button"
                    >
                        <Pencil className="size-3" />
                        Edit
                    </button>
                    <button
                        aria-label={`Use ${activity.title} as a template`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                        onClick={(event) => {
                            event.stopPropagation();
                            data.onDuplicate(activity);
                        }}
                        title="Create editable copy"
                        type="button"
                    >
                        <Copy className="size-3" />
                        Create editable copy
                    </button>
                    <button
                        aria-label={`Save ${activity.title} as a reusable template`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                        onClick={(event) => {
                            event.stopPropagation();
                            data.onSaveTemplate(activity);
                        }}
                        title="Save reusable template"
                        type="button"
                    >
                        <BookmarkPlus className="size-3" />
                        Save template
                    </button>
                    <button
                        aria-label={`Update a saved template from ${activity.title}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                        onClick={(event) => {
                            event.stopPropagation();
                            data.onUpdateTemplate(activity);
                        }}
                        title="Update saved template"
                        type="button"
                    >
                        <RefreshCw className="size-3" />
                        Update template
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function ActivityConnectorHandles({
    connectors,
    position,
    type,
}: {
    connectors: ActivityConnector[];
    position: Position;
    type: 'source' | 'target';
}) {
    return (
        <>
            {connectors.map((connector, index) => (
                <Handle
                    className="!size-3 !border-2 !border-white !bg-teal-700 dark:!border-slate-950 dark:!bg-teal-300"
                    id={connector.id}
                    key={connector.id}
                    position={position}
                    style={{
                        top: `${((index + 1) / (connectors.length + 1)) * 100}%`,
                    }}
                    title={connector.label}
                    type={type}
                />
            ))}
        </>
    );
}

function StartRouteEditorDialog({
    activity,
    onClose,
    onDelete,
    onSaved,
    route,
    routeIndex,
    routeTotal,
}: {
    activity: Activity | null;
    onClose: () => void;
    onDelete: () => void;
    onSaved: () => void;
    route: ActivityStartRoute;
    routeIndex: number;
    routeTotal: number;
}) {
    const [form, setForm] = useState<StartRouteForm>(() =>
        startRouteForm(route),
    );
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [mediaTarget, setMediaTarget] = useState<
        'imageDark' | 'imageLight' | null
    >(null);

    const update = <Key extends keyof StartRouteForm>(
        key: Key,
        value: StartRouteForm[Key],
    ) => setForm((current) => ({ ...current, [key]: value }));

    const save = async () => {
        const colors = [
            form.buttonColorDark,
            form.buttonBorderColorDark,
            form.buttonColorLight,
            form.buttonBorderColorLight,
        ];
        if (colors.some((color) => color !== '' && !validHexColor(color))) {
            setError('Button colors must use six-digit hexadecimal values.');
            return;
        }
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/start-routes/{start_route_id}',
                {
                    body: {
                        button_border_color_dark: optionalValue(
                            form.buttonBorderColorDark,
                        ),
                        button_border_color_light: optionalValue(
                            form.buttonBorderColorLight,
                        ),
                        button_color_dark: optionalValue(form.buttonColorDark),
                        button_color_light: optionalValue(
                            form.buttonColorLight,
                        ),
                        description: optionalValue(form.description),
                        image_dark: optionalValue(form.imageDark),
                        image_light: optionalValue(form.imageLight),
                        label: optionalValue(form.label),
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_route_id: route.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('start route unavailable');
            }
            onSaved();
        } catch {
            setError(
                'The learner start could not be saved. Check the fields and try again.',
            );
        } finally {
            setProcessing(false);
        }
    };

    const reorder = async (direction: 'up' | 'down') => {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/admin/world-builder/start-routes/{start_route_id}/reorder',
                {
                    body: { direction },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_route_id: route.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('start route unavailable');
            }
            onSaved();
        } catch {
            setError('The learner start could not be reordered. Try again.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div
            aria-labelledby="start-route-editor-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2
                            className="text-xl font-semibold"
                            id="start-route-editor-title"
                        >
                            Route visuals
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Configure the learner-facing start for{' '}
                            {activity?.title ?? route.label}.
                        </p>
                    </div>
                    <button
                        aria-label="Close route form"
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        disabled={processing}
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-xs font-medium tracking-[0.16em] text-teal-700 uppercase dark:text-teal-300">
                            Starts activity
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                            {activity?.title ?? route.label}
                        </p>
                    </div>
                    {routeIndex >= 0 && routeTotal > 1 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                            <span>
                                Route order: {routeIndex + 1} of {routeTotal}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    className="rounded-md border border-slate-200 px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
                                    disabled={processing || routeIndex === 0}
                                    onClick={() => void reorder('up')}
                                    type="button"
                                >
                                    Move earlier
                                </button>
                                <button
                                    className="rounded-md border border-slate-200 px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
                                    disabled={
                                        processing ||
                                        routeIndex === routeTotal - 1
                                    }
                                    onClick={() => void reorder('down')}
                                    type="button"
                                >
                                    Move later
                                </button>
                            </div>
                        </div>
                    ) : null}
                    <label className="grid gap-2 text-sm font-medium">
                        Route name
                        <input
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            maxLength={120}
                            onChange={(event) =>
                                update('label', event.target.value)
                            }
                            value={form.label}
                        />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                        Route guidance
                        <textarea
                            className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            maxLength={600}
                            onChange={(event) =>
                                update('description', event.target.value)
                            }
                            value={form.description}
                        />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                        <RouteField
                            label="Dark route image"
                            onChange={(value) => update('imageDark', value)}
                            onSelectExisting={() => setMediaTarget('imageDark')}
                            value={form.imageDark}
                        />
                        <RouteField
                            label="Light route image"
                            onChange={(value) => update('imageLight', value)}
                            onSelectExisting={() => setMediaTarget('imageLight')}
                            value={form.imageLight}
                        />
                        <RouteField
                            label="Dark button color"
                            onChange={(value) =>
                                update('buttonColorDark', value)
                            }
                            value={form.buttonColorDark}
                        />
                        <RouteField
                            label="Dark border and frame color"
                            onChange={(value) =>
                                update('buttonBorderColorDark', value)
                            }
                            value={form.buttonBorderColorDark}
                        />
                        <RouteField
                            label="Light button color"
                            onChange={(value) =>
                                update('buttonColorLight', value)
                            }
                            value={form.buttonColorLight}
                        />
                        <RouteField
                            label="Light border and frame color"
                            onChange={(value) =>
                                update('buttonBorderColorLight', value)
                            }
                            value={form.buttonBorderColorLight}
                        />
                    </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-300/10"
                        disabled={processing}
                        onClick={onDelete}
                        type="button"
                    >
                        Delete route
                    </button>
                    <div className="flex gap-3">
                        <button
                            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10"
                            disabled={processing}
                            onClick={onClose}
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-300 dark:text-slate-950 dark:hover:bg-teal-200"
                            disabled={processing}
                            onClick={() => void save()}
                            type="button"
                        >
                            {processing ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </section>
            {mediaTarget ? (
                <MediaPicker
                    onClose={() => setMediaTarget(null)}
                    onSelect={(asset) => {
                        update(mediaTarget, asset.url);
                        setMediaTarget(null);
                    }}
                />
            ) : null}
        </div>
    );
}

function RouteField({
    label,
    onChange,
    onSelectExisting,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    onSelectExisting?: () => void;
    value: string;
}) {
    return (
        <label className="grid gap-2 text-sm font-medium">
            {label}
            <input
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                maxLength={2048}
                onChange={(event) => onChange(event.target.value)}
                value={value}
            />
            {onSelectExisting ? (
                <button
                    className="justify-self-start rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10"
                    onClick={onSelectExisting}
                    type="button"
                >
                    Select existing
                </button>
            ) : null}
        </label>
    );
}

function DeleteStartRouteDialog({
    error,
    onCancel,
    onConfirm,
    processing,
}: {
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
    processing: boolean;
}) {
    return (
        <div
            aria-labelledby="delete-start-route-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <h2
                    className="text-xl font-semibold"
                    id="delete-start-route-title"
                >
                    Delete route?
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    This removes the route button from the learner node panel.
                    The target activity stays untouched.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10"
                        disabled={processing}
                        onClick={onCancel}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={processing}
                        onClick={onConfirm}
                        type="button"
                    >
                        {processing ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function startRouteForm(route: ActivityStartRoute): StartRouteForm {
    return {
        buttonBorderColorDark: route.button_border_color_dark ?? '',
        buttonBorderColorLight: route.button_border_color_light ?? '',
        buttonColorDark: route.button_color_dark ?? '',
        buttonColorLight: route.button_color_light ?? '',
        description: route.description ?? '',
        imageDark: route.image_dark ?? '',
        imageLight: route.image_light ?? '',
        label: route.label,
    };
}

function DeleteActivityDialog({
    activity,
    error,
    onCancel,
    onConfirm,
    processing,
}: {
    activity: Activity;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
    processing: boolean;
}) {
    return (
        <div
            aria-labelledby="delete-activity-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <h2
                    className="text-xl font-semibold"
                    id="delete-activity-title"
                >
                    Delete activity?
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    This removes &ldquo;{activity.title}&rdquo; and its outgoing
                    connections. This cannot be undone.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-white/10"
                        disabled={processing}
                        onClick={onCancel}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={processing}
                        onClick={onConfirm}
                        type="button"
                    >
                        {processing ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function TransitionEditorDialog({
    onClose,
    onSaved,
    transition,
}: {
    onClose: () => void;
    onSaved: () => void;
    transition: ActivityTransition;
}) {
    const [label, setLabel] = useState(transition.label ?? '');
    const [triggerValue, setTriggerValue] = useState(
        transition.trigger_value ?? '',
    );
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const save = async () => {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/activity-transitions/{transition_id}',
                {
                    body: {
                        label: optionalValue(label),
                        trigger_value:
                            transition.trigger === 'outcome'
                                ? optionalValue(triggerValue)
                                : null,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { transition_id: transition.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    'The connection could not be saved. Check the values and try again.',
                );
                return;
            }
            onSaved();
        } catch {
            setError(
                'The connection could not be saved. Check your connection and try again.',
            );
        } finally {
            setProcessing(false);
        }
    };

    const remove = async () => {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/world-builder/activity-transitions/{transition_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { transition_id: transition.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    'The connection could not be deleted. Reload the graph and try again.',
                );
                return;
            }
            onSaved();
        } catch {
            setError(
                'The connection could not be deleted. Check your connection and try again.',
            );
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div
            aria-labelledby="transition-editor-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <h2
                    className="text-xl font-semibold"
                    id="transition-editor-title"
                >
                    Edit connection
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Give this path a short label for the activity graph. Leaving
                    it blank restores the default label.
                </p>
                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}
                <div className="mt-5 grid gap-4">
                    <ActivityTextField
                        label="Connection label"
                        onChange={setLabel}
                        value={label}
                    />
                    {transition.trigger === 'outcome' ? (
                        <ActivityTextField
                            label="Answer outcome key"
                            onChange={setTriggerValue}
                            value={triggerValue}
                        />
                    ) : null}
                </div>
                <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-300/10"
                        disabled={processing}
                        onClick={() => void remove()}
                        type="button"
                    >
                        <Trash2 className="size-4" />
                        Delete connection
                    </button>
                    <div className="flex gap-3">
                        <button
                            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-white/10"
                            disabled={processing}
                            onClick={onClose}
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                            disabled={processing}
                            onClick={() => void save()}
                            type="button"
                        >
                            {processing ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function ActivityAuthorDialog({
    activity,
    items,
    nodeId,
    messageTopics,
    portalCandidates,
    onClose,
    onSaved,
    sounds,
    template,
    type,
    tools,
    copyTargets,
}: {
    activity?: Activity;
    items: EditableItem[];
    nodeId: string;
    messageTopics: MessageTopic[];
    portalCandidates: PortalCandidate[];
    onClose: () => void;
    onSaved: () => void;
    sounds: EditableSound[];
    template?: ActivityCopyTemplate;
    type: SupportedActivityType;
    tools: EditableTool[];
    copyTargets: ActivityCopyTarget[];
}) {
    const [form, setForm] = useState(() => {
        const initial = template
            ? activityAuthorFormFromTemplate(
                  type,
                  template,
                  items,
                  tools,
                  sounds,
              )
            : activityAuthorForm(type, activity, items, tools, sounds);
        const target = activity?.portal_link?.target_activity?.id;
        return target ? { ...initial, portalTargetId: target } : initial;
    });
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [targetNodeId, setTargetNodeId] = useState(nodeId);
    const isEditing = activity !== undefined;
    const createNodeId = template ? targetNodeId : nodeId;
    const typeLabel =
        type === 'open_practice'
            ? 'Open practice'
            : type === 'reflection'
              ? 'Reflection'
              : type === 'review'
                ? 'Review / revisit'
              : type === 'markdown'
                ? 'Markdown'
              : type === 'portal'
                ? 'Portal'
              : type === 'item_grant'
                ? 'Item grant'
                : type === 'tool_grant'
                  ? 'Tool grant'
                  : type === 'item_obstacle'
                    ? 'Item obstacle'
                    : type === 'obstacle'
                      ? 'Obstacle'
                      : type === 'question'
                        ? 'Question'
                      : type === 'shared_task'
                        ? 'Shared task'
                        : type === 'message_prompt'
                          ? 'Message prompt'
                          : 'Message wall';

    const updateField = (field: keyof ActivityAuthorForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        if (!form.title.trim()) {
            setError('Add an activity title before saving.');
            return;
        }

        const itemGrant = itemGrantRequest(form);
        if (type === 'item_grant' && !itemGrant) {
            setError(
                'Use a probability between 0.01% and 100%, and give every selected item a quantity from 1 to 999.',
            );
            return;
        }
        const completeItemGrant = itemGrant ?? {
            items: [],
            probabilityPercent: 100,
        };
        const toolGrant = toolGrantRequest(form);
        if (type === 'tool_grant' && !toolGrant) {
            setError(
                'Use valid bubble colors and values within the shown source ranges before saving.',
            );
            return;
        }
        const completeToolGrant = toolGrant ?? defaultToolGrantRequest();
        const itemObstacle = itemObstacleRequest(form);
        if (type === 'item_obstacle' && !itemObstacle) {
            setError(
                'Use values within the shown source ranges and choose a sound for each enabled event.',
            );
            return;
        }
        const completeItemObstacle =
            itemObstacle ?? defaultItemObstacleRequest();
        const obstacle = obstacleRequest(form.obstacle);
        if (type === 'obstacle' && !obstacle) {
            setError(
                'Use valid colors and values within the shown source ranges before saving.',
            );
            return;
        }
        const completeObstacle = obstacle ?? defaultObstacleRequest();

        setSaving(true);
        try {
            const token = await getCsrfToken();
            const common = {
                introduction: optionalValue(form.introduction),
                slug: optionalValue(form.slug),
                title: form.title,
            };
            let response: Response;

            const sharedTask: components['schemas']['CreateAdminSharedTaskActivityRequest'] = {
                ...common,
                cycle_mode: form.sharedTaskCycleMode as 'none' | 'question_response_question',
                input_label: form.sharedTaskInputLabel,
                instructions: form.sharedTaskInstructions,
                minimum_length: Number(form.sharedTaskMinimumLength),
                peer_review_enabled: form.sharedTaskPeerReviewEnabled,
                peer_review_prompt: form.sharedTaskPeerReviewPrompt,
                project_deliverable: form.sharedTaskProjectDeliverable,
                project_goal: form.sharedTaskProjectGoal,
                project_steps: form.sharedTaskProjectSteps.split(/\r?\n/).map((step) => step.trim()).filter(Boolean),
                prompt: form.prompt,
                repeat_policy: form.sharedTaskRepeatPolicy as 'once_per_user' | 'unlimited',
                show_contributions: form.sharedTaskShowContributions,
                task_kind: form.sharedTaskKind as 'text' | 'question' | 'reflection',
                threshold: Number(form.sharedTaskThreshold),
                validation_mode: form.sharedTaskValidationMode as 'minimum_length' | 'none',
            };
            const question: components['schemas']['CreateAdminQuestionActivityRequest'] = {
                ...common,
                allow_multiple: form.questionAllowMultiple,
                explanation: form.questionExplanation,
                feedback_correct: form.questionFeedbackCorrect,
                feedback_incorrect: form.questionFeedbackIncorrect,
                options: form.questionOptions.map((option) => ({
                    body: option.body,
                    feedback: option.feedback,
                    is_correct: option.isCorrect,
                    key: optionalValue(option.key),
                    label: option.label,
                    outcome_key: option.outcomeKey,
                    weights: option.weights,
                })),
                prompt: form.questionPrompt,
            };
            const message = {
                ...common,
                activity_type: type as 'message_prompt' | 'message_wall',
                allow_responses: type === 'message_wall' && form.messageAllowResponses,
                audience: type === 'message_wall' ? 'peers' : form.messageAudience,
                input_label: form.messageInputLabel,
                prompt: form.prompt,
                response_prompt: form.messageResponsePrompt,
                surface_color_dark: form.messageSurfaceColorDark,
                surface_color_light: form.messageSurfaceColorLight,
                card_color_dark: form.messageCardColorDark,
                card_color_light: form.messageCardColorLight,
                card_border_color_dark: form.messageCardBorderColorDark,
                card_border_color_light: form.messageCardBorderColorLight,
                text_color_dark: form.messageTextColorDark,
                text_color_light: form.messageTextColorLight,
                accent_color_dark: form.messageAccentColorDark,
                accent_color_light: form.messageAccentColorLight,
                topic_id: optionalValue(form.messageTopicId),
                topic_title: form.messageTopicTitle,
            } as components['schemas']['CreateAdminMessageActivityRequest'];
            const markdown = {
                ...common,
                markdown_graph_layout: form.markdownGraphLayout,
                markdown_pages: form.markdownPages.map((page) => ({
                    body: page.body,
                    id: page.id,
                    position: page.position,
                    title: page.title,
                    visual: {
                        border_color_dark: page.visual.borderColorDark,
                        border_color_light: page.visual.borderColorLight,
                        heading_color_dark: page.visual.headingColorDark,
                        heading_color_light: page.visual.headingColorLight,
                        page_color_dark: page.visual.pageColorDark,
                        page_color_light: page.visual.pageColorLight,
                        text_color_dark: page.visual.textColorDark,
                        text_color_light: page.visual.textColorLight,
                    },
                })),
                markdown_transitions: form.markdownTransitions,
            } as components['schemas']['CreateAdminMarkdownActivityRequest'];
            const portal = {
                ...common,
                portal_assets: form.portalAssets.map((asset) => ({
                    id: asset.id,
                    image_dark: asset.imageDark,
                    image_light: asset.imageLight,
                    label: asset.label,
                    layer: asset.layer,
                    mirrored: asset.mirrored,
                    opacity: Number(asset.opacity),
                    width: Number(asset.width),
                    x: Number(asset.x),
                    y: Number(asset.y),
                })),
                portal_background_dark: form.portalBackgroundDark,
                portal_background_light: form.portalBackgroundLight,
                portal_background_mirrored: form.portalBackgroundMirrored,
                portal_bubble_border_color_dark: form.portalBubbleBorderColorDark,
                portal_bubble_border_color_light: form.portalBubbleBorderColorLight,
                portal_bubble_color_dark: form.portalBubbleColorDark,
                portal_bubble_color_light: form.portalBubbleColorLight,
                portal_bubble_text: form.portalBubbleText,
                portal_bubble_text_color_dark: form.portalBubbleTextColorDark,
                portal_bubble_text_color_light: form.portalBubbleTextColorLight,
                portal_bubble_typing_speed: Number(form.portalBubbleTypingSpeed),
                portal_duration_seconds: Number(form.portalDurationSeconds),
                portal_foreground_dark: form.portalForegroundDark,
                portal_foreground_light: form.portalForegroundLight,
                portal_foreground_mirrored: form.portalForegroundMirrored,
                portal_foreground_width: Number(form.portalForegroundWidth),
                portal_foreground_x: Number(form.portalForegroundX),
                portal_foreground_y: Number(form.portalForegroundY),
                portal_mode: form.portalMode,
                portal_show_on_arrival: form.portalShowOnArrival,
                portal_swirl_enabled: form.portalSwirlEnabled,
                portal_wait_for_enter: form.portalWaitForEnter,
                target_portal_activity_id: form.portalMode === 'output' ? optionalValue(form.portalTargetId) : null,
            } as components['schemas']['CreateAdminPortalActivityRequest'];

            if (type === 'markdown' && activity) {
                ({ response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/markdown', { body: { ...markdown, introduction: optionalValue(form.introduction), slug: optionalValue(form.slug), updated_at: activity.updated_at }, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activity.id } } }));
            } else if (type === 'markdown') {
                ({ response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/markdown-activities', { body: markdown, params: { header: { 'X-CSRF-Token': token }, path: { node_id: createNodeId } } }));
            } else if (type === 'portal' && activity) {
                ({ response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/portal', { body: { ...portal, updated_at: activity.updated_at }, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activity.id } } }));
            } else if (type === 'portal') {
                ({ response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/portal-activities', { body: portal, params: { header: { 'X-CSRF-Token': token }, path: { node_id: createNodeId } } }));
            } else if (type === 'question' && activity) {
                ({ response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/question', { body: { ...question, updated_at: activity.updated_at }, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activity.id } } }));
            } else if (type === 'question') {
                ({ response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/question-activities', { body: question, params: { header: { 'X-CSRF-Token': token }, path: { node_id: createNodeId } } }));
            } else if ((type === 'message_prompt' || type === 'message_wall') && activity) {
                ({ response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/message', { body: { ...message, updated_at: activity.updated_at }, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activity.id } } }));
            } else if (type === 'message_prompt' || type === 'message_wall') {
                ({ response } = await apiClient.POST('/admin/world-builder/nodes/{node_id}/message-activities', { body: message, params: { header: { 'X-CSRF-Token': token }, path: { node_id: createNodeId } } }));
            } else if (type === 'shared_task' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/shared-task',
                    { body: { ...sharedTask, updated_at: activity.updated_at }, params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activity.id } } },
                ));
            } else if (type === 'shared_task') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/shared-task-activities',
                    { body: sharedTask, params: { header: { 'X-CSRF-Token': token }, path: { node_id: createNodeId } } },
                ));
            } else if (type === 'open_practice') {
                if (activity) {
                    ({ response } = await apiClient.PATCH(
                        '/admin/world-builder/activities/{activity_id}/open-practice',
                        {
                            body: {
                                ...common,
                                next_step: optionalValue(form.nextStep),
                                updated_at: activity.updated_at,
                            },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { activity_id: activity.id },
                            },
                        },
                    ));
                } else {
                    ({ response } = await apiClient.POST(
                        '/admin/world-builder/nodes/{node_id}/open-practice-activities',
                        {
                            body: {
                                ...common,
                                next_step: optionalValue(form.nextStep),
                            },
                            params: {
                                header: { 'X-CSRF-Token': token },
                                path: { node_id: createNodeId },
                            },
                        },
                    ));
                }
            } else if (type === 'review' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/review',
                    {
                        body: {
                            ...common,
                            note: optionalValue(form.note),
                            prompt: optionalValue(form.prompt),
                            subtopic: optionalValue(form.subtopic),
                            topic: optionalValue(form.topic),
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'review') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/review-activities',
                    {
                        body: {
                            ...common,
                            note: optionalValue(form.note),
                            prompt: optionalValue(form.prompt),
                            subtopic: optionalValue(form.subtopic),
                            topic: optionalValue(form.topic),
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: createNodeId },
                        },
                    },
                ));
            } else if (type === 'reflection' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/reflection',
                    {
                        body: {
                            ...common,
                            note: optionalValue(form.note),
                            prompt: optionalValue(form.prompt),
                            subtopic: optionalValue(form.subtopic),
                            topic: optionalValue(form.topic),
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'reflection') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/reflection-activities',
                    {
                        body: {
                            ...common,
                            note: optionalValue(form.note),
                            prompt: optionalValue(form.prompt),
                            subtopic: optionalValue(form.subtopic),
                            topic: optionalValue(form.topic),
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: createNodeId },
                        },
                    },
                ));
            } else if (type === 'item_grant' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/item-grant',
                    {
                        body: {
                            ...common,
                            background_dark: optionalValue(form.backgroundDark),
                            background_light: optionalValue(
                                form.backgroundLight,
                            ),
                            background_mirrored: form.backgroundMirrored,
                            items: completeItemGrant.items,
                            probability_percent:
                                completeItemGrant.probabilityPercent,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'item_grant') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/item-grant-activities',
                    {
                        body: {
                            ...common,
                            background_dark: optionalValue(form.backgroundDark),
                            background_light: optionalValue(
                                form.backgroundLight,
                            ),
                            background_mirrored: form.backgroundMirrored,
                            items: completeItemGrant.items,
                            probability_percent:
                                completeItemGrant.probabilityPercent,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: createNodeId },
                        },
                    },
                ));
            } else if (type === 'obstacle' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/obstacle',
                    {
                        body: {
                            ...common,
                            ...completeObstacle,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'obstacle') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/obstacle-activities',
                    {
                        body: { ...common, ...completeObstacle },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: createNodeId },
                        },
                    },
                ));
            } else if (type === 'item_obstacle' && activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/item-obstacle',
                    {
                        body: {
                            ...common,
                            ...completeItemObstacle,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else if (type === 'item_obstacle') {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/item-obstacle-activities',
                    {
                        body: { ...common, ...completeItemObstacle },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: createNodeId },
                        },
                    },
                ));
            } else if (activity) {
                ({ response } = await apiClient.PATCH(
                    '/admin/world-builder/activities/{activity_id}/tool-grant',
                    {
                        body: {
                            ...common,
                            ...completeToolGrant,
                            updated_at: activity.updated_at,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { activity_id: activity.id },
                        },
                    },
                ));
            } else {
                ({ response } = await apiClient.POST(
                    '/admin/world-builder/nodes/{node_id}/tool-grant-activities',
                    {
                        body: { ...common, ...completeToolGrant },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { node_id: createNodeId },
                        },
                    },
                ));
            }

            if (!response.ok) {
                setError(
                    response.status === 409
                        ? 'This activity changed elsewhere. Close this form, reload the graph, and review the newer version.'
                        : 'The activity could not be saved. Check the field values and try again.',
                );
                return;
            }
            onSaved();
        } catch {
            setError(
                'The activity could not be saved. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="activity-author-dialog-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            role="dialog"
        >
            <form
                className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                onSubmit={(event) => void save(event)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            Activity graph
                        </p>
                        <h2
                            className="mt-1 text-xl font-semibold"
                            id="activity-author-dialog-title"
                        >
                            {isEditing
                                ? `Edit ${typeLabel}`
                                : template
                                  ? `Copy ${typeLabel} template`
                                  : `Add ${typeLabel}`}
                        </h2>
                    </div>
                    <button
                        aria-label="Close activity form"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {error ? (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        {error}
                    </p>
                ) : null}

                {template && copyTargets.length > 0 ? (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                        <label className="grid gap-2 text-sm font-medium">
                            Copy into MapAsset
                            <select
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-950"
                                onChange={(event) => {
                                    const nextTargetNodeId = event.target.value;
                                    setTargetNodeId(nextTargetNodeId);
                                    if (nextTargetNodeId !== nodeId) {
                                        setForm((current) => ({
                                            ...current,
                                            messageTopicId: '',
                                            messageTopicTitle: '',
                                            portalTargetId: '',
                                        }));
                                    }
                                }}
                                value={targetNodeId}
                            >
                                {copyTargets.map((map) => (
                                    <optgroup key={map.id} label={map.title}>
                                        {map.nodes.map((node) => (
                                            <option key={node.id} value={node.id}>
                                                {node.title}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </label>
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Choose the destination MapAsset. Moving a copy clears
                            its message topic and portal destination so they do
                            not point at the source context by accident.
                        </p>
                    </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <ActivityTextField
                        autoFocus
                        label="Title"
                        onChange={(value) => updateField('title', value)}
                        required
                        value={form.title}
                    />
                    <ActivityTextField
                        label="Optional slug"
                        onChange={(value) => updateField('slug', value)}
                        value={form.slug}
                    />
                    <ActivityTextField
                        className="md:col-span-2"
                        label="Introduction"
                        onChange={(value) => updateField('introduction', value)}
                        textarea
                        value={form.introduction}
                    />
                    {type === 'open_practice' ? (
                        <ActivityTextField
                            className="md:col-span-2"
                            label="Learner invitation"
                            onChange={(value) => updateField('nextStep', value)}
                            textarea
                            value={form.nextStep}
                        />
                    ) : type === 'reflection' || type === 'review' ? (
                        <>
                            <ActivityTextField
                                className="md:col-span-2"
                                label="Question"
                                onChange={(value) =>
                                    updateField('prompt', value)
                                }
                                textarea
                                value={form.prompt}
                            />
                            <ActivityTextField
                                label="Journal topic"
                                onChange={(value) =>
                                    updateField('topic', value)
                                }
                                value={form.topic}
                            />
                            <ActivityTextField
                                label="Optional subtopic"
                                onChange={(value) =>
                                    updateField('subtopic', value)
                                }
                                value={form.subtopic}
                            />
                            <ActivityTextField
                                className="md:col-span-2"
                                label="Supporting note"
                                onChange={(value) => updateField('note', value)}
                                value={form.note}
                            />
                        </>
                    ) : type === 'markdown' ? (
                        <MarkdownActivityFields form={form} onChange={setForm} />
                    ) : type === 'portal' ? (
                        <PortalActivityFields
                            candidates={portalCandidates}
                            form={form}
                            onChange={setForm}
                        />
                    ) : type === 'item_grant' ? (
                        <ItemGrantFields
                            form={form}
                            items={items}
                            onChange={setForm}
                        />
                    ) : type === 'item_obstacle' ? (
                        <ItemObstacleFields
                            form={form}
                            items={items}
                            onChange={setForm}
                            sounds={sounds}
                        />
                    ) : type === 'obstacle' ? (
                        <ObstacleFields
                            form={form.obstacle}
                            onChange={(obstacle) =>
                                setForm((current) => ({ ...current, obstacle }))
                            }
                            tools={tools}
                        />
                    ) : type === 'question' ? (
                        <QuestionFields form={form} onChange={setForm} />
                    ) : type === 'shared_task' ? (
                        <SharedTaskFields form={form} onChange={setForm} />
                    ) : type === 'message_prompt' || type === 'message_wall' ? (
                        <MessageActivityFields form={form} onChange={setForm} topics={messageTopics} type={type} />
                    ) : (
                        <ToolGrantFields
                            form={form}
                            onChange={setForm}
                            tools={tools}
                        />
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        disabled={saving}
                        type="submit"
                    >
                        {saving
                            ? 'Saving…'
                            : isEditing
                              ? 'Save activity'
                              : 'Create activity'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function QuestionFields({ form, onChange }: { form: ActivityAuthorForm; onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>> }) {
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) => onChange((current) => ({ ...current, [field]: value }));
    const updateOption = (index: number, update: (option: ActivityAuthorForm['questionOptions'][number]) => ActivityAuthorForm['questionOptions'][number]) => onChange((current) => ({ ...current, questionOptions: current.questionOptions.map((option, optionIndex) => optionIndex === index ? update(option) : option) }));
    return <>
        <ActivityTextField className="md:col-span-2" label="Question prompt" onChange={(value) => update('questionPrompt', value)} required textarea value={form.questionPrompt} />
        <ActivityTextField label="Correct feedback" onChange={(value) => update('questionFeedbackCorrect', value)} textarea value={form.questionFeedbackCorrect} />
        <ActivityTextField label="Incorrect feedback" onChange={(value) => update('questionFeedbackIncorrect', value)} textarea value={form.questionFeedbackIncorrect} />
        <ActivityTextField className="md:col-span-2" label="Explanation shown after answering" onChange={(value) => update('questionExplanation', value)} textarea value={form.questionExplanation} />
        <label className="flex items-center gap-3 text-sm font-medium md:col-span-2"><input checked={form.questionAllowMultiple} onChange={(event) => update('questionAllowMultiple', event.target.checked)} type="checkbox" />Allow selecting more than one answer</label>
        <div className="grid gap-4 md:col-span-2"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Answers</p><p className="text-sm text-slate-500 dark:text-slate-400">Mark correct answers and optionally connect an outcome key to a matching graph edge.</p></div><button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/20" disabled={form.questionOptions.length >= 12} onClick={() => onChange((current) => ({ ...current, questionOptions: [...current.questionOptions, emptyQuestionOption(String.fromCharCode(65 + current.questionOptions.length))] }))} type="button">Add answer</button></div>{form.questionOptions.map((option, index) => <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5" key={`question-option-${index}`}><div className="flex items-center justify-between"><p className="text-sm font-semibold">Answer {option.label || index + 1}</p><button className="text-sm text-red-700 disabled:opacity-50 dark:text-red-300" disabled={form.questionOptions.length <= 2} onClick={() => onChange((current) => ({ ...current, questionOptions: current.questionOptions.filter((_, optionIndex) => optionIndex !== index) }))} type="button">Remove</button></div><ActivityTextField label="Label" onChange={(value) => updateOption(index, (current) => ({ ...current, label: value }))} value={option.label} /><ActivityTextField className="md:col-span-2" label="Answer text" onChange={(value) => updateOption(index, (current) => ({ ...current, body: value }))} textarea value={option.body} /><ActivityTextField label="Outcome key (optional)" onChange={(value) => updateOption(index, (current) => ({ ...current, outcomeKey: value }))} value={option.outcomeKey} /><ActivityTextField label="Answer feedback (optional)" onChange={(value) => updateOption(index, (current) => ({ ...current, feedback: value }))} value={option.feedback} /><label className="flex items-center gap-3 text-sm font-medium"><input checked={option.isCorrect} onChange={(event) => updateOption(index, (current) => ({ ...current, isCorrect: event.target.checked }))} type="checkbox" />Correct answer</label></div>)}</div>
    </>;
}

function MarkdownActivityFields({
    form,
    onChange,
}: {
    form: ActivityAuthorForm;
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
}) {
    const [selectedPageId, setSelectedPageId] = useState<string | null>(
        form.markdownPages[0]?.id ?? null,
    );
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const selectedPage = form.markdownPages.find(
        (page) => page.id === selectedPageId,
    );
    const pages = form.markdownPages;
    const nodes = [
        {
            data: { label: 'Start' },
            id: 'start',
            position: form.markdownGraphLayout.start ?? { x: -160, y: 80 },
            sourcePosition: Position.Right,
            type: 'input',
        },
        ...pages.map((page) => ({
            data: { label: page.title },
            id: page.id,
            position: page.position,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        })),
        {
            data: { label: 'End' },
            id: 'end',
            position: form.markdownGraphLayout.end ?? { x: 520, y: 80 },
            targetPosition: Position.Left,
            type: 'output',
        },
    ];
    const edges = form.markdownTransitions.map((transition) => ({
        id: transition.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        source: transition.from,
        target: transition.to,
    }));
    const updatePage = (
        pageId: string,
        update: (page: MarkdownPageDraft) => MarkdownPageDraft,
    ) => onChange((current) => ({
        ...current,
        markdownPages: current.markdownPages.map((page) =>
            page.id === pageId ? update(page) : page,
        ),
    }));
    const addPage = () => {
        const nextNumber = form.markdownPages.length + 1;
        const id = `page-${Date.now()}`;
        const page = defaultMarkdownPage();
        page.body = `# Page ${nextNumber}\n\nAdd markdown content here.`;
        page.id = id;
        page.position = { x: 140 + nextNumber * 260, y: 80 + (nextNumber % 2) * 160 };
        page.title = `Page ${nextNumber}`;
        onChange((current) => ({
            ...current,
            markdownPages: [...current.markdownPages, page],
        }));
        setSelectedPageId(id);
    };
    const connectPages = (connection: Connection) => {
        if (!connection.source || !connection.target) return;
        onChange((current) => ({
            ...current,
            markdownTransitions: [
                ...current.markdownTransitions.filter((edge) => edge.from !== connection.source),
                { from: connection.source, id: `markdown-edge-${Date.now()}`, to: connection.target },
            ],
        }));
    };
    const deletePage = (pageId: string) => {
        onChange((current) => ({
            ...current,
            markdownPages: current.markdownPages.filter((page) => page.id !== pageId),
            markdownTransitions: current.markdownTransitions.filter((edge) => edge.from !== pageId && edge.to !== pageId),
        }));
        setSelectedPageId(null);
    };
    const appendMedia = (url: string) => {
        if (!selectedPage) return;
        updatePage(selectedPage.id, (page) => ({
            ...page,
            body: `${page.body.trimEnd()}\n\n![Media](${url})\n`,
        }));
        setIsPickerOpen(false);
    };

    return <section className="grid gap-4 md:col-span-2">
        <div>
            <p className="text-sm font-semibold">Markdown page graph</p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Connect Start to a page, chain pages, then connect the final page to End.</p>
        </div>
        <div className="h-80 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <ReactFlow
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.28 }}
                nodes={nodes}
                onConnect={connectPages}
                onEdgeClick={(_, edge) => onChange((current) => ({ ...current, markdownTransitions: current.markdownTransitions.filter((transition) => transition.id !== edge.id) }))}
                onNodeClick={(_, node) => setSelectedPageId(pages.some((page) => page.id === node.id) ? node.id : null)}
                onNodeDragStop={(_, node) => {
                    const position = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
                    if (node.id === 'start' || node.id === 'end') {
                        onChange((current) => ({ ...current, markdownGraphLayout: { ...current.markdownGraphLayout, [node.id]: position } }));
                    } else {
                        updatePage(node.id, (page) => ({ ...page, position }));
                    }
                }}
            >
                <Background gap={24} />
                <Controls />
                <MiniMap pannable zoomable />
            </ReactFlow>
        </div>
        <div className="flex justify-end">
            <button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium dark:border-white/20" disabled={pages.length >= 30} onClick={addPage} type="button"><Plus className="size-4" />Add page</button>
        </div>
        {selectedPage ? <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
                <ActivityTextField label="Selected page" onChange={(title) => updatePage(selectedPage.id, (page) => ({ ...page, title }))} value={selectedPage.title} />
                <button className="mt-6 rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-300/10" disabled={pages.length <= 1} onClick={() => deletePage(selectedPage.id)} type="button">Delete</button>
            </div>
            <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><label className="text-sm font-medium" htmlFor="markdown-page-body">Markdown</label><button className="rounded-md border border-slate-300 px-2 py-1 text-sm font-medium dark:border-white/20" onClick={() => setIsPickerOpen(true)} type="button">Insert existing image</button></div>
                <textarea aria-label="Markdown" className="min-h-56 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-950 dark:border-white/10 dark:bg-slate-950 dark:text-white" id="markdown-page-body" onChange={(event) => updatePage(selectedPage.id, (page) => ({ ...page, body: event.target.value }))} value={selectedPage.body} />
            </div>
            <MarkdownPagePreview page={selectedPage} />
            <div className="grid gap-3 md:grid-cols-2">
                <MarkdownColorField label="Dark page" onChange={(pageColorDark) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, pageColorDark } }))} value={selectedPage.visual.pageColorDark} />
                <MarkdownColorField label="Dark border" onChange={(borderColorDark) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, borderColorDark } }))} value={selectedPage.visual.borderColorDark} />
                <MarkdownColorField label="Dark text" onChange={(textColorDark) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, textColorDark } }))} value={selectedPage.visual.textColorDark} />
                <MarkdownColorField label="Dark headings" onChange={(headingColorDark) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, headingColorDark } }))} value={selectedPage.visual.headingColorDark} />
                <MarkdownColorField label="Light page" onChange={(pageColorLight) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, pageColorLight } }))} value={selectedPage.visual.pageColorLight} />
                <MarkdownColorField label="Light border" onChange={(borderColorLight) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, borderColorLight } }))} value={selectedPage.visual.borderColorLight} />
                <MarkdownColorField label="Light text" onChange={(textColorLight) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, textColorLight } }))} value={selectedPage.visual.textColorLight} />
                <MarkdownColorField label="Light headings" onChange={(headingColorLight) => updatePage(selectedPage.id, (page) => ({ ...page, visual: { ...page.visual, headingColorLight } }))} value={selectedPage.visual.headingColorLight} />
            </div>
        </section> : null}
        {isPickerOpen ? <MediaPicker onClose={() => setIsPickerOpen(false)} onSelect={(asset) => appendMedia(asset.url)} /> : null}
    </section>;
}

function MarkdownPagePreview({ page }: { page: MarkdownPageDraft }) {
    const body = page.body.split('\n').filter((line) => line.trim() !== '').slice(0, 3).join(' ').replace(/^#+\s*/, '');
    return <div className="grid gap-2"><div><p className="text-sm font-semibold">Page preview</p><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Uses the current appearance mode.</p></div><div className="rounded-xl border p-5 shadow-sm dark:hidden" style={{ backgroundColor: page.visual.pageColorLight, borderColor: page.visual.borderColorLight, color: page.visual.textColorLight }}><h3 className="mb-3 text-xl font-semibold" style={{ color: page.visual.headingColorLight }}>{page.title}</h3><p className="text-sm leading-6">{body || 'Markdown content preview appears here.'}</p></div><div className="hidden rounded-xl border p-5 shadow-sm dark:block" style={{ backgroundColor: page.visual.pageColorDark, borderColor: page.visual.borderColorDark, color: page.visual.textColorDark }}><h3 className="mb-3 text-xl font-semibold" style={{ color: page.visual.headingColorDark }}>{page.title}</h3><p className="text-sm leading-6">{body || 'Markdown content preview appears here.'}</p></div></div>;
}

function MarkdownColorField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
    return <label className="grid gap-2 text-sm font-medium">{label}<input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-slate-950/40" onChange={(event) => onChange(event.target.value)} type="color" value={value} /></label>;
}

function PortalActivityFields({
    candidates,
    form,
    onChange,
}: {
    candidates: PortalCandidate[];
    form: ActivityAuthorForm;
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
}) {
    type PortalMediaTarget =
        | 'portalBackgroundDark'
        | 'portalBackgroundLight'
        | 'portalForegroundDark'
        | 'portalForegroundLight'
        | `asset:${string}:imageDark`
        | `asset:${string}:imageLight`;
    const [mediaTarget, setMediaTarget] = useState<PortalMediaTarget | null>(null);
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) =>
        onChange((current) => ({ ...current, [field]: value }));
    const updateAsset = (assetId: string, changes: Partial<PortalAssetDraft>) =>
        onChange((current) => ({
            ...current,
            portalAssets: current.portalAssets.map((asset) => asset.id === assetId ? { ...asset, ...changes } : asset),
        }));
    const selectMedia = (asset: MediaAsset) => {
        if (!mediaTarget) return;
        if (mediaTarget.startsWith('asset:')) {
            const [, id, field] = mediaTarget.split(':');
            updateAsset(id, { [field]: asset.url } as Partial<PortalAssetDraft>);
        } else {
            update(mediaTarget as keyof ActivityAuthorForm, asset.url);
        }
        setMediaTarget(null);
    };
    const previewAssets = form.portalAssets
        .map((asset) => ({
            id: asset.id,
            image: asset.imageDark || asset.imageLight,
            layer: asset.layer,
            mirrored: asset.mirrored,
            opacity: Number(asset.opacity),
            width: Number(asset.width),
            x: Number(asset.x),
            y: Number(asset.y),
        }))
        .filter((asset) => asset.image);
    const bubbleStyle = {
        backgroundColor: form.portalBubbleColorLight,
        borderColor: form.portalBubbleBorderColorLight,
        color: form.portalBubbleTextColorLight,
    };
    return <section className="grid gap-5 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
        <div>
            <h3 className="text-sm font-semibold">Portal route</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Choose whether this portal starts travel or receives a traveller.</p>
        </div>
        <label className="grid gap-2 text-sm font-medium">
            Portal direction
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/40" onChange={(event) => onChange((current) => ({ ...current, portalMode: event.target.value as 'input' | 'output', portalTargetId: event.target.value === 'input' ? '' : current.portalTargetId }))} value={form.portalMode}>
                <option value="input">Exit portal</option>
                <option value="output">Entry portal</option>
            </select>
        </label>
        {form.portalMode === 'input' ? <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10"><input checked={form.portalShowOnArrival} className="mt-1" onChange={(event) => update('portalShowOnArrival', event.target.checked)} type="checkbox" /><span><span className="block font-medium">Show this exit portal when arriving</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Disable this when the arrival should complete silently and continue to the next connected activity.</span></span></label> : <label className="grid gap-2 rounded-lg border border-slate-200 p-3 text-sm font-medium dark:border-white/10">Travel target<select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/40" onChange={(event) => update('portalTargetId', event.target.value)} value={form.portalTargetId}><option value="">No target yet</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.map_title} / {candidate.node_title} / {candidate.title}</option>)}</select><span className="text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">Entry portals end this activity path and move learners to the selected exit portal.</span></label>}
        <div className="border-t border-slate-200 pt-4 dark:border-white/10"><h3 className="text-sm font-semibold">Portal visuals</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Theme-specific portal images, timing and motion.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
            {([
                ['portalBackgroundDark', 'Dark background image'],
                ['portalBackgroundLight', 'Light background image'],
                ['portalForegroundDark', 'Dark swirl image'],
                ['portalForegroundLight', 'Light swirl image'],
            ] as Array<[Extract<PortalMediaTarget, string>, string]>).map(([field, label]) => <ActivityTextField key={field} label={label} onChange={(value) => update(field as keyof ActivityAuthorForm, value)} onSelectExisting={() => setMediaTarget(field)} value={String(form[field as keyof ActivityAuthorForm])} />)}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
            <ToolGrantNumberField label="Portal duration" max={60} min={0.5} onChange={(value) => update('portalDurationSeconds', value)} suffix="seconds" value={form.portalDurationSeconds} />
            <ToolGrantNumberField label="Swirl X" max={100} min={0} onChange={(value) => update('portalForegroundX', value)} suffix="%" value={form.portalForegroundX} />
            <ToolGrantNumberField label="Swirl Y" max={100} min={0} onChange={(value) => update('portalForegroundY', value)} suffix="%" value={form.portalForegroundY} />
            <ToolGrantNumberField label="Swirl width" max={100} min={1} onChange={(value) => update('portalForegroundWidth', value)} suffix="%" value={form.portalForegroundWidth} />
            <ToolGrantNumberField label="Typing speed" max={500} min={1} onChange={(value) => update('portalBubbleTypingSpeed', value)} suffix="ms" value={form.portalBubbleTypingSpeed} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-medium"><input checked={form.portalBackgroundMirrored} onChange={(event) => update('portalBackgroundMirrored', event.target.checked)} type="checkbox" />Mirror background horizontally</label>
            <label className="flex items-center gap-3 text-sm font-medium"><input checked={form.portalForegroundMirrored} onChange={(event) => update('portalForegroundMirrored', event.target.checked)} type="checkbox" />Mirror swirl horizontally</label>
            <label className="flex items-center gap-3 text-sm font-medium"><input checked={form.portalSwirlEnabled} onChange={(event) => update('portalSwirlEnabled', event.target.checked)} type="checkbox" />Rotate swirl image</label>
            <label className="flex items-center gap-3 text-sm font-medium"><input checked={form.portalWaitForEnter} onChange={(event) => update('portalWaitForEnter', event.target.checked)} type="checkbox" />Wait for Enter before traversing</label>
        </div>
        <ActivityTextField className="md:col-span-2" label="Bubble text" onChange={(value) => update('portalBubbleText', value)} textarea value={form.portalBubbleText} />
        <div className="grid gap-4 md:grid-cols-2">
            <ToolGrantColorField label="Dark bubble color" onChange={(value) => update('portalBubbleColorDark', value)} value={form.portalBubbleColorDark} />
            <ToolGrantColorField label="Light bubble color" onChange={(value) => update('portalBubbleColorLight', value)} value={form.portalBubbleColorLight} />
            <ToolGrantColorField label="Dark bubble border" onChange={(value) => update('portalBubbleBorderColorDark', value)} value={form.portalBubbleBorderColorDark} />
            <ToolGrantColorField label="Light bubble border" onChange={(value) => update('portalBubbleBorderColorLight', value)} value={form.portalBubbleBorderColorLight} />
            <ToolGrantColorField label="Dark bubble text" onChange={(value) => update('portalBubbleTextColorDark', value)} value={form.portalBubbleTextColorDark} />
            <ToolGrantColorField label="Light bubble text" onChange={(value) => update('portalBubbleTextColorLight', value)} value={form.portalBubbleTextColorLight} />
        </div>
        <div className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Additional scene assets</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Layer extra images into the portal scene.</p></div><button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/20" disabled={form.portalAssets.length >= 20} onClick={() => onChange((current) => ({ ...current, portalAssets: [...current.portalAssets, { id: `portal-asset-${Date.now()}`, imageDark: '', imageLight: '', label: `Asset ${current.portalAssets.length + 1}`, layer: 'above-background', mirrored: false, opacity: '100', width: '28', x: '50', y: '50' }] }))} type="button">Add asset</button></div>{form.portalAssets.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-white/10">No extra portal assets yet.</p> : form.portalAssets.map((asset) => <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10" key={asset.id}><div className="flex items-center justify-between gap-3"><ActivityTextField label="Asset label" onChange={(label) => updateAsset(asset.id, { label })} value={asset.label} /><button className="text-sm font-medium text-red-700 dark:text-red-300" onClick={() => onChange((current) => ({ ...current, portalAssets: current.portalAssets.filter((candidate) => candidate.id !== asset.id) }))} type="button">Remove</button></div><div className="grid gap-4 md:grid-cols-2"><ActivityTextField label="Dark mode image" onChange={(imageDark) => updateAsset(asset.id, { imageDark })} onSelectExisting={() => setMediaTarget(`asset:${asset.id}:imageDark`)} value={asset.imageDark} /><ActivityTextField label="Light mode image" onChange={(imageLight) => updateAsset(asset.id, { imageLight })} onSelectExisting={() => setMediaTarget(`asset:${asset.id}:imageLight`)} value={asset.imageLight} /></div><div className="grid gap-4 md:grid-cols-5"><label className="grid gap-2 text-sm font-medium md:col-span-2">Layer<select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/40" onChange={(event) => updateAsset(asset.id, { layer: event.target.value as PortalAssetDraft['layer'] })} value={asset.layer}><option value="behind-background">Behind background</option><option value="above-background">Above background</option><option value="above-foreground">Above swirl</option><option value="front">Front</option></select></label><ToolGrantNumberField label="X" max={100} min={0} onChange={(x) => updateAsset(asset.id, { x })} suffix="%" value={asset.x} /><ToolGrantNumberField label="Y" max={100} min={0} onChange={(y) => updateAsset(asset.id, { y })} suffix="%" value={asset.y} /><ToolGrantNumberField label="Width" max={160} min={1} onChange={(width) => updateAsset(asset.id, { width })} suffix="%" value={asset.width} /></div><div className="grid gap-4 md:grid-cols-2"><ToolGrantNumberField label="Opacity" max={100} min={0} onChange={(opacity) => updateAsset(asset.id, { opacity })} suffix="%" value={asset.opacity} /><label className="flex items-center gap-3 text-sm font-medium"><input checked={asset.mirrored} onChange={(event) => updateAsset(asset.id, { mirrored: event.target.checked })} type="checkbox" />Mirror asset horizontally</label></div></div>)}</div>
        <div className="grid gap-2"><h3 className="text-sm font-semibold">Preview</h3><p className="text-sm leading-6 text-slate-500 dark:text-slate-400">Uses the current appearance mode and falls back to the other image when needed.</p><PortalScene assets={previewAssets} backgroundImage={form.portalBackgroundLight || form.portalBackgroundDark} backgroundMirrored={form.portalBackgroundMirrored} className="min-h-64" foregroundImage={form.portalForegroundLight || form.portalForegroundDark} foregroundMirrored={form.portalForegroundMirrored} foregroundWidth={Number(form.portalForegroundWidth)} foregroundX={Number(form.portalForegroundX)} foregroundY={Number(form.portalForegroundY)} swirlEnabled={form.portalSwirlEnabled}><div className="relative z-30 mt-auto w-full bg-white/72 p-4 backdrop-blur dark:bg-slate-950/72">{form.portalBubbleText ? <div className="rounded-lg border p-3 text-sm leading-6" style={bubbleStyle}>{form.portalBubbleText}</div> : <p className="text-sm text-slate-600 dark:text-slate-300">Portal bubble preview.</p>}</div></PortalScene></div>
        {mediaTarget ? <MediaPicker onClose={() => setMediaTarget(null)} onSelect={selectMedia} /> : null}
    </section>;
}

function emptyQuestionOption(label: string): ActivityAuthorForm['questionOptions'][number] {
    return { body: '', feedback: '', isCorrect: false, key: '', label, outcomeKey: '', weights: {} };
}

function MessageActivityFields({ form, onChange, topics, type }: { form: ActivityAuthorForm; onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>; topics: MessageTopic[]; type: 'message_prompt' | 'message_wall' }) {
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) => onChange((current) => ({ ...current, [field]: value }));
    return <>
        <label className="grid gap-2 text-sm font-medium md:col-span-2">Message topic<select value={form.messageTopicId || '__new'} onChange={(event) => onChange((current) => ({ ...current, messageTopicId: event.target.value === '__new' ? '' : event.target.value, messageTopicTitle: event.target.value === '__new' ? current.messageTopicTitle : '' }))}><option value="__new">Create new topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
        {!form.messageTopicId ? <ActivityTextField className="md:col-span-2" label="New topic name" onChange={(value) => update('messageTopicTitle', value)} value={form.messageTopicTitle} /> : null}
        {type === 'message_prompt' ? <label className="grid gap-2 text-sm font-medium">Who should receive this?<select value={form.messageAudience} onChange={(event) => update('messageAudience', event.target.value as 'peers' | 'support')}><option value="peers">Share with peers</option><option value="support">Ask learning support</option></select></label> : <label className="flex items-center gap-3 text-sm font-medium"><input checked={form.messageAllowResponses} onChange={(event) => update('messageAllowResponses', event.target.checked)} type="checkbox" />Invite optional peer responses</label>}
        {type === 'message_prompt' ? <><ActivityTextField className="md:col-span-2" label="Prompt" onChange={(value) => update('prompt', value)} textarea value={form.prompt} /><ActivityTextField label="Input label" onChange={(value) => update('messageInputLabel', value)} value={form.messageInputLabel} /></> : <p className="text-sm leading-6 text-slate-500 dark:text-slate-400 md:col-span-2">Closing the wall completes this activity and follows its configured output connector.</p>}
        {type === 'message_wall' && form.messageAllowResponses ? <ActivityTextField className="md:col-span-2" label="Response guidance" onChange={(value) => update('messageResponsePrompt', value)} textarea value={form.messageResponsePrompt} /> : null}
        <div className="grid gap-4 md:col-span-2">
            <div className="relative min-h-52 overflow-hidden rounded-lg border p-5" style={{ backgroundColor: form.messageSurfaceColorDark, borderColor: form.messageCardBorderColorDark }}>
                <p className="text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: form.messageAccentColorDark }}>Live preview</p>
                <div className="absolute left-[12%] top-[28%] w-44 -rotate-3 rounded-lg border p-3 text-sm shadow-lg" style={{ backgroundColor: form.messageCardColorDark, borderColor: form.messageCardBorderColorDark, color: form.messageTextColorDark }}>A small clue can make the next step easier.</div>
                <div className="absolute left-[55%] top-[16%] w-44 rotate-2 rounded-lg border p-3 text-sm shadow-lg" style={{ backgroundColor: form.messageCardColorDark, borderColor: form.messageCardBorderColorDark, color: form.messageTextColorDark }}>Take your time and look at the details.</div>
                <div className="absolute left-[35%] top-[58%] w-44 -rotate-1 rounded-lg border p-3 text-sm shadow-lg" style={{ backgroundColor: form.messageCardColorDark, borderColor: form.messageCardBorderColorDark, color: form.messageTextColorDark }}>You are allowed to try another path.</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <MessageColorField label="Surface - dark" onChange={(value) => update('messageSurfaceColorDark', value)} value={form.messageSurfaceColorDark} />
                <MessageColorField label="Surface - light" onChange={(value) => update('messageSurfaceColorLight', value)} value={form.messageSurfaceColorLight} />
                <MessageColorField label="Card - dark" onChange={(value) => update('messageCardColorDark', value)} value={form.messageCardColorDark} />
                <MessageColorField label="Card - light" onChange={(value) => update('messageCardColorLight', value)} value={form.messageCardColorLight} />
                <MessageColorField label="Card border - dark" onChange={(value) => update('messageCardBorderColorDark', value)} value={form.messageCardBorderColorDark} />
                <MessageColorField label="Card border - light" onChange={(value) => update('messageCardBorderColorLight', value)} value={form.messageCardBorderColorLight} />
                <MessageColorField label="Text - dark" onChange={(value) => update('messageTextColorDark', value)} value={form.messageTextColorDark} />
                <MessageColorField label="Text - light" onChange={(value) => update('messageTextColorLight', value)} value={form.messageTextColorLight} />
                <MessageColorField label="Accent - dark" onChange={(value) => update('messageAccentColorDark', value)} value={form.messageAccentColorDark} />
                <MessageColorField label="Accent - light" onChange={(value) => update('messageAccentColorLight', value)} value={form.messageAccentColorLight} />
            </div>
        </div>
    </>;
}

function MessageColorField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
    return <label className="grid gap-2 text-sm font-medium">{label}<span className="flex gap-2"><input aria-label={`${label} picker`} className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-950/40" onChange={(event) => onChange(event.target.value)} type="color" value={value} /><input aria-label={label} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white" maxLength={7} onChange={(event) => onChange(event.target.value)} value={value} /></span></label>;
}

function SharedTaskFields({ form, onChange }: { form: ActivityAuthorForm; onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>> }) {
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) => onChange((current) => ({ ...current, [field]: value }));
    return <>
        <label className="grid gap-2 text-sm font-medium">Task kind<select value={form.sharedTaskKind} onChange={(event) => update('sharedTaskKind', event.target.value)}><option value="text">Text</option><option value="question">Question</option><option value="reflection">Reflection</option></select></label>
        <label className="grid gap-2 text-sm font-medium">Repeat policy<select value={form.sharedTaskRepeatPolicy} onChange={(event) => update('sharedTaskRepeatPolicy', event.target.value)}><option value="once_per_user">Once per user</option><option value="unlimited">Unlimited</option></select></label>
        <ActivityTextField label="Threshold" onChange={(value) => update('sharedTaskThreshold', value)} value={form.sharedTaskThreshold} />
        <ActivityTextField label="Minimum text length" onChange={(value) => update('sharedTaskMinimumLength', value)} value={form.sharedTaskMinimumLength} />
        <label className="grid gap-2 text-sm font-medium md:col-span-2">Prompt<textarea className="min-h-28 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/40" onChange={(event) => update('prompt', event.target.value)} value={form.prompt} /></label>
        <ActivityTextField label="Input label" onChange={(value) => update('sharedTaskInputLabel', value)} value={form.sharedTaskInputLabel} />
        <ActivityTextField label="Instructions" onChange={(value) => update('sharedTaskInstructions', value)} value={form.sharedTaskInstructions} />
        <ActivityTextField label="Shared goal" onChange={(value) => update('sharedTaskProjectGoal', value)} value={form.sharedTaskProjectGoal} />
        <ActivityTextField label="Useful outcome" onChange={(value) => update('sharedTaskProjectDeliverable', value)} value={form.sharedTaskProjectDeliverable} />
        <ActivityTextField className="md:col-span-2" label="Suggested steps (one per line, up to 6)" onChange={(value) => update('sharedTaskProjectSteps', value)} textarea value={form.sharedTaskProjectSteps} />
        <label className="flex items-center gap-3 text-sm font-medium md:col-span-2"><input checked={form.sharedTaskShowContributions} onChange={(event) => update('sharedTaskShowContributions', event.target.checked)} type="checkbox" />Allow anonymous contributions to be shown</label>
        <label className="flex items-center gap-3 text-sm font-medium md:col-span-2"><input checked={form.sharedTaskPeerReviewEnabled} onChange={(event) => update('sharedTaskPeerReviewEnabled', event.target.checked)} type="checkbox" />Invite one anonymous peer review</label>
        {form.sharedTaskPeerReviewEnabled ? <ActivityTextField className="md:col-span-2" label="Review invitation" onChange={(value) => update('sharedTaskPeerReviewPrompt', value)} value={form.sharedTaskPeerReviewPrompt} /> : null}
    </>;
}

function ActivityTextField({
    autoFocus = false,
    className,
    label,
    onChange,
    onSelectExisting,
    required = false,
    textarea = false,
    value,
}: {
    autoFocus?: boolean;
    className?: string;
    label: string;
    onChange: (value: string) => void;
    onSelectExisting?: () => void;
    required?: boolean;
    textarea?: boolean;
    value: string;
}) {
    const controlClassName =
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white';

    return (
        <div className={`grid gap-2 ${className ?? ''}`}>
            <label className="grid gap-2 text-sm font-medium">
                {label}
                {textarea ? (
                    <textarea
                        autoFocus={autoFocus}
                        className={`${controlClassName} min-h-28 resize-y`}
                        onChange={(event) => onChange(event.target.value)}
                        required={required}
                        value={value}
                    />
                ) : (
                    <input
                        autoFocus={autoFocus}
                        className={controlClassName}
                        onChange={(event) => onChange(event.target.value)}
                        required={required}
                        value={value}
                    />
                )}
            </label>
            {onSelectExisting ? (
                <button
                    className="justify-self-start rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                    onClick={onSelectExisting}
                    type="button"
                >
                    Select existing
                </button>
            ) : null}
        </div>
    );
}

function ItemGrantFields({
    form,
    items,
    onChange,
}: {
    form: ActivityAuthorForm;
    items: EditableItem[];
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
}) {
    const [mediaTarget, setMediaTarget] = useState<
        'backgroundDark' | 'backgroundLight' | null
    >(null);
    const updateRow = (
        index: number,
        field: 'itemId' | 'quantity',
        value: string,
    ) => {
        onChange((current) => ({
            ...current,
            items: current.items.map((row, rowIndex) =>
                rowIndex === index ? { ...row, [field]: value } : row,
            ),
        }));
    };

    return (
        <>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">
                Probability
                <span className="flex items-center gap-2">
                    <input
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                        max="100"
                        min="0.01"
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                probabilityPercent: event.target.value,
                            }))
                        }
                        step="0.01"
                        type="number"
                        value={form.probabilityPercent}
                    />
                    <span className="text-slate-500">%</span>
                </span>
            </label>
            <section className="grid gap-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">
                        Items granted on success
                    </h3>
                    <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                items: [
                                    ...current.items,
                                    { itemId: '', quantity: '1' },
                                ],
                            }))
                        }
                        type="button"
                    >
                        <Plus className="size-3.5" />
                        Add item
                    </button>
                </div>
                {form.items.map((row, index) => (
                    <div
                        className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_8rem_auto] dark:bg-white/5"
                        key={`${row.itemId}-${index}`}
                    >
                        <select
                            aria-label={`Item ${index + 1}`}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            onChange={(event) =>
                                updateRow(index, 'itemId', event.target.value)
                            }
                            value={row.itemId}
                        >
                            <option value="">Select item</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </select>
                        <input
                            aria-label={`Quantity for item ${index + 1}`}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            max="999"
                            min="1"
                            onChange={(event) =>
                                updateRow(index, 'quantity', event.target.value)
                            }
                            type="number"
                            value={row.quantity}
                        />
                        <button
                            aria-label="Remove item grant row"
                            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-300/10 dark:hover:text-red-300"
                            onClick={() =>
                                onChange((current) => ({
                                    ...current,
                                    items: current.items.filter(
                                        (_, rowIndex) => rowIndex !== index,
                                    ),
                                }))
                            }
                            type="button"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
            </section>
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div>
                    <h3 className="text-sm font-medium">Grant item scene</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Configure the authored scene assets for each appearance.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <ActivityTextField
                        label="Dark background"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                backgroundDark: value,
                            }))
                        }
                        onSelectExisting={() => setMediaTarget('backgroundDark')}
                        value={form.backgroundDark}
                    />
                    <ActivityTextField
                        label="Light background"
                        onChange={(value) =>
                            onChange((current) => ({
                                ...current,
                                backgroundLight: value,
                            }))
                        }
                        onSelectExisting={() => setMediaTarget('backgroundLight')}
                        value={form.backgroundLight}
                    />
                </div>
                <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                        checked={form.backgroundMirrored}
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                backgroundMirrored: event.target.checked,
                            }))
                        }
                        type="checkbox"
                    />
                    Mirror background horizontally
                </label>
            </section>
            {mediaTarget ? (
                <MediaPicker
                    onClose={() => setMediaTarget(null)}
                    onSelect={(media) => {
                        onChange((current) => ({
                            ...current,
                            [mediaTarget]: media.url,
                        }));
                        setMediaTarget(null);
                    }}
                />
            ) : null}
        </>
    );
}

function ItemObstacleFields({
    form,
    items,
    onChange,
    sounds,
}: {
    form: ActivityAuthorForm;
    items: EditableItem[];
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
    sounds: EditableSound[];
}) {
    type ItemObstacleImageField =
        | 'itemObstacleBackgroundDark'
        | 'itemObstacleBackgroundLight'
        | 'itemObstacleMetBackgroundDark'
        | 'itemObstacleMetBackgroundLight'
        | 'itemObstacleOverlayDark'
        | 'itemObstacleOverlayLight';
    const [mediaTarget, setMediaTarget] =
        useState<ItemObstacleImageField | null>(null);
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) =>
        onChange((current) => ({ ...current, [field]: value }));
    const updateSlot = (
        index: number,
        field: 'itemId' | 'x' | 'y' | 'width',
        value: string,
    ) =>
        onChange((current) => ({
            ...current,
            itemObstacleSlots: current.itemObstacleSlots.map(
                (slot, slotIndex) =>
                    slotIndex === index ? { ...slot, [field]: value } : slot,
            ),
        }));

    return (
        <>
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-medium">Required slots</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Each slot requires an owned item before learners can
                            continue.
                        </p>
                    </div>
                    <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
                        disabled={form.itemObstacleSlots.length >= 10}
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                itemObstacleSlots: [
                                    ...current.itemObstacleSlots,
                                    {
                                        itemId: '',
                                        width: '10',
                                        x: '50',
                                        y: '50',
                                    },
                                ],
                            }))
                        }
                        type="button"
                    >
                        <Plus className="size-3.5" />
                        Add slot
                    </button>
                </div>
                {form.itemObstacleSlots.map((slot, index) => (
                    <div
                        className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_repeat(3,5rem)_auto] dark:bg-white/5"
                        key={`${slot.itemId}-${index}`}
                    >
                        <select
                            aria-label={`Required item ${index + 1}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            onChange={(event) =>
                                updateSlot(index, 'itemId', event.target.value)
                            }
                            value={slot.itemId}
                        >
                            <option value="">Select item</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </select>
                        {(['x', 'y', 'width'] as const).map((field) => (
                            <input
                                aria-label={`${field} for required item ${index + 1}`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                                key={field}
                                max="100"
                                min={field === 'width' ? '1' : '0'}
                                onChange={(event) =>
                                    updateSlot(index, field, event.target.value)
                                }
                                type="number"
                                value={slot[field]}
                            />
                        ))}
                        <button
                            aria-label="Remove required item slot"
                            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-300/10 dark:hover:text-red-300"
                            onClick={() =>
                                onChange((current) => ({
                                    ...current,
                                    itemObstacleSlots:
                                        current.itemObstacleSlots.filter(
                                            (_, slotIndex) =>
                                                slotIndex !== index,
                                        ),
                                }))
                            }
                            type="button"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
            </section>
            <ToolGrantNumberField
                label="Failed try lockout (minutes)"
                max={10_080}
                min={0}
                onChange={(value) => update('itemObstacleLockMinutes', value)}
                suffix="min"
                value={form.itemObstacleLockMinutes}
            />
            <label className="flex items-center gap-3 text-sm font-medium">
                <input
                    checked={form.itemObstacleConsumeOnEachEntry}
                    onChange={(event) =>
                        update(
                            'itemObstacleConsumeOnEachEntry',
                            event.target.checked,
                        )
                    }
                    type="checkbox"
                />
                Consume items on every entry
            </label>
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Item obstacle scene</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        ['itemObstacleBackgroundDark', 'Dark background'],
                        ['itemObstacleBackgroundLight', 'Light background'],
                        [
                            'itemObstacleMetBackgroundDark',
                            'Dark met background',
                        ],
                        [
                            'itemObstacleMetBackgroundLight',
                            'Light met background',
                        ],
                        ['itemObstacleOverlayDark', 'Dark overlay image'],
                        ['itemObstacleOverlayLight', 'Light overlay image'],
                    ].map(([field, label]) => (
                        <ActivityTextField
                            key={field}
                            label={label}
                            onChange={(value) =>
                                update(field as keyof ActivityAuthorForm, value)
                            }
                            onSelectExisting={() =>
                                setMediaTarget(field as ItemObstacleImageField)
                            }
                            value={String(
                                form[field as keyof ActivityAuthorForm],
                            )}
                        />
                    ))}
                    <ToolGrantNumberField
                        label="Overlay x position"
                        max={100}
                        min={0}
                        onChange={(value) =>
                            update('itemObstacleOverlayX', value)
                        }
                        suffix="%"
                        value={form.itemObstacleOverlayX}
                    />
                    <ToolGrantNumberField
                        label="Overlay y position"
                        max={100}
                        min={0}
                        onChange={(value) =>
                            update('itemObstacleOverlayY', value)
                        }
                        suffix="%"
                        value={form.itemObstacleOverlayY}
                    />
                    <ToolGrantNumberField
                        label="Overlay width"
                        max={100}
                        min={1}
                        onChange={(value) =>
                            update('itemObstacleOverlayWidth', value)
                        }
                        suffix="%"
                        value={form.itemObstacleOverlayWidth}
                    />
                </div>
                {[
                    [
                        'itemObstacleBackgroundMirrored',
                        'Mirror background horizontally',
                    ],
                    [
                        'itemObstacleMetBackgroundMirrored',
                        'Mirror met background horizontally',
                    ],
                    [
                        'itemObstacleOverlayMirrored',
                        'Mirror overlay horizontally',
                    ],
                ].map(([field, label]) => (
                    <label
                        className="flex items-center gap-3 text-sm font-medium"
                        key={field}
                    >
                        <input
                            checked={Boolean(
                                form[field as keyof ActivityAuthorForm],
                            )}
                            onChange={(event) =>
                                update(
                                    field as keyof ActivityAuthorForm,
                                    event.target.checked,
                                )
                            }
                            type="checkbox"
                        />
                        {label}
                    </label>
                ))}
            </section>
            {mediaTarget ? (
                <MediaPicker
                    onClose={() => setMediaTarget(null)}
                    onSelect={(media) => {
                        update(mediaTarget, media.url);
                        setMediaTarget(null);
                    }}
                />
            ) : null}
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Item obstacle sounds</h3>
                {[
                    ['itemObstacleSoundNotMet', 'Conditions not met'],
                    ['itemObstacleSoundTransition', 'Transition to met'],
                    ['itemObstacleSoundMet', 'Conditions met'],
                ].map(([prefix, label]) => {
                    const enabledField =
                        `${prefix}Enabled` as keyof ActivityAuthorForm;
                    const idField = `${prefix}Id` as keyof ActivityAuthorForm;
                    return (
                        <div
                            className="grid gap-2 md:grid-cols-[auto_1fr]"
                            key={prefix}
                        >
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                    checked={Boolean(form[enabledField])}
                                    onChange={(event) =>
                                        update(
                                            enabledField,
                                            event.target.checked,
                                        )
                                    }
                                    type="checkbox"
                                />
                                {label}
                            </label>
                            <select
                                aria-label={`${label} sound`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                                disabled={!form[enabledField]}
                                onChange={(event) =>
                                    update(idField, event.target.value)
                                }
                                value={String(form[idField])}
                            >
                                <option value="">Select sound</option>
                                {sounds.map((sound) => (
                                    <option key={sound.id} value={sound.id}>
                                        {sound.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </section>
        </>
    );
}

function ObstacleFields({
    form,
    onChange,
    tools,
}: {
    form: ObstacleForm;
    onChange: (form: ObstacleForm) => void;
    tools: EditableTool[];
}) {
    type ObstacleImageField =
        | 'backgroundDark'
        | 'backgroundLight'
        | 'imageDark'
        | 'imageLight'
        | 'revisitBackgroundDark'
        | 'revisitBackgroundLight'
        | 'revisitImageDark'
        | 'revisitImageLight';
    const [mediaTarget, setMediaTarget] = useState<ObstacleImageField | null>(
        null,
    );
    const update = <Key extends keyof ObstacleForm>(
        key: Key,
        value: ObstacleForm[Key],
    ) => onChange({ ...form, [key]: value });
    const imageFields: Array<[ObstacleImageField, string]> = [
        ['backgroundDark', 'Dark background'],
        ['backgroundLight', 'Light background'],
        ['imageDark', 'Dark obstacle image'],
        ['imageLight', 'Light obstacle image'],
        ['revisitBackgroundDark', 'Dark cleared background'],
        ['revisitBackgroundLight', 'Light cleared background'],
        ['revisitImageDark', 'Dark cleared image'],
        ['revisitImageLight', 'Light cleared image'],
    ];
    return (
        <>
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Tools that work here</h3>
                <select
                    aria-label="Add a tool"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/40"
                    onChange={(event) => {
                        const id = event.target.value;
                        if (id && !form.allowedToolIds.includes(id))
                            update('allowedToolIds', [
                                ...form.allowedToolIds,
                                id,
                            ]);
                    }}
                    value=""
                >
                    <option value="">Add a tool</option>
                    {tools
                        .filter(
                            (tool) => !form.allowedToolIds.includes(tool.id),
                        )
                        .map((tool) => (
                            <option key={tool.id} value={tool.id}>
                                {tool.title}
                            </option>
                        ))}
                </select>
                <div className="flex flex-wrap gap-2">
                    {form.allowedToolIds.map((id) => {
                        const tool = tools.find(
                            (candidate) => candidate.id === id,
                        );
                        return tool ? (
                            <button
                                className="rounded-md bg-teal-100 px-2 py-1 text-sm text-teal-800 dark:bg-teal-300/10 dark:text-teal-200"
                                key={id}
                                onClick={() =>
                                    update(
                                        'allowedToolIds',
                                        form.allowedToolIds.filter(
                                            (value) => value !== id,
                                        ),
                                    )
                                }
                                type="button"
                            >
                                {tool.title} ×
                            </button>
                        ) : null;
                    })}
                </div>
                <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                        checked={form.persistAfterSolved}
                        onChange={(event) =>
                            update('persistAfterSolved', event.target.checked)
                        }
                        type="checkbox"
                    />
                    Stay cleared for learner
                </label>
            </section>
            <ActivityTextField
                className="md:col-span-2"
                label="Prompt bubble"
                onChange={(value) => update('promptText', value)}
                textarea
                value={form.promptText}
            />
            <ActivityTextField
                className="md:col-span-2"
                label="Success bubble"
                onChange={(value) => update('successText', value)}
                textarea
                value={form.successText}
            />
            <ActivityTextField
                className="md:col-span-2"
                label="Cleared revisit bubble"
                onChange={(value) => update('revisitText', value)}
                textarea
                value={form.revisitText}
            />
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Obstacle scenes</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    {imageFields.map(([field, label]) => (
                        <ActivityTextField
                            key={field}
                            label={label}
                            onChange={(value) => update(field, value)}
                            onSelectExisting={() => setMediaTarget(field)}
                            value={String(form[field])}
                        />
                    ))}
                </div>
                {(
                    [
                        [
                            'backgroundMirrored',
                            'Mirror background horizontally',
                        ],
                        ['imageMirrored', 'Mirror obstacle image horizontally'],
                        [
                            'revisitBackgroundMirrored',
                            'Mirror cleared background horizontally',
                        ],
                        [
                            'revisitImageMirrored',
                            'Mirror cleared image horizontally',
                        ],
                    ] as Array<[keyof ObstacleForm, string]>
                ).map(([field, label]) => (
                    <label
                        className="flex items-center gap-3 text-sm font-medium"
                        key={field}
                    >
                        <input
                            checked={Boolean(form[field])}
                            onChange={(event) =>
                                update(field, event.target.checked)
                            }
                            type="checkbox"
                        />
                        {label}
                    </label>
                ))}
            </section>
            <section className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <h3 className="text-sm font-medium">Position and bubble</h3>
                <div className="grid gap-3 md:grid-cols-3">
                    <ToolGrantNumberField
                        label="Obstacle x position"
                        max={100}
                        min={0}
                        onChange={(value) => update('x', value)}
                        suffix="%"
                        value={form.x}
                    />
                    <ToolGrantNumberField
                        label="Obstacle y position"
                        max={100}
                        min={0}
                        onChange={(value) => update('y', value)}
                        suffix="%"
                        value={form.y}
                    />
                    <ToolGrantNumberField
                        label="Obstacle width"
                        max={100}
                        min={1}
                        onChange={(value) => update('width', value)}
                        suffix="%"
                        value={form.width}
                    />
                    <ToolGrantNumberField
                        label="Dark opacity"
                        max={100}
                        min={0}
                        onChange={(value) => update('bubbleOpacityDark', value)}
                        suffix="%"
                        value={form.bubbleOpacityDark}
                    />
                    <ToolGrantNumberField
                        label="Light opacity"
                        max={100}
                        min={0}
                        onChange={(value) =>
                            update('bubbleOpacityLight', value)
                        }
                        suffix="%"
                        value={form.bubbleOpacityLight}
                    />
                    <ToolGrantNumberField
                        label="Typing speed"
                        max={250}
                        min={1}
                        onChange={(value) => update('typingSpeed', value)}
                        suffix="ms"
                        value={form.typingSpeed}
                    />
                    <ToolGrantColorField
                        label="Dark bubble color"
                        onChange={(value) => update('bubbleColorDark', value)}
                        value={form.bubbleColorDark}
                    />
                    <ToolGrantColorField
                        label="Dark bubble border"
                        onChange={(value) =>
                            update('bubbleBorderColorDark', value)
                        }
                        value={form.bubbleBorderColorDark}
                    />
                    <ToolGrantColorField
                        label="Light bubble color"
                        onChange={(value) => update('bubbleColorLight', value)}
                        value={form.bubbleColorLight}
                    />
                    <ToolGrantColorField
                        label="Light bubble border"
                        onChange={(value) =>
                            update('bubbleBorderColorLight', value)
                        }
                        value={form.bubbleBorderColorLight}
                    />
                    <label className="grid gap-2 text-sm font-medium">
                        Success animation
                        <select
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/40"
                            onChange={(event) =>
                                update('successAnimation', event.target.value)
                            }
                            value={form.successAnimation}
                        >
                            <option value="zoom">Zoom</option>
                            <option value="shake">Shake</option>
                            <option value="rotate">Rotate</option>
                            <option value="none">None</option>
                        </select>
                    </label>
                </div>
            </section>
            {mediaTarget ? (
                <MediaPicker
                    onClose={() => setMediaTarget(null)}
                    onSelect={(media) => {
                        update(mediaTarget, media.url);
                        setMediaTarget(null);
                    }}
                />
            ) : null}
        </>
    );
}

function ToolGrantFields({
    form,
    onChange,
    tools,
}: {
    form: ActivityAuthorForm;
    onChange: React.Dispatch<React.SetStateAction<ActivityAuthorForm>>;
    tools: EditableTool[];
}) {
    const [mediaTarget, setMediaTarget] = useState<
        'backgroundDark' | 'backgroundLight' | null
    >(null);
    const update = (field: keyof ActivityAuthorForm, value: string | boolean) =>
        onChange((current) => ({ ...current, [field]: value }));

    return (
        <>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">
                Tool to give
                <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                    onChange={(event) => update('toolId', event.target.value)}
                    value={form.toolId}
                >
                    <option value="">Select a tool</option>
                    {tools.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                            {tool.title}
                        </option>
                    ))}
                </select>
            </label>
            <ActivityTextField
                className="md:col-span-2"
                label="Speech bubble text"
                onChange={(value) => update('text', value)}
                textarea
                value={form.text}
            />
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div>
                    <h3 className="text-sm font-medium">Grant scene</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Position the tool and configure its scene presentation.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <ActivityTextField
                        label="Dark background"
                        onChange={(value) => update('backgroundDark', value)}
                        onSelectExisting={() => setMediaTarget('backgroundDark')}
                        value={form.backgroundDark}
                    />
                    <ActivityTextField
                        label="Light background"
                        onChange={(value) => update('backgroundLight', value)}
                        onSelectExisting={() => setMediaTarget('backgroundLight')}
                        value={form.backgroundLight}
                    />
                    <ToolGrantNumberField
                        label="Tool x position"
                        max={100}
                        min={0}
                        onChange={(value) => update('toolX', value)}
                        suffix="%"
                        value={form.toolX}
                    />
                    <ToolGrantNumberField
                        label="Tool y position"
                        max={100}
                        min={0}
                        onChange={(value) => update('toolY', value)}
                        suffix="%"
                        value={form.toolY}
                    />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input
                            checked={form.backgroundMirrored}
                            onChange={(event) =>
                                update(
                                    'backgroundMirrored',
                                    event.target.checked,
                                )
                            }
                            type="checkbox"
                        />
                        Mirror background horizontally
                    </label>
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <input
                            checked={form.toolMirrored}
                            onChange={(event) =>
                                update('toolMirrored', event.target.checked)
                            }
                            type="checkbox"
                        />
                        Mirror tool image horizontally
                    </label>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-2 text-sm font-medium">
                        Slide direction
                        <select
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                            onChange={(event) =>
                                update('slideDirection', event.target.value)
                            }
                            value={form.slideDirection}
                        >
                            <option value="left">From left</option>
                            <option value="right">From right</option>
                            <option value="top">From top</option>
                            <option value="bottom">From bottom</option>
                            <option value="none">No slide</option>
                        </select>
                    </label>
                    <ToolGrantNumberField
                        label="Slide duration"
                        max={30}
                        min={0}
                        onChange={(value) =>
                            update('slideDurationSeconds', value)
                        }
                        suffix="s"
                        value={form.slideDurationSeconds}
                    />
                    <ToolGrantNumberField
                        label="Fade duration"
                        max={30}
                        min={0}
                        onChange={(value) =>
                            update('fadeDurationSeconds', value)
                        }
                        suffix="s"
                        value={form.fadeDurationSeconds}
                    />
                    <ToolGrantNumberField
                        label="Typing speed"
                        max={250}
                        min={1}
                        onChange={(value) => update('typingSpeed', value)}
                        suffix="ms"
                        value={form.typingSpeed}
                    />
                </div>
            </section>
            <section className="grid gap-4 border-t border-slate-200 pt-4 md:col-span-2 dark:border-white/10">
                <div>
                    <h3 className="text-sm font-medium">Speech bubble</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Keep dark and light appearance values distinct.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <ToolGrantColorField
                        label="Dark bubble color"
                        onChange={(value) => update('bubbleColorDark', value)}
                        value={form.bubbleColorDark}
                    />
                    <ToolGrantColorField
                        label="Dark bubble border"
                        onChange={(value) =>
                            update('bubbleBorderColorDark', value)
                        }
                        value={form.bubbleBorderColorDark}
                    />
                    <ToolGrantNumberField
                        label="Dark opacity"
                        max={100}
                        min={0}
                        onChange={(value) => update('bubbleOpacityDark', value)}
                        suffix="%"
                        value={form.bubbleOpacityDark}
                    />
                    <ToolGrantColorField
                        label="Light bubble color"
                        onChange={(value) => update('bubbleColorLight', value)}
                        value={form.bubbleColorLight}
                    />
                    <ToolGrantColorField
                        label="Light bubble border"
                        onChange={(value) =>
                            update('bubbleBorderColorLight', value)
                        }
                        value={form.bubbleBorderColorLight}
                    />
                    <ToolGrantNumberField
                        label="Light opacity"
                        max={100}
                        min={0}
                        onChange={(value) =>
                            update('bubbleOpacityLight', value)
                        }
                        suffix="%"
                        value={form.bubbleOpacityLight}
                    />
                </div>
            </section>
            {mediaTarget ? (
                <MediaPicker
                    onClose={() => setMediaTarget(null)}
                    onSelect={(media) => {
                        update(mediaTarget, media.url);
                        setMediaTarget(null);
                    }}
                />
            ) : null}
        </>
    );
}

function ToolGrantNumberField({
    label,
    max,
    min,
    onChange,
    suffix,
    value,
}: {
    label: string;
    max: number;
    min: number;
    onChange: (value: string) => void;
    suffix: string;
    value: string;
}) {
    return (
        <label className="grid gap-2 text-sm font-medium">
            {label}
            <span className="flex items-center gap-2">
                <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                    max={max}
                    min={min}
                    onChange={(event) => onChange(event.target.value)}
                    step="any"
                    type="number"
                    value={value}
                />
                <span className="text-slate-500">{suffix}</span>
            </span>
        </label>
    );
}

function ToolGrantColorField({
    label,
    onChange,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <label className="grid gap-2 text-sm font-medium">
            {label}
            <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-slate-950/40"
                onChange={(event) => onChange(event.target.value)}
                type="color"
                value={value}
            />
        </label>
    );
}

type ActivityFormSource = Pick<
    Activity,
    'config' | 'introduction' | 'slug' | 'title'
>;

type ActivityCopyTemplate = {
    snapshot: { [key: string]: unknown };
    title: string;
    portalTargetId?: string;
};

function activityCopyTemplate(activity: Activity): ActivityCopyTemplate {
    return {
        snapshot: {
            config: activity.config,
            introduction: activity.introduction,
            slug: activity.slug,
            title: activity.title,
        },
        title: activity.title,
        portalTargetId: activity.portal_link?.target_activity?.id,
    };
}

function activityAuthorFormFromTemplate(
    type: SupportedActivityType,
    template: ActivityCopyTemplate,
    items: EditableItem[],
    tools: EditableTool[],
    sounds: EditableSound[],
): ActivityAuthorForm {
    const snapshot = template.snapshot;
    const config =
        snapshot.config &&
        typeof snapshot.config === 'object' &&
        !Array.isArray(snapshot.config)
            ? (snapshot.config as Record<string, unknown>)
            : {};
    const title =
        typeof snapshot.title === 'string' && snapshot.title.trim()
            ? snapshot.title
            : template.title;
    return {
        ...activityAuthorForm(
            type,
            {
                config,
                introduction:
                    typeof snapshot.introduction === 'string'
                        ? snapshot.introduction
                        : null,
                slug: '',
                title,
            },
            items,
            tools,
            sounds,
        ),
        portalTargetId: template.portalTargetId ?? '',
        slug: '',
        title: `${title} (copy)`,
    };
}

function activityAuthorForm(
    type: SupportedActivityType,
    activity?: ActivityFormSource,
    items: EditableItem[] = [],
    tools: EditableTool[] = [],
    sounds: EditableSound[] = [],
): ActivityAuthorForm {
    const config = activity?.config ?? {};
    const messageUi = config.messageUi && typeof config.messageUi === 'object' && !Array.isArray(config.messageUi)
        ? config.messageUi as Record<string, unknown>
        : {};
    return {
        backgroundDark: configString(config, 'backgroundDark'),
        backgroundLight: configString(config, 'backgroundLight'),
        backgroundMirrored: configBoolean(config, 'backgroundMirrored'),
        bubbleBorderColorDark: configStringOr(
            config,
            'bubbleBorderColorDark',
            '#2dd4bf',
        ),
        bubbleBorderColorLight: configStringOr(
            config,
            'bubbleBorderColorLight',
            '#0891b2',
        ),
        bubbleColorDark: configStringOr(config, 'bubbleColorDark', '#0f172a'),
        bubbleColorLight: configStringOr(config, 'bubbleColorLight', '#ffffff'),
        bubbleOpacityDark: String(
            configNumber(config, 'bubbleOpacityDark', 92),
        ),
        bubbleOpacityLight: String(
            configNumber(config, 'bubbleOpacityLight', 94),
        ),
        fadeDurationSeconds: String(
            configNumber(config, 'fadeDurationSeconds', 0.4),
        ),
        introduction: activity?.introduction ?? '',
        itemObstacleBackgroundDark: configString(config, 'backgroundDark'),
        itemObstacleBackgroundLight: configString(config, 'backgroundLight'),
        itemObstacleBackgroundMirrored: configBoolean(
            config,
            'backgroundMirrored',
        ),
        itemObstacleConsumeOnEachEntry: configBoolean(
            config,
            'consumeOnEachEntry',
        ),
        itemObstacleLockMinutes: String(configNumber(config, 'lockMinutes', 0)),
        itemObstacleMetBackgroundDark: configString(
            config,
            'metBackgroundDark',
        ),
        itemObstacleMetBackgroundLight: configString(
            config,
            'metBackgroundLight',
        ),
        itemObstacleMetBackgroundMirrored: configBoolean(
            config,
            'metBackgroundMirrored',
        ),
        itemObstacleOverlayDark: configString(config, 'overlayDark'),
        itemObstacleOverlayLight: configString(config, 'overlayLight'),
        itemObstacleOverlayMirrored: configBoolean(config, 'overlayMirrored'),
        itemObstacleOverlayWidth: String(
            configNumber(config, 'overlayWidth', 30),
        ),
        itemObstacleOverlayX: String(configNumber(config, 'overlayX', 50)),
        itemObstacleOverlayY: String(configNumber(config, 'overlayY', 50)),
        itemObstacleSlots: itemObstacleSlots(config, items),
        itemObstacleSoundMetEnabled: itemObstacleSoundEnabled(config, 'met'),
        itemObstacleSoundMetId: itemObstacleSoundId(config, 'met', sounds),
        itemObstacleSoundNotMetEnabled: itemObstacleSoundEnabled(
            config,
            'notMet',
        ),
        itemObstacleSoundNotMetId: itemObstacleSoundId(
            config,
            'notMet',
            sounds,
        ),
        itemObstacleSoundTransitionEnabled: itemObstacleSoundEnabled(
            config,
            'transition',
        ),
        itemObstacleSoundTransitionId: itemObstacleSoundId(
            config,
            'transition',
            sounds,
        ),
        items: itemGrantItems(config, items),
        markdownGraphLayout: markdownGraphLayout(config),
        markdownPages: markdownPages(config),
        markdownTransitions: markdownTransitions(config),
        portalAssets: portalAssets(config),
        portalBackgroundDark: configString(config, 'portalBackgroundDark'),
        portalBackgroundLight: configString(config, 'portalBackgroundLight'),
        portalBackgroundMirrored: configBoolean(config, 'portalBackgroundMirrored'),
        portalBubbleBorderColorDark: configStringOr(config, 'portalBubbleBorderColorDark', '#2dd4bf'),
        portalBubbleBorderColorLight: configStringOr(config, 'portalBubbleBorderColorLight', '#0891b2'),
        portalBubbleColorDark: configStringOr(config, 'portalBubbleColorDark', '#0f172a'),
        portalBubbleColorLight: configStringOr(config, 'portalBubbleColorLight', '#ffffff'),
        portalBubbleText: configString(config, 'portalBubbleText'),
        portalBubbleTextColorDark: configStringOr(config, 'portalBubbleTextColorDark', '#f8fafc'),
        portalBubbleTextColorLight: configStringOr(config, 'portalBubbleTextColorLight', '#0f172a'),
        portalBubbleTypingSpeed: String(configNumber(config, 'portalBubbleTypingSpeed', 24)),
        portalDurationSeconds: String(configNumber(config, 'portalDurationSeconds', 1.5)),
        portalForegroundDark: configString(config, 'portalForegroundDark'),
        portalForegroundLight: configString(config, 'portalForegroundLight'),
        portalForegroundMirrored: configBoolean(config, 'portalForegroundMirrored'),
        portalForegroundWidth: String(configNumber(config, 'portalForegroundWidth', 28)),
        portalForegroundX: String(configNumber(config, 'portalForegroundX', 50)),
        portalForegroundY: String(configNumber(config, 'portalForegroundY', 50)),
        portalMode: configString(config, 'portalMode') === 'input' ? 'input' : 'output',
        portalShowOnArrival: configBoolean(config, 'portalShowOnArrival', true),
        portalSwirlEnabled: configBoolean(config, 'portalSwirlEnabled', true),
        portalTargetId: '',
        portalWaitForEnter: configBoolean(config, 'portalWaitForEnter'),
        nextStep:
            configString(config, 'nextStep') ||
            'Choose a useful next step, then continue when you are ready.',
        note: configString(config, 'note'),
        obstacle: obstacleForm(config, tools),
        prompt: activity
            ? configString(config, type === 'message_prompt' || type === 'message_wall' ? 'messagePrompt' : 'prompt')
            : type === 'message_prompt' || type === 'message_wall'
              ? 'Leave a helpful note or an encouraging thought for the next learner.'
              : 'What feels clearer now?',
        questionAllowMultiple: configBoolean(config, 'allowMultiple'),
        questionExplanation: configString(config, 'explanation'),
        questionFeedbackCorrect: configString(config, 'feedbackCorrect'),
        questionFeedbackIncorrect: configString(config, 'feedbackIncorrect'),
        questionOptions: questionOptions(config),
        questionPrompt: configString(config, 'prompt'),
        messageActivityType: type === 'message_wall' ? 'message_wall' : 'message_prompt',
        messageAllowResponses: configBoolean(config, 'messageAllowResponses'),
        messageAudience: configString(config, 'messageAudience') === 'support' ? 'support' : 'peers',
        messageAccentColorDark: configStringOr(messageUi, 'accentColorDark', '#5eead4'),
        messageAccentColorLight: configStringOr(messageUi, 'accentColorLight', '#0f766e'),
        messageCardBorderColorDark: configStringOr(messageUi, 'cardBorderColorDark', '#2dd4bf'),
        messageCardBorderColorLight: configStringOr(messageUi, 'cardBorderColorLight', '#0f766e'),
        messageCardColorDark: configStringOr(messageUi, 'cardColorDark', '#13262d'),
        messageCardColorLight: configStringOr(messageUi, 'cardColorLight', '#ffffff'),
        messageInputLabel: configStringOr(config, 'messageInputLabel', 'Your message'),
        messageResponsePrompt: configString(config, 'messageResponsePrompt'),
        messageSurfaceColorDark: configStringOr(messageUi, 'surfaceColorDark', '#071018'),
        messageSurfaceColorLight: configStringOr(messageUi, 'surfaceColorLight', '#e6f5f2'),
        messageTextColorDark: configStringOr(messageUi, 'textColorDark', '#f1f5f9'),
        messageTextColorLight: configStringOr(messageUi, 'textColorLight', '#0f172a'),
        messageTopicId: configString(config, 'messageTopicId'),
        messageTopicTitle: '',
        sharedTaskCycleMode: configStringOr(config, 'cycleMode', 'none'),
        sharedTaskInputLabel: configStringOr(config, 'inputLabel', 'Your contribution'),
        sharedTaskInstructions: configString(config, 'instructions'),
        sharedTaskKind: configStringOr(config, 'taskKind', 'text'),
        sharedTaskMinimumLength: String(configNumber(config, 'minimumLength', 20)),
        sharedTaskPeerReviewEnabled: configBoolean(config, 'peerReviewEnabled'),
        sharedTaskPeerReviewPrompt: configStringOr(config, 'peerReviewPrompt', 'What does this contribution help you notice, question, or extend?'),
        sharedTaskProjectDeliverable: configString(config, 'projectDeliverable'),
        sharedTaskProjectGoal: configString(config, 'projectGoal'),
        sharedTaskProjectSteps: Array.isArray(config.projectSteps) ? config.projectSteps.filter((step): step is string => typeof step === 'string').join('\n') : '',
        sharedTaskRepeatPolicy: configStringOr(config, 'repeatPolicy', 'once_per_user'),
        sharedTaskShowContributions: configBoolean(config, 'showContributions'),
        sharedTaskThreshold: String(configNumber(config, 'threshold', 3)),
        sharedTaskValidationMode: configStringOr(config, 'validationMode', 'minimum_length'),
        slug: activity?.slug ?? '',
        subtopic: configString(config, 'subtopic'),
        title: activity?.title ?? '',
        topic: configString(config, 'topic'),
        type,
        probabilityPercent: String(
            configNumber(config, 'probabilityPercent', 100),
        ),
        slideDirection: configStringOr(config, 'slideDirection', 'left'),
        slideDurationSeconds: String(
            configNumber(config, 'slideDurationSeconds', 0.6),
        ),
        text: configString(config, 'text'),
        toolId: toolGrantToolId(config, tools),
        toolMirrored: configBoolean(config, 'toolMirrored'),
        toolX: String(configNumber(config, 'toolX', 50)),
        toolY: String(configNumber(config, 'toolY', 50)),
        typingSpeed: String(configNumber(config, 'typingSpeed', 24)),
    };
}

function obstacleForm(
    config: Record<string, unknown>,
    tools: EditableTool[],
): ObstacleForm {
    const allowed = config.allowedToolIds;
    const allowedToolIds = Array.isArray(allowed)
        ? allowed.flatMap((slug) => {
              const tool =
                  typeof slug === 'string'
                      ? tools.find((candidate) => candidate.slug === slug)
                      : undefined;
              return tool ? [tool.id] : [];
          })
        : [];
    return {
        allowedToolIds,
        backgroundDark: configString(config, 'backgroundDark'),
        backgroundLight: configString(config, 'backgroundLight'),
        backgroundMirrored: configBoolean(config, 'backgroundMirrored'),
        bubbleBorderColorDark: configStringOr(
            config,
            'bubbleBorderColorDark',
            '#2dd4bf',
        ),
        bubbleBorderColorLight: configStringOr(
            config,
            'bubbleBorderColorLight',
            '#0891b2',
        ),
        bubbleColorDark: configStringOr(config, 'bubbleColorDark', '#0f172a'),
        bubbleColorLight: configStringOr(config, 'bubbleColorLight', '#ffffff'),
        bubbleOpacityDark: String(
            configNumber(config, 'bubbleOpacityDark', 92),
        ),
        bubbleOpacityLight: String(
            configNumber(config, 'bubbleOpacityLight', 94),
        ),
        imageDark: configString(config, 'obstacleImageDark'),
        imageLight: configString(config, 'obstacleImageLight'),
        imageMirrored: configBoolean(config, 'obstacleImageMirrored'),
        persistAfterSolved: configBoolean(config, 'persistAfterSolved', true),
        promptText: configString(config, 'promptText'),
        revisitBackgroundDark: configString(config, 'revisitBackgroundDark'),
        revisitBackgroundLight: configString(config, 'revisitBackgroundLight'),
        revisitBackgroundMirrored: configBoolean(
            config,
            'revisitBackgroundMirrored',
        ),
        revisitImageDark: configString(config, 'revisitImageDark'),
        revisitImageLight: configString(config, 'revisitImageLight'),
        revisitImageMirrored: configBoolean(config, 'revisitImageMirrored'),
        revisitText: configString(config, 'revisitText'),
        successAnimation: configStringOr(config, 'successAnimation', 'zoom'),
        successText: configString(config, 'successText'),
        typingSpeed: String(configNumber(config, 'typingSpeed', 24)),
        width: String(configNumber(config, 'obstacleWidth', 28)),
        x: String(configNumber(config, 'obstacleX', 50)),
        y: String(configNumber(config, 'obstacleY', 50)),
    };
}

function configString(config: Record<string, unknown>, key: string): string {
    const value = config[key];
    return typeof value === 'string' ? value : '';
}

function configStringOr(
    config: Record<string, unknown>,
    key: string,
    fallback: string,
): string {
    return configString(config, key) || fallback;
}

function configBoolean(
    config: Record<string, unknown>,
    key: string,
    fallback = false,
): boolean {
    return typeof config[key] === 'boolean' ? config[key] : fallback;
}

function configNumber(
    config: Record<string, unknown>,
    key: string,
    fallback: number,
): number {
    const value = config[key];
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function defaultMarkdownPage(): MarkdownPageDraft {
    return {
        body: '# First page\n\nWrite markdown content here. Use `![Alt text](/path/to/image.svg)` to insert images.',
        id: 'page-1',
        position: { x: 140, y: 80 },
        title: 'First page',
        visual: {
            borderColorDark: '#2dd4bf',
            borderColorLight: '#0891b2',
            headingColorDark: '#67e8f9',
            headingColorLight: '#0e7490',
            pageColorDark: '#0f172a',
            pageColorLight: '#ffffff',
            textColorDark: '#f8fafc',
            textColorLight: '#0f172a',
        },
    };
}

function markdownPages(config: Record<string, unknown>): MarkdownPageDraft[] {
    if (!Array.isArray(config.markdownPages)) {
        return [defaultMarkdownPage()];
    }
    const pages = config.markdownPages.flatMap((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return [];
        }
        const page = value as Record<string, unknown>;
        const position = page.position && typeof page.position === 'object' && !Array.isArray(page.position)
            ? page.position as Record<string, unknown>
            : {};
        const visual = page.visual && typeof page.visual === 'object' && !Array.isArray(page.visual)
            ? page.visual as Record<string, unknown>
            : {};
        const defaults = defaultMarkdownPage();
        return [{
            body: configString(page, 'body'),
            id: configString(page, 'id') || `page-${index + 1}`,
            position: { x: configNumber(position, 'x', 140 + index * 260), y: configNumber(position, 'y', 80) },
            title: configString(page, 'title') || `Page ${index + 1}`,
            visual: {
                borderColorDark: configStringOr(visual, 'borderColorDark', defaults.visual.borderColorDark),
                borderColorLight: configStringOr(visual, 'borderColorLight', defaults.visual.borderColorLight),
                headingColorDark: configStringOr(visual, 'headingColorDark', defaults.visual.headingColorDark),
                headingColorLight: configStringOr(visual, 'headingColorLight', defaults.visual.headingColorLight),
                pageColorDark: configStringOr(visual, 'pageColorDark', defaults.visual.pageColorDark),
                pageColorLight: configStringOr(visual, 'pageColorLight', defaults.visual.pageColorLight),
                textColorDark: configStringOr(visual, 'textColorDark', defaults.visual.textColorDark),
                textColorLight: configStringOr(visual, 'textColorLight', defaults.visual.textColorLight),
            },
        }];
    });
    return pages.length > 0 ? pages.slice(0, 30) : [defaultMarkdownPage()];
}

function markdownTransitions(config: Record<string, unknown>): MarkdownTransitionDraft[] {
    if (!Array.isArray(config.markdownTransitions)) {
        return [
            { from: 'start', id: 'start-page-1', to: 'page-1' },
            { from: 'page-1', id: 'page-1-end', to: 'end' },
        ];
    }
    return config.markdownTransitions.flatMap((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return [];
        }
        const transition = value as Record<string, unknown>;
        const from = configString(transition, 'from');
        const to = configString(transition, 'to');
        return from && to ? [{ from, id: configString(transition, 'id') || `markdown-edge-${index + 1}`, to }] : [];
    }).slice(0, 60);
}

function markdownGraphLayout(config: Record<string, unknown>): ActivityAuthorForm['markdownGraphLayout'] {
    const value = config.markdownGraphLayout;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const layout = value as Record<string, unknown>;
    const position = (key: 'start' | 'end') => {
        const value = layout[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        const item = value as Record<string, unknown>;
        return { x: configNumber(item, 'x', key === 'start' ? -160 : 520), y: configNumber(item, 'y', 80) };
    };
    return { end: position('end'), start: position('start') };
}

function portalAssets(config: Record<string, unknown>): PortalAssetDraft[] {
    if (!Array.isArray(config.portalAssets)) return [];
    return config.portalAssets.flatMap((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
        const asset = value as Record<string, unknown>;
        const layer = configString(asset, 'layer');
        return [{
            id: configString(asset, 'id') || `portal-asset-${index + 1}`,
            imageDark: configString(asset, 'imageDark'),
            imageLight: configString(asset, 'imageLight'),
            label: configString(asset, 'label') || `Asset ${index + 1}`,
            layer: ['behind-background', 'above-background', 'above-foreground', 'front'].includes(layer)
                ? layer as PortalAssetDraft['layer']
                : 'above-background',
            mirrored: configBoolean(asset, 'mirrored'),
            opacity: String(configNumber(asset, 'opacity', 100)),
            width: String(configNumber(asset, 'width', 28)),
            x: String(configNumber(asset, 'x', 50)),
            y: String(configNumber(asset, 'y', 50)),
        }];
    }).slice(0, 20);
}

function questionOptions(config: Record<string, unknown>): ActivityAuthorForm['questionOptions'] {
    if (!Array.isArray(config.options)) {
        return [emptyQuestionOption('A'), emptyQuestionOption('B')];
    }
    const options = config.options.flatMap((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return [];
        }
        const option = value as Record<string, unknown>;
        const weights = option.weights && typeof option.weights === 'object' && !Array.isArray(option.weights)
            ? Object.fromEntries(Object.entries(option.weights).filter(([, weight]) => typeof weight === 'number' && Number.isFinite(weight))) as Record<string, number>
            : {};
        return [{ body: configString(option, 'body'), feedback: configString(option, 'feedback'), isCorrect: configBoolean(option, 'isCorrect'), key: configString(option, 'key'), label: configStringOr(option, 'label', String.fromCharCode(65 + index)), outcomeKey: configString(option, 'outcomeKey'), weights }];
    });
    return options.length >= 2 ? options.slice(0, 12) : [emptyQuestionOption('A'), emptyQuestionOption('B')];
}

function itemGrantItems(
    config: Record<string, unknown>,
    items: EditableItem[],
): Array<{ itemId: string; quantity: string }> {
    const configured = config.items;
    if (!Array.isArray(configured)) {
        return [];
    }
    return configured.flatMap((row) => {
        if (!row || typeof row !== 'object') {
            return [];
        }
        const itemSlug = 'itemId' in row ? row.itemId : null;
        const quantity = 'quantity' in row ? row.quantity : null;
        if (typeof itemSlug !== 'string' || typeof quantity !== 'number') {
            return [];
        }
        const item = items.find((candidate) => candidate.slug === itemSlug);
        return [
            {
                itemId: item?.id ?? itemSlug,
                quantity: String(quantity),
            },
        ];
    });
}

function itemGrantRequest(form: ActivityAuthorForm): {
    items: Array<{ item_id: string; quantity: number }>;
    probabilityPercent: number;
} | null {
    const probabilityPercent = Number(form.probabilityPercent);
    if (
        !Number.isFinite(probabilityPercent) ||
        probabilityPercent < 0.01 ||
        probabilityPercent > 100
    ) {
        return null;
    }
    const items = form.items.map((item) => ({
        item_id: item.itemId,
        quantity: Number(item.quantity),
    }));
    if (
        items.some(
            (item) =>
                !item.item_id ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 999,
        )
    ) {
        return null;
    }
    return { items, probabilityPercent };
}

function itemObstacleRequest(form: ActivityAuthorForm): {
    background_dark: string | null;
    background_light: string | null;
    background_mirrored: boolean;
    consume_on_each_entry: boolean;
    lock_minutes: number;
    met_background_dark: string | null;
    met_background_light: string | null;
    met_background_mirrored: boolean;
    overlay_dark: string | null;
    overlay_light: string | null;
    overlay_mirrored: boolean;
    overlay_width: number;
    overlay_x: number;
    overlay_y: number;
    slots: Array<{ item_id: string; width: number; x: number; y: number }>;
    sound_met_enabled: boolean;
    sound_met_id: string | null;
    sound_not_met_enabled: boolean;
    sound_not_met_id: string | null;
    sound_transition_enabled: boolean;
    sound_transition_id: string | null;
} | null {
    const lockMinutes = Number(form.itemObstacleLockMinutes);
    const overlayWidth = Number(form.itemObstacleOverlayWidth);
    const overlayX = Number(form.itemObstacleOverlayX);
    const overlayY = Number(form.itemObstacleOverlayY);
    const slots = form.itemObstacleSlots
        .filter((slot) => slot.itemId !== '')
        .map((slot) => ({
            item_id: slot.itemId,
            width: Number(slot.width),
            x: Number(slot.x),
            y: Number(slot.y),
        }));
    const soundIds = [
        [form.itemObstacleSoundNotMetEnabled, form.itemObstacleSoundNotMetId],
        [form.itemObstacleSoundMetEnabled, form.itemObstacleSoundMetId],
        [
            form.itemObstacleSoundTransitionEnabled,
            form.itemObstacleSoundTransitionId,
        ],
    ];
    if (
        !Number.isInteger(lockMinutes) ||
        lockMinutes < 0 ||
        lockMinutes > 10_080 ||
        !within(overlayX, 0, 100) ||
        !within(overlayY, 0, 100) ||
        !within(overlayWidth, 1, 100) ||
        slots.length > 10 ||
        slots.some(
            (slot) =>
                !within(slot.x, 0, 100) ||
                !within(slot.y, 0, 100) ||
                !within(slot.width, 1, 100),
        ) ||
        soundIds.some(([enabled, id]) => enabled && !id)
    ) {
        return null;
    }
    return {
        background_dark: optionalValue(form.itemObstacleBackgroundDark),
        background_light: optionalValue(form.itemObstacleBackgroundLight),
        background_mirrored: form.itemObstacleBackgroundMirrored,
        consume_on_each_entry: form.itemObstacleConsumeOnEachEntry,
        lock_minutes: lockMinutes,
        met_background_dark: optionalValue(form.itemObstacleMetBackgroundDark),
        met_background_light: optionalValue(
            form.itemObstacleMetBackgroundLight,
        ),
        met_background_mirrored: form.itemObstacleMetBackgroundMirrored,
        overlay_dark: optionalValue(form.itemObstacleOverlayDark),
        overlay_light: optionalValue(form.itemObstacleOverlayLight),
        overlay_mirrored: form.itemObstacleOverlayMirrored,
        overlay_width: overlayWidth,
        overlay_x: overlayX,
        overlay_y: overlayY,
        slots,
        sound_met_enabled: form.itemObstacleSoundMetEnabled,
        sound_met_id: form.itemObstacleSoundMetEnabled
            ? optionalValue(form.itemObstacleSoundMetId)
            : null,
        sound_not_met_enabled: form.itemObstacleSoundNotMetEnabled,
        sound_not_met_id: form.itemObstacleSoundNotMetEnabled
            ? optionalValue(form.itemObstacleSoundNotMetId)
            : null,
        sound_transition_enabled: form.itemObstacleSoundTransitionEnabled,
        sound_transition_id: form.itemObstacleSoundTransitionEnabled
            ? optionalValue(form.itemObstacleSoundTransitionId)
            : null,
    };
}

function obstacleRequest(form: ObstacleForm): {
    allowed_tool_ids: string[];
    background_dark: string | null;
    background_light: string | null;
    background_mirrored: boolean;
    bubble_border_color_dark: string;
    bubble_border_color_light: string;
    bubble_color_dark: string;
    bubble_color_light: string;
    bubble_opacity_dark: number;
    bubble_opacity_light: number;
    obstacle_image_dark: string | null;
    obstacle_image_light: string | null;
    obstacle_image_mirrored: boolean;
    persist_after_solved: boolean;
    prompt_text: string | null;
    obstacle_x: number;
    obstacle_y: number;
    obstacle_width: number;
    revisit_background_dark: string | null;
    revisit_background_light: string | null;
    revisit_background_mirrored: boolean;
    revisit_image_dark: string | null;
    revisit_image_light: string | null;
    revisit_image_mirrored: boolean;
    revisit_text: string | null;
    success_animation: 'none' | 'zoom' | 'shake' | 'rotate';
    success_text: string | null;
    typing_speed: number;
} | null {
    const values = [
        Number(form.bubbleOpacityDark),
        Number(form.bubbleOpacityLight),
        Number(form.x),
        Number(form.y),
        Number(form.width),
        Number(form.typingSpeed),
    ];
    if (
        !validHexColor(form.bubbleBorderColorDark) ||
        !validHexColor(form.bubbleBorderColorLight) ||
        !validHexColor(form.bubbleColorDark) ||
        !validHexColor(form.bubbleColorLight) ||
        !within(values[0], 0, 100) ||
        !within(values[1], 0, 100) ||
        !within(values[2], 0, 100) ||
        !within(values[3], 0, 100) ||
        !within(values[4], 1, 100) ||
        !within(values[5], 1, 250) ||
        form.allowedToolIds.length > 100 ||
        !['none', 'zoom', 'shake', 'rotate'].includes(form.successAnimation)
    )
        return null;
    return {
        allowed_tool_ids: form.allowedToolIds,
        background_dark: optionalValue(form.backgroundDark),
        background_light: optionalValue(form.backgroundLight),
        background_mirrored: form.backgroundMirrored,
        bubble_border_color_dark: form.bubbleBorderColorDark,
        bubble_border_color_light: form.bubbleBorderColorLight,
        bubble_color_dark: form.bubbleColorDark,
        bubble_color_light: form.bubbleColorLight,
        bubble_opacity_dark: values[0],
        bubble_opacity_light: values[1],
        obstacle_image_dark: optionalValue(form.imageDark),
        obstacle_image_light: optionalValue(form.imageLight),
        obstacle_image_mirrored: form.imageMirrored,
        persist_after_solved: form.persistAfterSolved,
        prompt_text: optionalValue(form.promptText),
        obstacle_x: values[2],
        obstacle_y: values[3],
        obstacle_width: values[4],
        revisit_background_dark: optionalValue(form.revisitBackgroundDark),
        revisit_background_light: optionalValue(form.revisitBackgroundLight),
        revisit_background_mirrored: form.revisitBackgroundMirrored,
        revisit_image_dark: optionalValue(form.revisitImageDark),
        revisit_image_light: optionalValue(form.revisitImageLight),
        revisit_image_mirrored: form.revisitImageMirrored,
        revisit_text: optionalValue(form.revisitText),
        success_animation: form.successAnimation as
            | 'none'
            | 'zoom'
            | 'shake'
            | 'rotate',
        success_text: optionalValue(form.successText),
        typing_speed: values[5],
    };
}

function defaultObstacleRequest(): NonNullable<
    ReturnType<typeof obstacleRequest>
> {
    return obstacleRequest({
        allowedToolIds: [],
        backgroundDark: '',
        backgroundLight: '',
        backgroundMirrored: false,
        bubbleBorderColorDark: '#2dd4bf',
        bubbleBorderColorLight: '#0891b2',
        bubbleColorDark: '#0f172a',
        bubbleColorLight: '#ffffff',
        bubbleOpacityDark: '92',
        bubbleOpacityLight: '94',
        imageDark: '',
        imageLight: '',
        imageMirrored: false,
        persistAfterSolved: true,
        promptText: '',
        revisitBackgroundDark: '',
        revisitBackgroundLight: '',
        revisitBackgroundMirrored: false,
        revisitImageDark: '',
        revisitImageLight: '',
        revisitImageMirrored: false,
        revisitText: '',
        successAnimation: 'zoom',
        successText: '',
        typingSpeed: '24',
        width: '28',
        x: '50',
        y: '50',
    })!;
}

function defaultItemObstacleRequest(): NonNullable<
    ReturnType<typeof itemObstacleRequest>
> {
    return {
        background_dark: null,
        background_light: null,
        background_mirrored: false,
        consume_on_each_entry: false,
        lock_minutes: 0,
        met_background_dark: null,
        met_background_light: null,
        met_background_mirrored: false,
        overlay_dark: null,
        overlay_light: null,
        overlay_mirrored: false,
        overlay_width: 30,
        overlay_x: 50,
        overlay_y: 50,
        slots: [],
        sound_met_enabled: false,
        sound_met_id: null,
        sound_not_met_enabled: false,
        sound_not_met_id: null,
        sound_transition_enabled: false,
        sound_transition_id: null,
    };
}

function itemObstacleSlots(
    config: Record<string, unknown>,
    items: EditableItem[],
): ActivityAuthorForm['itemObstacleSlots'] {
    const slots = config.slots;
    if (!Array.isArray(slots)) {
        return [{ itemId: '', width: '10', x: '50', y: '50' }];
    }
    const resolved = slots.flatMap((slot) => {
        if (!slot || typeof slot !== 'object') {
            return [];
        }
        const itemSlug = 'itemId' in slot ? slot.itemId : null;
        const item =
            typeof itemSlug === 'string'
                ? items.find((candidate) => candidate.slug === itemSlug)
                : null;
        if (!item) {
            return [];
        }
        return [
            {
                itemId: item.id,
                width: String('width' in slot ? slot.width : 10),
                x: String('x' in slot ? slot.x : 50),
                y: String('y' in slot ? slot.y : 50),
            },
        ];
    });
    return resolved;
}

function itemObstacleSoundEnabled(
    config: Record<string, unknown>,
    key: 'met' | 'notMet' | 'transition',
): boolean {
    const sounds = config.sounds;
    if (!sounds || typeof sounds !== 'object' || !(key in sounds)) {
        return false;
    }
    const sound = (sounds as Record<string, unknown>)[key];
    return Boolean(
        sound &&
        typeof sound === 'object' &&
        'enabled' in sound &&
        sound.enabled,
    );
}

function itemObstacleSoundId(
    config: Record<string, unknown>,
    key: 'met' | 'notMet' | 'transition',
    sounds: EditableSound[],
): string {
    const configuredSounds = config.sounds;
    if (
        !configuredSounds ||
        typeof configuredSounds !== 'object' ||
        !(key in configuredSounds)
    ) {
        return '';
    }
    const sound = (configuredSounds as Record<string, unknown>)[key];
    if (
        !sound ||
        typeof sound !== 'object' ||
        !('soundId' in sound) ||
        typeof sound.soundId !== 'string'
    ) {
        return '';
    }
    return sounds.some((candidate) => candidate.id === sound.soundId)
        ? sound.soundId
        : '';
}

function toolGrantToolId(
    config: Record<string, unknown>,
    tools: EditableTool[],
): string {
    const slug = configString(config, 'toolId');
    return tools.find((tool) => tool.slug === slug)?.id ?? slug;
}

function toolGrantRequest(form: ActivityAuthorForm): {
    background_dark: string | null;
    background_light: string | null;
    background_mirrored: boolean;
    bubble_border_color_dark: string;
    bubble_border_color_light: string;
    bubble_color_dark: string;
    bubble_color_light: string;
    bubble_opacity_dark: number;
    bubble_opacity_light: number;
    fade_duration_seconds: number;
    slide_direction: 'left' | 'right' | 'top' | 'bottom' | 'none';
    slide_duration_seconds: number;
    text: string | null;
    tool_id: string | null;
    tool_mirrored: boolean;
    tool_x: number;
    tool_y: number;
    typing_speed: number;
} | null {
    const bubbleOpacityDark = Number(form.bubbleOpacityDark);
    const bubbleOpacityLight = Number(form.bubbleOpacityLight);
    const fadeDurationSeconds = Number(form.fadeDurationSeconds);
    const slideDurationSeconds = Number(form.slideDurationSeconds);
    const toolX = Number(form.toolX);
    const toolY = Number(form.toolY);
    const typingSpeed = Number(form.typingSpeed);
    const slideDirection = form.slideDirection;
    if (
        !validHexColor(form.bubbleBorderColorDark) ||
        !validHexColor(form.bubbleBorderColorLight) ||
        !validHexColor(form.bubbleColorDark) ||
        !validHexColor(form.bubbleColorLight) ||
        !within(bubbleOpacityDark, 0, 100) ||
        !within(bubbleOpacityLight, 0, 100) ||
        !within(fadeDurationSeconds, 0, 30) ||
        !within(slideDurationSeconds, 0, 30) ||
        !within(toolX, 0, 100) ||
        !within(toolY, 0, 100) ||
        !within(typingSpeed, 1, 250) ||
        !['left', 'right', 'top', 'bottom', 'none'].includes(slideDirection)
    ) {
        return null;
    }
    return {
        background_dark: optionalValue(form.backgroundDark),
        background_light: optionalValue(form.backgroundLight),
        background_mirrored: form.backgroundMirrored,
        bubble_border_color_dark: form.bubbleBorderColorDark,
        bubble_border_color_light: form.bubbleBorderColorLight,
        bubble_color_dark: form.bubbleColorDark,
        bubble_color_light: form.bubbleColorLight,
        bubble_opacity_dark: bubbleOpacityDark,
        bubble_opacity_light: bubbleOpacityLight,
        fade_duration_seconds: fadeDurationSeconds,
        slide_direction: slideDirection as
            | 'left'
            | 'right'
            | 'top'
            | 'bottom'
            | 'none',
        slide_duration_seconds: slideDurationSeconds,
        text: optionalValue(form.text),
        tool_id: optionalValue(form.toolId),
        tool_mirrored: form.toolMirrored,
        tool_x: toolX,
        tool_y: toolY,
        typing_speed: typingSpeed,
    };
}

function defaultToolGrantRequest(): NonNullable<
    ReturnType<typeof toolGrantRequest>
> {
    return {
        background_dark: null,
        background_light: null,
        background_mirrored: false,
        bubble_border_color_dark: '#2dd4bf',
        bubble_border_color_light: '#0891b2',
        bubble_color_dark: '#0f172a',
        bubble_color_light: '#ffffff',
        bubble_opacity_dark: 92,
        bubble_opacity_light: 94,
        fade_duration_seconds: 0.4,
        slide_direction: 'left',
        slide_duration_seconds: 0.6,
        text: null,
        tool_id: null,
        tool_mirrored: false,
        tool_x: 50,
        tool_y: 50,
        typing_speed: 24,
    };
}

function validHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function within(value: number, minimum: number, maximum: number): boolean {
    return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function optionalValue(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function isSupportedActivityType(type: string): type is SupportedActivityType {
    return (
        type === 'open_practice' ||
        type === 'reflection' ||
        type === 'review' ||
        type === 'markdown' ||
        type === 'portal' ||
        type === 'item_grant' ||
        type === 'tool_grant' ||
        type === 'item_obstacle' ||
        type === 'obstacle' ||
        type === 'question' ||
        type === 'shared_task' || type === 'message_prompt' || type === 'message_wall'
    );
}

function SpecialGraphNode({
    data,
}: {
    data: { kind: 'start' | 'end'; label: string };
}) {
    return (
        <div className="rounded-full border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 shadow dark:border-teal-300 dark:bg-teal-300/10 dark:text-teal-100">
            {data.kind === 'end' ? (
                <Handle id="end" position={Position.Left} type="target" />
            ) : null}
            {data.label}
            {data.kind === 'start' ? (
                <Handle id="start" position={Position.Right} type="source" />
            ) : null}
        </div>
    );
}

function PortalDetails({
    portal,
    onSelectNode,
}: {
    portal: PortalLink;
    onSelectNode: (mapId: string, nodeId: string) => void;
}) {
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                Portal link
            </p>
            <h2 className="mt-2 text-xl font-semibold">
                {portal.label ?? 'Unnamed portal'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {portal.description ?? 'No portal description yet.'}
            </p>
            <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <PortalEndpoint
                    activity={portal.source_activity}
                    direction="From"
                    title={portal.source_node.title}
                />
                <Route className="mx-auto size-4 text-slate-400" />
                <PortalEndpoint
                    activity={portal.target_activity}
                    direction="To"
                    title={portal.target_node.title}
                />
            </div>
            <button
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
                onClick={() =>
                    onSelectNode(portal.source_map_id, portal.source_node.id)
                }
                type="button"
            >
                Open source activity graph <GitBranch className="size-4" />
            </button>
        </div>
    );
}

function PortalEndpoint({
    activity,
    direction,
    title,
}: {
    activity: PortalLink['source_activity'];
    direction: string;
    title: string;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase dark:text-slate-400">
                {direction}
            </p>
            <p className="mt-1 text-sm font-semibold">{title}</p>
            {activity ? (
                <p className="mt-1 text-xs text-teal-700 dark:text-teal-300">
                    {activity.title}
                </p>
            ) : null}
        </div>
    );
}
function EmptyDetails() {
    return (
        <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <GitBranch className="mb-4 size-10 text-teal-700 dark:text-teal-300" />
            <h2 className="text-lg font-semibold">Select a map or portal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click a world-map card to inspect its MapAssets, or a portal
                link to see the connected activity graph.
            </p>
        </div>
    );
}
function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                {label}
            </dt>
            <dd className="mt-1">{value}</dd>
        </div>
    );
}
function circlePosition(index: number, total: number) {
    const radius = Math.max(220, total * 86);
    const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
function graphPosition(
    layout: Record<string, unknown>,
    key: 'start' | 'end',
    fallbackX: number,
    fallbackY: number,
) {
    const value = layout[key];
    if (
        value &&
        typeof value === 'object' &&
        'x' in value &&
        'y' in value &&
        typeof value.x === 'number' &&
        typeof value.y === 'number'
    ) {
        return { x: value.x, y: value.y };
    }
    return { x: fallbackX, y: fallbackY };
}
