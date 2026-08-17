import { Head, router, usePage } from '@inertiajs/react';
import {
    CalendarClock,
    Copy,
    KeyRound,
    Plus,
    Shield,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsNestedWorkspace } from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { PlatformInfoPageKey } from '@/features/platform-info/content';
import { AdminPresentationPanel } from '@/features/platform-presentation/admin-presentation-panel';
import { AccessGroupManagementPanel } from '@/features/settings/access-group-management-panel';
import type {
    AccessGroupUser,
    AccessLearningGroup,
} from '@/features/settings/access-group-management-panel';
import {
    AccessManagementNavigation,
    accessManagementSections,
} from '@/features/settings/access-management-navigation';
import type { AccessManagementSection } from '@/features/settings/access-management-navigation';
import { AssetsWorldObjectsPanel } from '@/features/settings/assets-world-objects-panel';
import type {
    AssetsWorldObjectsSection,
    AssetsWorldObjectsSettings,
} from '@/features/settings/assets-world-objects-panel';
import { ContentApiPanel } from '@/features/settings/content-api-panel';
import { LearningSupportPanel } from '@/features/settings/learning-support-panel';
import type {
    LearningSupportSection,
    LearningSupportSettings,
} from '@/features/settings/learning-support-panel';
import {
    readAccessSectionFromUrl,
    writeAccessSectionToUrl,
} from '@/features/settings/settings-access-navigation-state';
import type {
    AccessFormState,
    AccessRoleSummary,
    AdminUser,
    PermissionLevel,
    PermissionResource,
    PermissionScope,
    RegistrationTokenSummary,
    RoleFormState,
    UserReference,
    UserRole,
} from '@/features/settings/settings-access-types';
import { SettingsCornerNavigation } from '@/features/settings/settings-corner-navigation';
import {
    canOpenPanel,
    findSettingsItemForPanel,
    isSettingsPanelKey,
    panelContent,
    settingsSections,
} from '@/features/settings/settings-navigation';
import type {
    AccessCapability,
    SettingsListItem,
    SettingsPanelKey,
    SettingsTranslator,
} from '@/features/settings/settings-navigation';
import {
    SettingsOverview,
    SettingsPlaceholderPanel,
    SettingsRouteGroupPanel,
} from '@/features/settings/settings-panel-directory';
import {
    SettingsSidebarNavigation,
    SettingsTopBar,
} from '@/features/settings/settings-workspace-shell';
import type {
    SettingsNotificationSummary,
    SettingsWorldBreadcrumb,
} from '@/features/settings/settings-workspace-shell';
import { WorldBuilderSettingsPanel } from '@/features/settings/world-builder-settings-panel';
import type {
    WorldBuilderMapView,
    WorldBuilderSection,
} from '@/features/settings/world-builder-settings-panel';
import { useAppearance } from '@/hooks/use-appearance';
import { isDirtyState, useDirtyState } from '@/hooks/use-dirty-state';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import AiSettings from '@/pages/settings/ai';
import type { AiSection, AiSettingsProps } from '@/pages/settings/ai';
import ColorPaletteSettings from '@/pages/settings/color-palette';
import type { ColorPaletteProps } from '@/pages/settings/color-palette';
import LanguageAdministration from '@/pages/settings/languages';
import type { Language } from '@/pages/settings/languages';
import { PersonalSettingsContent } from '@/pages/settings/personal';
import type {
    PersonalSection,
    PersonalSettingsProps,
} from '@/pages/settings/personal';
import type { WorldGraph } from '@/pages/settings/worlds';
import ConfigureMap from '@/pages/settings/worlds/configure-map';
import EditWorldMap from '@/pages/settings/worlds/edit-map';
import type {
    AccessGroup as WorldMapAccessGroup,
    EditableMapPayload,
} from '@/pages/settings/worlds/edit-map';
import EditNodeActivities from '@/pages/settings/worlds/edit-node-activities';
import type {
    ActivityGraphPayload,
    EditableItem,
    EditableSound,
    EditableTool,
} from '@/pages/settings/worlds/edit-node-activity-types';
import type { PublicPresentationSettings } from '@/theme/presentation';
import { getSettingsPresentationStyle } from '@/theme/presentation';
import type { LearningTool, User as AuthUser } from '@/types';

type SettingsIndexProps = {
    accessCapabilities: Record<string, AccessCapability>;
    accessGroupUsers: AccessGroupUser[];
    accessGroups: AccessLearningGroup[];
    adminRoles: AccessRoleSummary[];
    adminUsers: AdminUser[];
    aiSettings: AiSettingsProps | null;
    assetsWorldObjects: AssetsWorldObjectsSettings;
    assignableRegistrationRoles: UserRole[];
    canAccessAdministration: boolean;
    canManageUsers: boolean;
    colorPaletteSettings: ColorPaletteProps | null;
    createdRegistrationToken?: string | null;
    languages: Language[];
    learningSupportSettings: LearningSupportSettings;
    personalSettings: PersonalSettingsProps;
    platformInfoPages: Partial<
        Record<PlatformInfoPageKey, PlatformInfoContent>
    >;
    permissionResources: PermissionResource[];
    publicPresentation: PublicPresentationSettings;
    registrationTokens: RegistrationTokenSummary[];
    selectedWorldMap: SelectedWorldMap | null;
    selectedWorldNode: SelectedWorldNode | null;
    settingsNotifications: SettingsNotificationSummary;
    worldGraph: WorldGraph | null;
};

type SelectedWorldMap = {
    accessGroups: WorldMapAccessGroup[];
    canDeleteWorldMaps: boolean;
    editableMap: EditableMapPayload;
    learningGroups: LearningGroupOption[];
    tools: LearningTool[];
};

type LearningGroupOption = {
    description: string | null;
    id: number;
    name: string;
    slug: string;
};

type SelectedWorldNode = {
    activityGraph: ActivityGraphPayload;
    items: EditableItem[];
    sounds: EditableSound[];
    tools: EditableTool[];
};

type WorldBuilderView = 'configure' | 'nodes';
type WorldBuilderRootView = WorldBuilderSection;
type AssetView = AssetsWorldObjectsSection;
type LearningSupportView = LearningSupportSection;
type AiView = AiSection;
type PersonalView = PersonalSection;

type PlatformInfoContent = {
    key: PlatformInfoPageKey;
    markdown: string | null;
    updated_at: string | null;
    updated_by: UserReference | null;
};

function readPanelFromUrl(
    canAccessAdministration: boolean,
): SettingsPanelKey | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const url = new URL(window.location.href);
    const rawPanel = url.searchParams.get('panel');
    const panel =
        rawPanel === 'admin-presentation-localization'
            ? panelFromLegacyPresentationParam(url.searchParams)
            : rawPanel;

    if (
        !isSettingsPanelKey(panel) ||
        !canOpenPanel(panel, canAccessAdministration)
    ) {
        return null;
    }

    return panel;
}

function panelFromLegacyPresentationParam(
    searchParams: URLSearchParams,
): SettingsPanelKey {
    const presentation = searchParams.get('presentation');

    if (presentation === 'palette') {
        return 'admin-color-palettes';
    }

    if (presentation === 'languages') {
        return 'admin-translations';
    }

    return 'admin-public-pages';
}

function writePanelToUrl(panel: SettingsPanelKey | null): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (panel) {
        url.searchParams.set('panel', panel);
    } else {
        url.searchParams.delete('panel');
    }

    if (panel !== 'admin-world-builder') {
        url.searchParams.delete('map');
        url.searchParams.delete('node');
        url.searchParams.delete('worldView');
        url.searchParams.delete('worldSection');
        url.searchParams.delete('mapConfig');
        url.searchParams.delete('mapVisual');
    }

    url.searchParams.delete('presentation');

    if (panel !== 'admin-assets-world-objects') {
        url.searchParams.delete('asset');
        url.searchParams.delete('item');
        url.searchParams.delete('sound');
        url.searchParams.delete('tool');
    }

    if (panel !== 'admin-learning-support') {
        url.searchParams.delete('support');
    }

    if (panel !== 'admin-ai-integrations') {
        url.searchParams.delete('ai');
    }

    if (panel !== 'admin-api') {
        url.searchParams.delete('api');
    }

    if (panel !== 'personal') {
        url.searchParams.delete('personal');
    }

    window.history.pushState({ panel }, '', url);
}

function readPersonalViewFromUrl(): PersonalView {
    if (typeof window === 'undefined') {
        return 'profile';
    }

    const value = new URL(window.location.href).searchParams.get('personal');

    return value === 'appearance' ||
        value === 'delete-account' ||
        value === 'language' ||
        value === 'notifications' ||
        value === 'security' ||
        value === 'sound'
        ? value
        : 'profile';
}

function writePersonalViewToUrl(section: PersonalView): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'personal');
    url.searchParams.set('personal', section);
    window.history.pushState({ panel: 'personal' }, '', url);
}

function readAiViewFromUrl(): AiView {
    if (typeof window === 'undefined') {
        return 'providers';
    }

    const value = new URL(window.location.href).searchParams.get('ai');

    return value === 'templates' || value === 'guardrails'
        ? value
        : 'providers';
}

function writeAiViewToUrl(section: AiView): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-ai-integrations');
    url.searchParams.set('ai', section);
    window.history.pushState({ panel: 'admin-ai-integrations' }, '', url);
}

function readAssetViewFromUrl(): AssetView {
    if (typeof window === 'undefined') {
        return 'visuals';
    }

    const value = new URL(window.location.href).searchParams.get('asset');

    return value === 'sounds' ||
        value === 'tools' ||
        value === 'items' ||
        value === 'cursors'
        ? value
        : 'visuals';
}

function writeAssetViewToUrl(section: AssetView): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-assets-world-objects');
    url.searchParams.set('asset', section);
    window.history.pushState({ panel: 'admin-assets-world-objects' }, '', url);
}

function readLearningSupportViewFromUrl(): LearningSupportView {
    if (typeof window === 'undefined') {
        return 'support-signals';
    }

    const value = new URL(window.location.href).searchParams.get('support');

    return value === 'journal' ||
        value === 'learner-messages' ||
        value === 'feedback-requests' ||
        value === 'support-signals' ||
        value === 'organization-icons' ||
        value === 'competence-topics'
        ? value
        : 'support-signals';
}

function writeLearningSupportViewToUrl(section: LearningSupportView): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-learning-support');
    url.searchParams.set('support', section);
    window.history.pushState({ panel: 'admin-learning-support' }, '', url);
}

function readWorldBuilderViewFromUrl(): WorldBuilderView {
    if (typeof window === 'undefined') {
        return 'nodes';
    }

    return new URL(window.location.href).searchParams.get('worldView') ===
        'configure'
        ? 'configure'
        : 'nodes';
}

function readWorldBuilderRootViewFromUrl(): WorldBuilderRootView {
    if (typeof window === 'undefined') {
        return 'graph';
    }

    return new URL(window.location.href).searchParams.get('worldSection') ===
        'structural'
        ? 'structural'
        : 'graph';
}

function writeWorldBuilderRootViewToUrl(section: WorldBuilderRootView): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-world-builder');
    url.searchParams.set('worldSection', section);
    url.searchParams.delete('map');
    url.searchParams.delete('node');
    url.searchParams.delete('worldView');
    url.searchParams.delete('mapConfig');
    url.searchParams.delete('mapVisual');
    window.history.pushState({ panel: 'admin-world-builder' }, '', url);
}

function hasWorldBuilderDetailSelectionInUrl(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const searchParams = new URL(window.location.href).searchParams;

    return searchParams.has('map') || searchParams.has('node');
}

export default function SettingsIndex({
    accessCapabilities,
    accessGroupUsers,
    accessGroups,
    adminRoles,
    adminUsers,
    aiSettings,
    assetsWorldObjects,
    assignableRegistrationRoles,
    canAccessAdministration,
    colorPaletteSettings,
    createdRegistrationToken = null,
    languages,
    learningSupportSettings,
    personalSettings,
    platformInfoPages,
    permissionResources,
    publicPresentation,
    registrationTokens,
    selectedWorldMap,
    selectedWorldNode,
    settingsNotifications,
    worldGraph,
}: SettingsIndexProps) {
    const t = usePlatformTranslation();
    const { resolvedAppearance } = useAppearance();
    const { props, url: pageUrl } = usePage();
    const currentUser = props.auth.user as AuthUser | null;
    const [menuQuery, setMenuQuery] = useState('');
    const [selectedPanel, setSelectedPanel] = useState<SettingsPanelKey | null>(
        () => readPanelFromUrl(canAccessAdministration) ?? 'personal',
    );
    const [personalView, setPersonalView] = useState<PersonalView>(() =>
        readPersonalViewFromUrl(),
    );
    const [worldBuilderView, setWorldBuilderView] = useState<WorldBuilderView>(
        () => readWorldBuilderViewFromUrl(),
    );
    const [worldBuilderRootView, setWorldBuilderRootView] =
        useState<WorldBuilderRootView>(() => readWorldBuilderRootViewFromUrl());
    const [worldBuilderHasDetailSelection, setWorldBuilderHasDetailSelection] =
        useState(() => hasWorldBuilderDetailSelectionInUrl());
    const [assetView, setAssetView] = useState<AssetView>(() =>
        readAssetViewFromUrl(),
    );
    const [learningSupportView, setLearningSupportView] =
        useState<LearningSupportView>(() => readLearningSupportViewFromUrl());
    const [aiView, setAiView] = useState<AiView>(() => readAiViewFromUrl());
    const selectPanel = useCallback((panel: SettingsPanelKey) => {
        setSelectedPanel(panel);
        writePanelToUrl(panel);
    }, []);

    useEffect(() => {
        const syncSettingsRouteState = () => {
            setSelectedPanel(
                readPanelFromUrl(canAccessAdministration) ?? 'personal',
            );
            setPersonalView(readPersonalViewFromUrl());
            setWorldBuilderView(readWorldBuilderViewFromUrl());
            setWorldBuilderRootView(readWorldBuilderRootViewFromUrl());
            setWorldBuilderHasDetailSelection(
                hasWorldBuilderDetailSelectionInUrl(),
            );
            setAssetView(readAssetViewFromUrl());
            setLearningSupportView(readLearningSupportViewFromUrl());
            setAiView(readAiViewFromUrl());
        };

        syncSettingsRouteState();
        window.addEventListener('popstate', syncSettingsRouteState);

        return () => {
            window.removeEventListener('popstate', syncSettingsRouteState);
        };
    }, [canAccessAdministration, pageUrl]);

    const sections = useMemo(
        () =>
            settingsSections(
                t,
                accessCapabilities,
                canAccessAdministration,
                menuQuery,
            ),
        [accessCapabilities, canAccessAdministration, menuQuery, t],
    );
    const activeItem = useMemo(
        () => findSettingsItemForPanel(selectedPanel),
        [selectedPanel],
    );
    const worldBreadcrumb = useMemo<SettingsWorldBreadcrumb>(
        () => ({
            map: worldBuilderHasDetailSelection
                ? (selectedWorldMap?.editableMap.map ??
                  selectedWorldNode?.activityGraph.map ??
                  null)
                : null,
            node:
                worldBuilderHasDetailSelection && selectedWorldNode
                    ? selectedWorldNode.activityGraph.node
                    : null,
            section: worldBuilderRootView,
            view:
                worldBuilderHasDetailSelection &&
                (selectedWorldMap || selectedWorldNode)
                    ? worldBuilderView
                    : null,
        }),
        [
            selectedWorldMap,
            selectedWorldNode,
            worldBuilderHasDetailSelection,
            worldBuilderRootView,
            worldBuilderView,
        ],
    );
    const openItem = useCallback(
        (item: SettingsListItem) => {
            if (item.href) {
                router.visit(item.href);

                return;
            }

            if (item.panel) {
                selectPanel(item.panel);
            }
        },
        [selectPanel],
    );

    return (
        <>
            <Head title={t('settings.title', 'Settings')} />
            <main
                className="settings-surface h-full min-h-0 overflow-hidden bg-[var(--settings-content-background)] text-slate-950 dark:text-slate-100"
                style={getSettingsPresentationStyle(
                    publicPresentation,
                    resolvedAppearance,
                )}
            >
                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                    <SettingsTopBar
                        activeItem={activeItem}
                        currentUser={currentUser}
                        menuQuery={menuQuery}
                        notifications={settingsNotifications}
                        onSearchChange={setMenuQuery}
                        worldBreadcrumb={worldBreadcrumb}
                    />

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                        <aside className="flex shrink-0 flex-col border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] lg:w-72 lg:border-r lg:border-b-0">
                            <SettingsSidebarNavigation
                                activePanel={selectedPanel}
                                onOpenItem={openItem}
                                sections={sections}
                            />
                            <SettingsCornerNavigation />
                        </aside>

                        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--settings-content-background)]">
                            {selectedPanel ? (
                                <SettingsDetail
                                    accessCapabilities={accessCapabilities}
                                    accessGroupUsers={accessGroupUsers}
                                    accessGroups={accessGroups}
                                    adminRoles={adminRoles}
                                    adminUsers={adminUsers}
                                    aiSettings={aiSettings}
                                    assetsWorldObjects={assetsWorldObjects}
                                    colorPaletteSettings={colorPaletteSettings}
                                    createdRegistrationToken={
                                        createdRegistrationToken
                                    }
                                    languages={languages}
                                    learningSupportSettings={
                                        learningSupportSettings
                                    }
                                    permissionResources={permissionResources}
                                    personalSettings={personalSettings}
                                    personalView={personalView}
                                    platformInfoPages={platformInfoPages}
                                    publicPresentation={publicPresentation}
                                    assignableRegistrationRoles={
                                        assignableRegistrationRoles
                                    }
                                    registrationTokens={registrationTokens}
                                    selectedWorldMap={selectedWorldMap}
                                    selectedWorldNode={selectedWorldNode}
                                    assetView={assetView}
                                    aiView={aiView}
                                    learningSupportView={learningSupportView}
                                    setAssetView={setAssetView}
                                    setAiView={setAiView}
                                    setLearningSupportView={
                                        setLearningSupportView
                                    }
                                    setPersonalView={setPersonalView}
                                    setWorldBuilderRootView={
                                        setWorldBuilderRootView
                                    }
                                    setWorldBuilderHasDetailSelection={
                                        setWorldBuilderHasDetailSelection
                                    }
                                    selectedPanel={selectedPanel}
                                    worldBuilderHasDetailSelection={
                                        worldBuilderHasDetailSelection
                                    }
                                    worldBuilderRootView={worldBuilderRootView}
                                    worldBuilderView={worldBuilderView}
                                    worldGraph={worldGraph}
                                />
                            ) : (
                                <SettingsOverview
                                    accessCapabilities={accessCapabilities}
                                    onOpenItem={openItem}
                                    sections={sections}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}

SettingsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Settings',
            href: '/settings',
        },
    ],
};

function SettingsDetail({
    accessCapabilities,
    accessGroupUsers,
    accessGroups,
    adminRoles,
    adminUsers,
    aiSettings,
    aiView,
    assetView,
    assetsWorldObjects,
    assignableRegistrationRoles,
    colorPaletteSettings,
    createdRegistrationToken,
    languages,
    learningSupportSettings,
    learningSupportView,
    permissionResources,
    personalSettings,
    personalView,
    platformInfoPages,
    registrationTokens,
    publicPresentation,
    selectedWorldMap,
    selectedWorldNode,
    selectedPanel,
    setAiView,
    setAssetView,
    setLearningSupportView,
    setPersonalView,
    setWorldBuilderHasDetailSelection,
    setWorldBuilderRootView,
    worldBuilderView,
    worldBuilderHasDetailSelection,
    worldBuilderRootView,
    worldGraph,
}: {
    accessCapabilities: Record<string, AccessCapability>;
    accessGroupUsers: AccessGroupUser[];
    accessGroups: AccessLearningGroup[];
    adminRoles: AccessRoleSummary[];
    adminUsers: AdminUser[];
    aiSettings: AiSettingsProps | null;
    aiView: AiView;
    assetView: AssetView;
    assetsWorldObjects: AssetsWorldObjectsSettings;
    assignableRegistrationRoles: UserRole[];
    colorPaletteSettings: ColorPaletteProps | null;
    createdRegistrationToken: string | null;
    languages: Language[];
    learningSupportSettings: LearningSupportSettings;
    learningSupportView: LearningSupportView;
    permissionResources: PermissionResource[];
    personalSettings: PersonalSettingsProps;
    personalView: PersonalView;
    platformInfoPages: Partial<
        Record<PlatformInfoPageKey, PlatformInfoContent>
    >;
    registrationTokens: RegistrationTokenSummary[];
    publicPresentation: PublicPresentationSettings | null;
    selectedWorldMap: SelectedWorldMap | null;
    selectedWorldNode: SelectedWorldNode | null;
    selectedPanel: SettingsPanelKey;
    setAiView: (view: AiView) => void;
    setAssetView: (view: AssetView) => void;
    setLearningSupportView: (view: LearningSupportView) => void;
    setPersonalView: (view: PersonalView) => void;
    setWorldBuilderHasDetailSelection: (selected: boolean) => void;
    setWorldBuilderRootView: (view: WorldBuilderRootView) => void;
    worldBuilderHasDetailSelection: boolean;
    worldBuilderView: WorldBuilderView;
    worldBuilderRootView: WorldBuilderRootView;
    worldGraph: WorldGraph | null;
}) {
    const content = panelContent[selectedPanel];
    const selectedItem = findSettingsItemForPanel(selectedPanel);
    const showWorldBuilderMapDetail =
        selectedPanel === 'admin-world-builder' &&
        worldBuilderHasDetailSelection;
    const worldBuilderMapDetail =
        showWorldBuilderMapDetail && selectedWorldNode
            ? {
                  activeView: 'nodes' as WorldBuilderMapView,
                  content: (
                      <EditNodeActivities
                          activityGraph={selectedWorldNode.activityGraph}
                          embedded
                          items={selectedWorldNode.items}
                          sounds={selectedWorldNode.sounds}
                          tools={selectedWorldNode.tools}
                      />
                  ),
                  mapId: selectedWorldNode.activityGraph.map.id,
                  mapTitle: selectedWorldNode.activityGraph.map.title,
                  nodeId: selectedWorldNode.activityGraph.node.id,
                  nodeTitle: selectedWorldNode.activityGraph.node.title,
              }
            : showWorldBuilderMapDetail && selectedWorldMap
              ? {
                    activeView:
                        worldBuilderView === 'configure'
                            ? ('configure' as WorldBuilderMapView)
                            : ('nodes' as WorldBuilderMapView),
                    content:
                        worldBuilderView === 'configure' ? (
                            <ConfigureMap
                                accessGroups={selectedWorldMap.accessGroups}
                                canDeleteWorldMaps={
                                    selectedWorldMap.canDeleteWorldMaps
                                }
                                editableMap={selectedWorldMap.editableMap}
                                embedded
                                learningGroups={selectedWorldMap.learningGroups}
                            />
                        ) : (
                            <EditWorldMap
                                accessGroups={selectedWorldMap.accessGroups}
                                contentAuthoringTemplates={
                                    accessCapabilities.ai?.update &&
                                    accessCapabilities.world_activities?.update
                                        ? (aiSettings?.agentTemplates ?? [])
                                              .filter(
                                                  (template) =>
                                                      template.enabled &&
                                                      template.purpose ===
                                                          'content_authoring',
                                              )
                                              .map((template) => ({
                                                  id: template.id,
                                                  model: template.model,
                                                  name: template.name,
                                                  providerLabel:
                                                      template.providerLabel,
                                              }))
                                        : undefined
                                }
                                editableMap={selectedWorldMap.editableMap}
                                embedded
                                tools={selectedWorldMap.tools}
                            />
                        ),
                    mapId: selectedWorldMap.editableMap.map.id,
                    mapTitle: selectedWorldMap.editableMap.map.title,
                }
              : null;

    return (
        <div className="h-full overflow-hidden bg-[var(--settings-content-background)]">
            {selectedPanel === 'personal' ? (
                <PersonalSettingsContent
                    {...personalSettings}
                    activeSection={personalView}
                    onSelectSection={(section) => {
                        setPersonalView(section);
                        writePersonalViewToUrl(section);
                    }}
                />
            ) : selectedPanel === 'admin-ai-integrations' && aiSettings ? (
                <div className="h-full min-h-0">
                    <AiSettings
                        {...aiSettings}
                        activeSection={aiView}
                        embedded
                        onSelectSection={(section) => {
                            setAiView(section);
                            writeAiViewToUrl(section);
                        }}
                    />
                </div>
            ) : selectedPanel === 'admin-ai-integrations' ? (
                <SettingsUnavailablePanel label="AI & Integrations" />
            ) : selectedPanel === 'admin-api' ? (
                <ContentApiPanel />
            ) : selectedPanel === 'admin-learning-support' ? (
                <LearningSupportPanel
                    activeSection={learningSupportView}
                    canViewAdminPanel={
                        (accessCapabilities.journal_feedback?.read ?? false) ||
                        (accessCapabilities.competence_topics?.read ?? false) ||
                        (accessCapabilities.organization_moderation?.read ??
                            false)
                    }
                    canViewJournal={
                        accessCapabilities.journal_settings?.read ?? false
                    }
                    canViewLearnerMessages={
                        accessCapabilities.learner_messages?.read ?? false
                    }
                    canViewSupportSignals={
                        accessCapabilities.learner_support_signals?.read ??
                        false
                    }
                    onSelectSection={(section) => {
                        setLearningSupportView(section);
                        writeLearningSupportViewToUrl(section);
                    }}
                    settings={learningSupportSettings}
                />
            ) : selectedPanel === 'admin-assets-world-objects' ? (
                <AssetsWorldObjectsPanel
                    activeSection={assetView}
                    assets={assetsWorldObjects}
                    canViewAssets={accessCapabilities.assets?.read ?? false}
                    canViewCursors={
                        accessCapabilities.presentation?.read ?? false
                    }
                    canViewSounds={accessCapabilities.sounds?.read ?? false}
                    onSelectSection={(section) => {
                        setAssetView(section);
                        writeAssetViewToUrl(section);
                    }}
                    publicPresentation={publicPresentation}
                />
            ) : selectedPanel === 'admin-public-pages' && publicPresentation ? (
                <div className="h-full min-h-0">
                    <AdminPresentationPanel
                        platformInfoContent={platformInfoPages}
                        presentation={publicPresentation}
                    />
                </div>
            ) : selectedPanel === 'admin-public-pages' ? (
                <SettingsUnavailablePanel label="Public pages" />
            ) : selectedPanel === 'admin-color-palettes' &&
              colorPaletteSettings ? (
                <div className="h-full min-h-0">
                    <ColorPaletteSettings {...colorPaletteSettings} embedded />
                </div>
            ) : selectedPanel === 'admin-color-palettes' ? (
                <SettingsUnavailablePanel label="Color palettes" />
            ) : selectedPanel === 'admin-translations' &&
              languages.length > 0 ? (
                <div className="h-full min-h-0">
                    <LanguageAdministration embedded languages={languages} />
                </div>
            ) : selectedPanel === 'admin-translations' ? (
                <SettingsUnavailablePanel label="Translations" />
            ) : selectedPanel === 'admin-world-builder' && worldGraph ? (
                <WorldBuilderSettingsPanel
                    activeSection={worldBuilderRootView}
                    canViewGraph={
                        (accessCapabilities.world_maps?.read ?? false) ||
                        (accessCapabilities.world_nodes?.read ?? false) ||
                        (accessCapabilities.world_activities?.read ?? false)
                    }
                    canViewStructural={
                        accessCapabilities.world_maps?.read ?? false
                    }
                    onSelectSection={(section) => {
                        setWorldBuilderRootView(section);
                        setWorldBuilderHasDetailSelection(false);
                        writeWorldBuilderRootViewToUrl(section);
                    }}
                    selectedMapDetail={worldBuilderMapDetail}
                    worldGraph={worldGraph}
                />
            ) : (selectedPanel === 'admin-access' ||
                  selectedPanel === 'admin-users') &&
              (accessCapabilities.users?.read ||
                  accessCapabilities.roles?.read) ? (
                <AccessManagementPanel
                    accessCapabilities={accessCapabilities}
                    accessGroupUsers={accessGroupUsers}
                    accessGroups={accessGroups}
                    roles={adminRoles}
                    assignableRegistrationRoles={assignableRegistrationRoles}
                    createdRegistrationToken={createdRegistrationToken}
                    permissionResources={permissionResources}
                    registrationTokens={registrationTokens}
                    users={adminUsers}
                />
            ) : selectedItem ? (
                <SettingsRouteGroupPanel
                    accessCapabilities={accessCapabilities}
                    item={selectedItem}
                />
            ) : content ? (
                <SettingsPlaceholderPanel
                    content={content}
                    panel={selectedPanel}
                />
            ) : null}
        </div>
    );
}

function SettingsUnavailablePanel({ label }: { label: string }) {
    return (
        <section className="grid h-full place-items-center p-6 text-center">
            <p className="max-w-lg text-sm leading-6 text-[var(--settings-muted-text)]">
                {label} settings are not available with the current permissions.
            </p>
        </section>
    );
}

function AccessManagementPanel({
    accessCapabilities,
    accessGroupUsers,
    accessGroups,
    assignableRegistrationRoles,
    createdRegistrationToken,
    permissionResources,
    registrationTokens,
    roles,
    users,
}: {
    accessCapabilities: Record<string, AccessCapability>;
    accessGroupUsers: AccessGroupUser[];
    accessGroups: AccessLearningGroup[];
    assignableRegistrationRoles: UserRole[];
    createdRegistrationToken: string | null;
    permissionResources: PermissionResource[];
    registrationTokens: RegistrationTokenSummary[];
    roles: AccessRoleSummary[];
    users: AdminUser[];
}) {
    const t = usePlatformTranslation();
    const [section, setSection] = useState<AccessManagementSection>(() =>
        readAccessSectionFromUrl(accessCapabilities),
    );
    const selectSection = useCallback(
        (nextSection: AccessManagementSection) => {
            setSection(nextSection);
            writeAccessSectionToUrl(nextSection);
        },
        [],
    );

    useEffect(() => {
        const syncAccessSectionFromHistory = () => {
            setSection(readAccessSectionFromUrl(accessCapabilities));
        };

        window.addEventListener('popstate', syncAccessSectionFromHistory);

        return () => {
            window.removeEventListener(
                'popstate',
                syncAccessSectionFromHistory,
            );
        };
    }, [accessCapabilities]);

    const accessItem: SettingsNavigationItem<'access-management'> = {
        description: t(
            'settings.access.description',
            'Configure who can read, update or delete administration areas. Default roles stay available.',
        ),
        icon: Shield,
        key: 'access-management',
        label: t('settings.access.title', 'Access management'),
    };
    const activeSectionItem =
        accessManagementSections.find((item) => item.key === section) ??
        accessManagementSections[0];

    return (
        <SettingsNestedWorkspace
            contentClassName="overflow-hidden"
            item={activeSectionItem ?? accessItem}
            sidebar={
                <AccessManagementNavigation
                    activeSection={section}
                    canViewGroups={accessCapabilities.groups?.read ?? false}
                    canViewRoles={accessCapabilities.roles?.read ?? false}
                    canViewUsers={accessCapabilities.users?.read ?? false}
                    onSelect={selectSection}
                />
            }
        >
            <div className="h-full min-h-0 overflow-hidden">
                {section === 'users' && accessCapabilities.users?.read ? (
                    <div className="h-full overflow-hidden">
                        <AdminUsersPanel
                            assignableRegistrationRoles={
                                assignableRegistrationRoles
                            }
                            canDeleteUsers={
                                accessCapabilities.users?.delete ?? false
                            }
                            canUpdateUsers={
                                accessCapabilities.users?.update ?? false
                            }
                            createdRegistrationToken={createdRegistrationToken}
                            registrationTokens={registrationTokens}
                            roles={roles}
                            users={users}
                        />
                    </div>
                ) : null}

                {section === 'roles' && accessCapabilities.roles?.read ? (
                    <RoleManagementPanel
                        canDeleteRoles={
                            accessCapabilities.roles?.delete ?? false
                        }
                        canUpdateRoles={
                            accessCapabilities.roles?.update ?? false
                        }
                        permissionResources={permissionResources}
                        roles={roles}
                    />
                ) : null}

                {section === 'groups' && accessCapabilities.groups?.read ? (
                    <AccessGroupManagementPanel
                        groups={accessGroups}
                        users={accessGroupUsers}
                    />
                ) : null}
            </div>
        </SettingsNestedWorkspace>
    );
}

function AdminUsersPanel({
    assignableRegistrationRoles,
    canDeleteUsers,
    canUpdateUsers,
    createdRegistrationToken,
    registrationTokens,
    roles,
    users,
}: {
    assignableRegistrationRoles: UserRole[];
    canDeleteUsers: boolean;
    canUpdateUsers: boolean;
    createdRegistrationToken: string | null;
    registrationTokens: RegistrationTokenSummary[];
    roles: AccessRoleSummary[];
    users: AdminUser[];
}) {
    const t = usePlatformTranslation();
    const { props } = usePage();
    const currentUser = props.auth.user as AuthUser | null;
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [tokenRoles, setTokenRoles] = useState<UserRole[]>([
        assignableRegistrationRoles[0] ?? 'user',
    ]);
    const [tokenRoleToAdd, setTokenRoleToAdd] = useState<UserRole>(
        assignableRegistrationRoles[0] ?? 'user',
    );
    const [tokenExpiresAt, setTokenExpiresAt] = useState('');
    const [formOverrides, setFormOverrides] = useState<
        Record<number, Partial<AccessFormState>>
    >({});
    const defaultForms = useMemo(() => {
        return Object.fromEntries(
            users.map((user) => [
                user.id,
                {
                    loginDisabled: user.is_login_disabled,
                    bannedUntil: toDateTimeLocal(user.banned_until),
                    roles: user.roles,
                },
            ]),
        ) as Record<number, AccessFormState>;
    }, [users]);
    const forms = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(defaultForms).map(([userId, form]) => [
                    userId,
                    {
                        ...form,
                        ...formOverrides[Number(userId)],
                    },
                ]),
            ) as Record<number, AccessFormState>,
        [defaultForms, formOverrides],
    );

    const unusedTokenCount = useMemo(
        () =>
            registrationTokens.filter(
                (token) => !token.is_used && !token.is_expired,
            ).length,
        [registrationTokens],
    );

    const createToken = () => {
        router.post(
            '/settings/registration-tokens',
            {
                roles: tokenRoles,
                expires_at: tokenExpiresAt || null,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setIsCreatingToken(false);
                    setTokenRoles([assignableRegistrationRoles[0] ?? 'user']);
                    setTokenRoleToAdd(assignableRegistrationRoles[0] ?? 'user');
                    setTokenExpiresAt('');
                },
            },
        );
    };

    const resetTokenCreation = () => {
        setIsCreatingToken(false);
        setTokenRoles([assignableRegistrationRoles[0] ?? 'user']);
        setTokenRoleToAdd(assignableRegistrationRoles[0] ?? 'user');
        setTokenExpiresAt('');
    };

    const copyCreatedToken = async () => {
        if (!createdRegistrationToken) {
            return;
        }

        await navigator.clipboard.writeText(createdRegistrationToken);
    };

    const updateForm = (
        userId: number,
        nextState: Partial<AccessFormState>,
    ) => {
        setFormOverrides((current) => ({
            ...current,
            [userId]: {
                ...current[userId],
                ...nextState,
            },
        }));
    };

    const saveAccess = (user: AdminUser) => {
        const form = forms[user.id];
        const defaultForm = defaultForms[user.id];

        if (
            !form ||
            !defaultForm ||
            !isDirtyState(
                normalizedAccessForm(form),
                normalizedAccessForm(defaultForm),
            )
        ) {
            return;
        }

        router.patch(
            `/settings/admin/users/${user.id}/access`,
            {
                login_disabled: form.loginDisabled,
                banned_until: form.bannedUntil || null,
                roles: form.roles,
            },
            {
                preserveScroll: true,
                preserveState: true,
            },
        );
    };

    const deleteUser = (user: AdminUser) => {
        if (
            !window.confirm(
                t(
                    'settings.access.users.delete_confirm',
                    'Delete :name? This cannot be undone.',
                    { name: user.name },
                ),
            )
        ) {
            return;
        }

        router.delete(`/settings/admin/users/${user.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                        <Users className="size-5" />
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            {t('settings.access.users.title', 'Users')}
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                        {t(
                            'settings.access.users.description',
                            'Manage registration tokens and account access. Token plaintext is shown only once after creation.',
                        )}
                    </p>
                </div>
                <Button onClick={() => setIsCreatingToken(true)}>
                    <Plus className="size-4" />
                    {t('settings.access.users.create_token', 'Create token')}
                </Button>
            </div>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        resetTokenCreation();
                    }
                }}
                open={isCreatingToken}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'settings.access.tokens.dialog_title',
                                'Create registration token',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'settings.access.tokens.dialog_description',
                                'Choose the roles this one-use token grants and optionally set an expiration date.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <RoleEditor
                            assignableRoles={assignableRegistrationRoles}
                            idPrefix="token"
                            onChange={setTokenRoles}
                            roleToAdd={tokenRoleToAdd}
                            roleOptions={roles}
                            roles={tokenRoles}
                            setRoleToAdd={setTokenRoleToAdd}
                        />
                        <div className="grid gap-1">
                            <Label htmlFor="token-expires-at">
                                {t(
                                    'settings.access.tokens.expires_at',
                                    'Expires at',
                                )}
                            </Label>
                            <Input
                                id="token-expires-at"
                                onChange={(event) =>
                                    setTokenExpiresAt(event.currentTarget.value)
                                }
                                type="datetime-local"
                                value={tokenExpiresAt}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={resetTokenCreation}
                            type="button"
                            variant="secondary"
                        >
                            {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button onClick={createToken} type="button">
                            <Plus className="size-4" />
                            {t('common.create', 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {createdRegistrationToken ? (
                    <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] p-4 text-slate-950 dark:text-slate-50">
                        <p className="text-sm font-medium">
                            {t(
                                'settings.access.tokens.new',
                                'New registration token',
                            )}
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-[var(--settings-content-background)] px-3 py-2 text-sm">
                                {createdRegistrationToken}
                            </code>
                            <Button
                                onClick={copyCreatedToken}
                                variant="secondary"
                            >
                                <Copy className="size-4" />
                                {t('common.copy', 'Copy')}
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <AdminMetric
                        label={t(
                            'settings.access.metrics.registered_users',
                            'Registered users',
                        )}
                        value={users.length}
                    />
                    <AdminMetric
                        label={t(
                            'settings.access.metrics.unused_tokens',
                            'Unused tokens',
                        )}
                        value={unusedTokenCount}
                    />
                    <AdminMetric
                        label={t(
                            'settings.access.metrics.blocked_users',
                            'Blocked users',
                        )}
                        value={
                            users.filter(
                                (user) =>
                                    user.is_login_disabled ||
                                    user.is_currently_banned,
                            ).length
                        }
                    />
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-[var(--settings-border-color)]">
                    <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_150px_minmax(0,1fr)_180px] gap-3 bg-[var(--settings-active-background)] px-4 py-3 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase lg:grid">
                        <span>
                            {t('settings.access.users.table.user', 'User')}
                        </span>
                        <span>
                            {t('settings.access.users.table.roles', 'Roles')}
                        </span>
                        <span>
                            {t('settings.access.users.table.status', 'Status')}
                        </span>
                        <span>
                            {t(
                                'settings.access.users.table.ban_until',
                                'Ban until',
                            )}
                        </span>
                        <span>
                            {t(
                                'settings.access.users.table.actions',
                                'Actions',
                            )}
                        </span>
                    </div>
                    <div className="divide-y divide-[var(--settings-border-color)]">
                        {users.map((user) => {
                            const form = forms[user.id];
                            const hasUserChanges = form
                                ? isDirtyState(
                                      normalizedAccessForm(form),
                                      normalizedAccessForm(
                                          defaultForms[user.id],
                                      ),
                                  )
                                : false;
                            const isCurrentUser = currentUser?.id === user.id;

                            return (
                                <div
                                    className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_150px_minmax(0,1fr)_180px] lg:items-center"
                                    key={user.id}
                                >
                                    <button
                                        className="min-w-0 text-left focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                                        onClick={() => setSelectedUser(user)}
                                        type="button"
                                    >
                                        <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">
                                            {user.name}
                                        </span>
                                        <span className="block truncate text-xs text-[var(--settings-muted-text)]">
                                            {user.email}
                                        </span>
                                    </button>

                                    <RoleEditor
                                        assignableRoles={
                                            assignableRegistrationRoles
                                        }
                                        disabled={
                                            isCurrentUser || !canUpdateUsers
                                        }
                                        idPrefix={`user-${user.id}`}
                                        onChange={(roles) =>
                                            updateForm(user.id, { roles })
                                        }
                                        roleOptions={roles}
                                        roleToAdd={
                                            firstAddableRole(
                                                assignableRegistrationRoles,
                                                form?.roles ?? user.roles,
                                            ) ?? assignableRegistrationRoles[0]
                                        }
                                        roles={form?.roles ?? user.roles}
                                    />

                                    <div className="flex flex-col gap-2">
                                        <StatusBadges user={user} />
                                        <LoginToggle
                                            disabled={isCurrentUser}
                                            isDisabled={
                                                form?.loginDisabled ?? false
                                            }
                                            onChange={(loginDisabled) =>
                                                updateForm(user.id, {
                                                    loginDisabled,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-1">
                                        <Label
                                            className="text-xs lg:hidden"
                                            htmlFor={`banned-until-${user.id}`}
                                        >
                                            {t(
                                                'settings.access.users.table.ban_until',
                                                'Ban until',
                                            )}
                                        </Label>
                                        <Input
                                            disabled={isCurrentUser}
                                            id={`banned-until-${user.id}`}
                                            onChange={(event) =>
                                                updateForm(user.id, {
                                                    bannedUntil:
                                                        event.currentTarget
                                                            .value,
                                                })
                                            }
                                            type="datetime-local"
                                            value={form?.bannedUntil ?? ''}
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            disabled={
                                                isCurrentUser ||
                                                !canUpdateUsers ||
                                                !hasUserChanges
                                            }
                                            onClick={() => saveAccess(user)}
                                            size="sm"
                                            variant="secondary"
                                        >
                                            {t('common.save', 'Save')}
                                        </Button>
                                        <Button
                                            disabled={
                                                isCurrentUser || !canDeleteUsers
                                            }
                                            onClick={() => deleteUser(user)}
                                            size="sm"
                                            variant="destructive"
                                        >
                                            <Trash2 className="size-4" />
                                            {t('common.delete', 'Delete')}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-5 rounded-lg border border-[var(--settings-border-color)] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-950 dark:text-white">
                        <KeyRound className="size-4 text-[var(--settings-accent)]" />
                        {t(
                            'settings.access.tokens.latest',
                            'Latest registration tokens',
                        )}
                    </div>
                    <div className="grid gap-2">
                        {registrationTokens.map((token) => (
                            <div
                                className="flex flex-col gap-2 rounded-md bg-[var(--settings-active-background)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                                key={token.id}
                            >
                                <div>
                                    <span className="font-medium">
                                        {t(
                                            'settings.access.tokens.number',
                                            'Token #:id',
                                            { id: token.id },
                                        )}
                                    </span>
                                    <span className="ml-2 text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.access.tokens.created_by',
                                            'created by :name',
                                            {
                                                name:
                                                    token.created_by?.name ??
                                                    t(
                                                        'common.unknown',
                                                        'Unknown',
                                                    ),
                                            },
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RoleBadges
                                        roleOptions={roles}
                                        roles={token.roles}
                                    />
                                    <Badge
                                        variant={
                                            token.is_expired
                                                ? 'destructive'
                                                : token.is_used
                                                  ? 'secondary'
                                                  : 'default'
                                        }
                                    >
                                        {token.is_expired
                                            ? t(
                                                  'settings.access.tokens.expired',
                                                  'Expired',
                                              )
                                            : token.is_used
                                              ? t(
                                                    'settings.access.tokens.used',
                                                    'Used',
                                                )
                                              : t(
                                                    'settings.access.tokens.unused',
                                                    'Unused',
                                                )}
                                    </Badge>
                                    <span className="text-xs text-[var(--settings-muted-text)]">
                                        {formatDate(token.created_at, t)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedUser(null);
                    }
                }}
                open={Boolean(selectedUser)}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    {selectedUser ? (
                        <UserDetailsDialog
                            roleOptions={roles}
                            user={selectedUser}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] p-4">
            <p className="text-2xl font-semibold text-slate-950 dark:text-white">
                {value}
            </p>
            <p className="mt-1 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                {label}
            </p>
        </div>
    );
}

function RoleEditor({
    assignableRoles,
    disabled = false,
    idPrefix,
    onChange,
    roleToAdd,
    roleOptions,
    roles,
    setRoleToAdd,
}: {
    assignableRoles: UserRole[];
    disabled?: boolean;
    idPrefix: string;
    onChange: (roles: UserRole[]) => void;
    roleToAdd?: UserRole;
    roleOptions: AccessRoleSummary[];
    roles: UserRole[];
    setRoleToAdd?: (role: UserRole) => void;
}) {
    const t = usePlatformTranslation();
    const [internalRoleToAdd, setInternalRoleToAdd] = useState<UserRole>(
        firstAddableRole(assignableRoles, roles) ??
            assignableRoles[0] ??
            'user',
    );
    const selectedRoleToAdd = roleToAdd ?? internalRoleToAdd;
    const setSelectedRoleToAdd = setRoleToAdd ?? setInternalRoleToAdd;
    const addableRoles = assignableRoles.filter(
        (role) => !roles.includes(role),
    );
    const addRole = () => {
        if (!selectedRoleToAdd || roles.includes(selectedRoleToAdd)) {
            return;
        }

        onChange([...roles, selectedRoleToAdd]);
        setSelectedRoleToAdd(
            firstAddableRole(assignableRoles, [...roles, selectedRoleToAdd]) ??
                assignableRoles[0] ??
                'user',
        );
    };
    const removeRole = (roleToRemove: UserRole) => {
        if (roles.length <= 1) {
            return;
        }

        onChange(roles.filter((role) => role !== roleToRemove));
    };

    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                    <span
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] px-2 py-1 text-xs font-medium"
                        key={role}
                    >
                        {roleLabel(role, roleOptions)}
                        {!disabled && roles.length > 1 ? (
                            <button
                                aria-label={t(
                                    'settings.access.roles.remove_role',
                                    'Remove :role role',
                                    { role: roleLabel(role, roleOptions) },
                                )}
                                className="rounded text-[var(--settings-muted-text)] transition hover:text-red-600 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:hover:text-red-300"
                                onClick={() => removeRole(role)}
                                type="button"
                            >
                                <X className="size-3" />
                            </button>
                        ) : null}
                    </span>
                ))}
            </div>

            {!disabled && addableRoles.length > 0 ? (
                <div className="flex gap-2">
                    <select
                        className="h-9 min-w-0 flex-1 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-3 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-slate-100"
                        id={`${idPrefix}-role`}
                        onChange={(event) =>
                            setSelectedRoleToAdd(
                                event.currentTarget.value as UserRole,
                            )
                        }
                        value={selectedRoleToAdd}
                    >
                        {addableRoles.map((role) => (
                            <option
                                className="bg-[var(--settings-content-background)] text-slate-950 dark:text-slate-100"
                                key={role}
                                value={role}
                            >
                                {roleLabel(role, roleOptions)}
                            </option>
                        ))}
                    </select>
                    <Button onClick={addRole} size="sm" variant="secondary">
                        {t('common.add', 'Add')}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function LoginToggle({
    disabled,
    isDisabled,
    onChange,
}: {
    disabled: boolean;
    isDisabled: boolean;
    onChange: (isDisabled: boolean) => void;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="inline-grid grid-cols-2 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] p-1 text-xs font-medium">
            <button
                className={cn(
                    'rounded-md px-2 py-1.5 transition',
                    !isDisabled
                        ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                        : 'text-[var(--settings-muted-text)] hover:text-[var(--settings-accent)]',
                )}
                disabled={disabled}
                onClick={() => onChange(false)}
                type="button"
            >
                {t('settings.access.login.enabled', 'Enabled')}
            </button>
            <button
                className={cn(
                    'rounded-md px-2 py-1.5 transition',
                    isDisabled
                        ? 'bg-red-600 text-white shadow-sm dark:bg-red-400 dark:text-slate-950'
                        : 'text-[var(--settings-muted-text)] hover:text-[var(--settings-accent)]',
                )}
                disabled={disabled}
                onClick={() => onChange(true)}
                type="button"
            >
                {t('settings.access.login.disabled', 'Disabled')}
            </button>
        </div>
    );
}

function UserDetailsDialog({
    roleOptions,
    user,
}: {
    roleOptions: AccessRoleSummary[];
    user: AdminUser;
}) {
    const t = usePlatformTranslation();
    const token = user.registration_token;

    return (
        <>
            <DialogHeader>
                <DialogTitle>{user.name}</DialogTitle>
                <DialogDescription>
                    {t(
                        'settings.access.users.details.description',
                        'Read-only account and registration-token audit details.',
                    )}
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 text-sm">
                <DetailRow
                    label={t('settings.access.users.details.email', 'Email')}
                    value={user.email}
                />
                <DetailRow
                    label={t('settings.access.users.details.roles', 'Roles')}
                    value={roleListLabel(user.roles, roleOptions)}
                />
                <DetailRow
                    label={t(
                        'settings.access.users.details.registered',
                        'Registered',
                    )}
                    value={formatDate(user.created_at, t)}
                />
                <DetailRow
                    label={t(
                        'settings.access.users.details.login_disabled',
                        'Login disabled',
                    )}
                    value={formatDate(user.login_disabled_at, t)}
                />
                <DetailRow
                    label={t(
                        'settings.access.users.details.banned_until',
                        'Banned until',
                    )}
                    value={formatDate(user.banned_until, t)}
                />

                <div className="rounded-lg border border-[var(--settings-border-color)] p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium">
                        <CalendarClock className="size-4 text-[var(--settings-accent)]" />
                        {t(
                            'settings.access.users.details.registration_token',
                            'Registration token',
                        )}
                    </div>
                    {token ? (
                        <div className="grid gap-3">
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_id',
                                    'Token id',
                                )}
                                value={`#${token.id.toString()}`}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_created',
                                    'Token created',
                                )}
                                value={formatDate(token.created_at, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_roles',
                                    'Token roles',
                                )}
                                value={roleListLabel(token.roles, roleOptions)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_expires',
                                    'Token expires',
                                )}
                                value={formatDate(token.expires_at, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_creator',
                                    'Token creator',
                                )}
                                value={formatUserReference(token.created_by, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_used',
                                    'Token used',
                                )}
                                value={formatDate(token.used_at, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.used_by',
                                    'Used by',
                                )}
                                value={formatUserReference(token.used_by, t)}
                            />
                        </div>
                    ) : (
                        <p className="text-[var(--settings-muted-text)]">
                            {t(
                                'settings.access.users.details.no_token',
                                'No registration token is linked to this account.',
                            )}
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}

function RoleManagementPanel({
    canDeleteRoles,
    canUpdateRoles,
    permissionResources,
    roles,
}: {
    canDeleteRoles: boolean;
    canUpdateRoles: boolean;
    permissionResources: PermissionResource[];
    roles: AccessRoleSummary[];
}) {
    const t = usePlatformTranslation();
    const [selectedRoleId, setSelectedRoleId] = useState<number | 'new'>(
        roles[0]?.id ?? 'new',
    );
    const selectedRole =
        selectedRoleId === 'new'
            ? null
            : (roles.find((role) => role.id === selectedRoleId) ?? null);
    const [form, setForm] = useState<RoleFormState>(() =>
        roleFormFromRole(selectedRole, permissionResources),
    );
    const roleBaseline = useMemo(
        () => roleFormFromRole(selectedRole, permissionResources),
        [permissionResources, selectedRole],
    );
    const hasRoleChanges = useDirtyState(form, roleBaseline);
    const groupedResources = useMemo(
        () => groupPermissionResources(permissionResources),
        [permissionResources],
    );

    const selectRole = (role: AccessRoleSummary) => {
        setSelectedRoleId(role.id);
        setForm(roleFormFromRole(role, permissionResources));
    };
    const startCreate = () => {
        setSelectedRoleId('new');
        setForm(roleFormFromRole(null, permissionResources));
    };
    const saveRole = () => {
        if (!hasRoleChanges) {
            return;
        }

        const payload = {
            ...form,
            level: Number(form.level || 10),
            permission_scopes: form.permissionScopes,
        };

        if (selectedRole) {
            router.patch(`/settings/admin/roles/${selectedRole.id}`, payload, {
                preserveScroll: true,
                preserveState: true,
            });

            return;
        }

        router.post('/settings/admin/roles', payload, {
            preserveScroll: true,
            preserveState: true,
        });
    };
    const deleteRole = () => {
        if (!selectedRole) {
            return;
        }

        if (
            !window.confirm(
                t(
                    'settings.access.roles.delete_confirm',
                    'Delete role :name?',
                    {
                        name: selectedRole.name,
                    },
                ),
            )
        ) {
            return;
        }

        router.delete(`/settings/admin/roles/${selectedRole.id}`, {
            preserveScroll: true,
        });
    };
    const setPermission = (resource: string, level: PermissionLevel) => {
        setForm((current) => ({
            ...current,
            permissions: {
                ...current.permissions,
                [resource]: level,
            },
        }));
    };
    const setPermissionScope = (resource: string, scope: PermissionScope) => {
        setForm((current) => ({
            ...current,
            permissionScopes: {
                ...current.permissionScopes,
                [resource]: scope,
            },
        }));
    };

    return (
        <div className="grid h-full min-h-0 gap-4 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col rounded-lg border border-[var(--settings-border-color)]">
                <div className="flex items-center justify-between border-b border-[var(--settings-border-color)] p-3">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                            {t('settings.access.roles.title', 'Roles')}
                        </h3>
                        <p className="text-xs text-[var(--settings-muted-text)]">
                            {t(
                                'settings.access.roles.description',
                                'Select a role to inspect or edit.',
                            )}
                        </p>
                    </div>
                    {canUpdateRoles ? (
                        <Button onClick={startCreate} size="sm">
                            <Plus className="size-4" />
                        </Button>
                    ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {roles.map((role) => (
                        <button
                            className={cn(
                                'mb-2 w-full rounded-lg border p-3 text-left transition',
                                selectedRoleId === role.id
                                    ? 'border-[var(--settings-accent)] bg-[var(--settings-active-background)] text-slate-950 dark:text-slate-50'
                                    : 'border-[var(--settings-border-color)] bg-[var(--settings-active-background)] text-slate-800 hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] dark:text-slate-100',
                            )}
                            key={role.id}
                            onClick={() => selectRole(role)}
                            type="button"
                        >
                            <span className="block text-sm font-medium">
                                {role.name}
                            </span>
                            <span className="mt-1 block text-xs text-[var(--settings-muted-text)]">
                                {role.slug}
                            </span>
                        </button>
                    ))}
                </div>
            </aside>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--settings-border-color)]">
                <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--settings-border-color)] p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            {selectedRole
                                ? t(
                                      'settings.access.roles.eyebrow_existing',
                                      'Role',
                                  )
                                : t(
                                      'settings.access.roles.eyebrow_new',
                                      'New role',
                                  )}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                            {selectedRole
                                ? selectedRole.name
                                : t(
                                      'settings.access.roles.create_title',
                                      'Create role',
                                  )}
                        </h3>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                            <Label htmlFor="role-name">
                                {t('settings.access.roles.name', 'Name')}
                            </Label>
                            <Input
                                disabled={!canUpdateRoles}
                                id="role-name"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        name: event.currentTarget.value,
                                    }))
                                }
                                value={form.name}
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="role-slug">
                                {t('settings.access.roles.slug', 'Slug')}
                            </Label>
                            <Input
                                disabled={
                                    !canUpdateRoles || Boolean(selectedRole)
                                }
                                id="role-slug"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        slug: event.currentTarget.value,
                                    }))
                                }
                                value={form.slug}
                            />
                        </div>
                        <div className="grid gap-1 sm:col-span-2">
                            <Label htmlFor="role-description">
                                {t(
                                    'settings.access.roles.role_description',
                                    'Description',
                                )}
                            </Label>
                            <Input
                                disabled={!canUpdateRoles}
                                id="role-description"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        description: event.currentTarget.value,
                                    }))
                                }
                                value={form.description}
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="role-level">
                                {t(
                                    'settings.access.roles.assignment_level',
                                    'Assignment level',
                                )}
                            </Label>
                            <Input
                                disabled={!canUpdateRoles}
                                id="role-level"
                                max="100"
                                min="1"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        level: event.currentTarget.value,
                                    }))
                                }
                                type="number"
                                value={form.level}
                            />
                        </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-lg border border-[var(--settings-border-color)]">
                        <div className="grid grid-cols-[minmax(12rem,1fr)_18rem_14rem] bg-[var(--settings-active-background)] px-4 py-3 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                            <span>
                                {t('settings.access.roles.area', 'Area')}
                            </span>
                            <span>
                                {t(
                                    'settings.access.roles.permission_level',
                                    'Permission level',
                                )}
                            </span>
                            <span>
                                {t('settings.access.roles.scope', 'Scope')}
                            </span>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {groupedResources.map((group) => (
                                <div key={group.name}>
                                    <div className="border-t border-[var(--settings-border-color)] bg-[var(--settings-active-background)] px-4 py-2 text-xs font-semibold tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                                        {group.name}
                                    </div>
                                    {group.resources.map((resource) => (
                                        <div
                                            className="grid gap-3 border-t border-[var(--settings-border-color)] p-4 sm:grid-cols-[minmax(12rem,1fr)_18rem_14rem] sm:items-center"
                                            key={resource.key}
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-slate-950 dark:text-white">
                                                    {resource.label}
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                                                    {resource.description}
                                                </p>
                                            </div>
                                            <PermissionButtonGroup
                                                disabled={!canUpdateRoles}
                                                level={
                                                    form.permissions[
                                                        resource.key
                                                    ] ?? 'none'
                                                }
                                                onChange={(level) =>
                                                    setPermission(
                                                        resource.key,
                                                        level,
                                                    )
                                                }
                                            />
                                            <PermissionScopeSelect
                                                disabled={!canUpdateRoles}
                                                onChange={(scope) =>
                                                    setPermissionScope(
                                                        resource.key,
                                                        scope,
                                                    )
                                                }
                                                scope={
                                                    form.permissionScopes[
                                                        resource.key
                                                    ] ?? 'all'
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-2 rounded-lg bg-[var(--settings-active-background)] p-3 text-xs leading-5 text-[var(--settings-muted-text)]">
                        <p>
                            <strong>
                                {t('settings.access.permissions.ro', 'RO')}
                            </strong>
                            :{' '}
                            {t(
                                'settings.access.permissions.ro_legend',
                                'read only. The role may inspect the area but not save changes.',
                            )}
                        </p>
                        <p>
                            <strong>
                                {t('settings.access.permissions.ru', 'RU')}
                            </strong>
                            :{' '}
                            {t(
                                'settings.access.permissions.ru_legend',
                                'read and update. The role may edit existing content and create new content.',
                            )}
                        </p>
                        <p>
                            <strong>
                                {t('settings.access.permissions.rud', 'RUD')}
                            </strong>
                            :{' '}
                            {t(
                                'settings.access.permissions.rud_legend',
                                'read, update and delete. The role may remove records where the feature supports deletion.',
                            )}
                        </p>
                        <p>
                            {t(
                                'settings.access.permissions.scope_legend',
                                'Scope limits where the level applies: own records, assigned records, group records or all records.',
                            )}
                        </p>
                    </div>
                </div>
                <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--settings-border-color)] p-4">
                    <div>
                        {selectedRole && canDeleteRoles ? (
                            <Button
                                disabled={selectedRole.is_system}
                                onClick={deleteRole}
                                variant="destructive"
                            >
                                <Trash2 className="size-4" />
                                {t('common.delete', 'Delete')}
                            </Button>
                        ) : null}
                    </div>
                    {canUpdateRoles ? (
                        <Button disabled={!hasRoleChanges} onClick={saveRole}>
                            {selectedRole
                                ? t('common.save', 'Save')
                                : t('common.create', 'Create')}
                        </Button>
                    ) : (
                        <Button disabled variant="secondary">
                            {t('common.read_only', 'Read only')}
                        </Button>
                    )}
                </footer>
            </section>
        </div>
    );
}

function PermissionButtonGroup({
    disabled,
    level,
    onChange,
}: {
    disabled: boolean;
    level: PermissionLevel;
    onChange: (level: PermissionLevel) => void;
}) {
    const t = usePlatformTranslation();
    const options: { label: string; value: PermissionLevel }[] = [
        { label: t('settings.access.permissions.no', 'No'), value: 'none' },
        { label: t('settings.access.permissions.ro', 'RO'), value: 'ro' },
        { label: t('settings.access.permissions.ru', 'RU'), value: 'ru' },
        { label: t('settings.access.permissions.rud', 'RUD'), value: 'rud' },
    ];

    return (
        <div className="inline-grid grid-cols-4 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] p-1 text-xs font-medium">
            {options.map((option) => (
                <button
                    className={cn(
                        'rounded-md px-3 py-2 transition',
                        level === option.value
                            ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                            : 'text-[var(--settings-muted-text)] hover:text-[var(--settings-accent)]',
                    )}
                    disabled={disabled}
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    type="button"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function PermissionScopeSelect({
    disabled,
    onChange,
    scope,
}: {
    disabled: boolean;
    onChange: (scope: PermissionScope) => void;
    scope: PermissionScope;
}) {
    const options: { label: string; value: PermissionScope }[] = [
        { label: 'None', value: 'none' },
        { label: 'Own', value: 'own' },
        { label: 'Assigned', value: 'assigned' },
        { label: 'Group', value: 'group' },
        { label: 'All', value: 'all' },
    ];

    return (
        <select
            className="h-9 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-3 text-sm"
            disabled={disabled}
            onChange={(event) =>
                onChange(event.currentTarget.value as PermissionScope)
            }
            value={scope}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function groupPermissionResources(resources: PermissionResource[]): {
    name: string;
    resources: PermissionResource[];
}[] {
    const groups = new Map<string, PermissionResource[]>();

    resources.forEach((resource) => {
        const group = resource.group || 'Other';
        groups.set(group, [...(groups.get(group) ?? []), resource]);
    });

    return Array.from(groups.entries()).map(([name, groupedResources]) => ({
        name,
        resources: groupedResources,
    }));
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                {label}
            </dt>
            <dd className="min-w-0 break-words text-slate-800 dark:text-slate-100">
                {value}
            </dd>
        </div>
    );
}

function RoleBadges({
    roleOptions,
    roles,
}: {
    roleOptions: AccessRoleSummary[];
    roles: UserRole[];
}) {
    return (
        <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
                <Badge
                    key={role}
                    variant={role === 'admin' ? 'default' : 'outline'}
                >
                    {roleLabel(role, roleOptions)}
                </Badge>
            ))}
        </div>
    );
}

function roleLabel(role: UserRole, roleOptions: AccessRoleSummary[]): string {
    return (
        roleOptions.find((option) => option.slug === role)?.name ??
        role
            .split('-')
            .filter(Boolean)
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(' ')
    );
}

function roleListLabel(
    roles: UserRole[],
    roleOptions: AccessRoleSummary[],
): string {
    return roles.map((role) => roleLabel(role, roleOptions)).join(', ');
}

function firstAddableRole(
    assignableRoles: UserRole[],
    currentRoles: UserRole[],
): UserRole | null {
    return assignableRoles.find((role) => !currentRoles.includes(role)) ?? null;
}

function normalizedAccessForm(form: AccessFormState): AccessFormState {
    return {
        ...form,
        roles: [...form.roles].sort((left, right) => left.localeCompare(right)),
    };
}

function roleFormFromRole(
    role: AccessRoleSummary | null,
    resources: PermissionResource[],
): RoleFormState {
    const emptyPermissions = Object.fromEntries(
        resources.map((resource) => [resource.key, 'none']),
    ) as Record<string, PermissionLevel>;
    const emptyPermissionScopes = Object.fromEntries(
        resources.map((resource) => [resource.key, 'all']),
    ) as Record<string, PermissionScope>;

    if (!role) {
        return {
            description: '',
            level: '10',
            name: '',
            permissionScopes: emptyPermissionScopes,
            permissions: emptyPermissions,
            slug: '',
        };
    }

    return {
        description: role.description ?? '',
        level: role.level.toString(),
        name: role.name,
        permissionScopes: {
            ...emptyPermissionScopes,
            ...role.permissionScopes,
        },
        permissions: {
            ...emptyPermissions,
            ...role.permissions,
        },
        slug: role.slug,
    };
}

function StatusBadges({ user }: { user: AdminUser }) {
    const t = usePlatformTranslation();

    if (!user.is_login_disabled && !user.is_currently_banned) {
        return (
            <Badge variant="secondary">
                {t('settings.access.status.active', 'Active')}
            </Badge>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {user.is_login_disabled ? (
                <Badge variant="destructive">
                    {t('settings.access.status.disabled', 'Disabled')}
                </Badge>
            ) : null}
            {user.is_currently_banned ? (
                <Badge variant="destructive">
                    {t('settings.access.status.banned', 'Banned')}
                </Badge>
            ) : null}
        </div>
    );
}

function formatDate(value: string | null, t?: SettingsTranslator): string {
    if (!value) {
        return t?.('common.not_set', 'Not set') ?? 'Not set';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatUserReference(
    user: UserReference | null,
    t?: SettingsTranslator,
): string {
    if (!user) {
        return t?.('common.unknown', 'Unknown') ?? 'Unknown';
    }

    return `${user.name} (${user.email})`;
}

function toDateTimeLocal(value: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    const offsetDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
    );

    return offsetDate.toISOString().slice(0, 16);
}
