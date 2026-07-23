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
import {
    SettingsConfigurationLayout,
    SettingsContentPane,
    SettingsPanelHeader,
} from '@/components/settings-configuration-shell';
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
import { AccessGroupManagementPanel } from '@/features/settings/access-group-management-panel';
import type {
    AccessGroupUser,
    AccessLearningGroup,
} from '@/features/settings/access-group-management-panel';
import {
    AssetsWorldObjectsPanel,
    type AssetsWorldObjectsSection,
    type AssetsWorldObjectsSettings,
} from '@/features/settings/assets-world-objects-panel';
import { AccessManagementNavigation } from '@/features/settings/access-management-navigation';
import type { AccessManagementSection } from '@/features/settings/access-management-navigation';
import {
    PresentationLocalizationPanel,
    type PresentationLocalizationSection,
} from '@/features/settings/presentation-localization-panel';
import {
    LearningSupportPanel,
    type LearningSupportSection,
    type LearningSupportSettings,
} from '@/features/settings/learning-support-panel';
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
import {
    readAccessSectionFromUrl,
    writeAccessSectionToUrl,
} from '@/features/settings/settings-access-navigation-state';
import {
    canOpenPanel,
    findSettingsItemForPanel,
    isActiveSettingsItem,
    isSettingsPanelKey,
    panelContent,
    settingsSections,
    type AccessCapability,
    type SettingsListItem,
    type SettingsPanelKey,
    type SettingsTranslator,
} from '@/features/settings/settings-navigation';
import {
    SettingsOverview,
    SettingsPlaceholderPanel,
    SettingsRouteGroupPanel,
} from '@/features/settings/settings-panel-directory';
import {
    SettingsSidebarNavigation,
    SettingsTopBar,
    type SettingsNotificationSummary,
    type SettingsWorldBreadcrumb,
} from '@/features/settings/settings-workspace-shell';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import AiSettings, {
    type AiSection,
    type AiSettingsProps,
} from '@/pages/settings/ai';
import {
    PersonalSettingsContent,
    type PersonalSettingsProps,
} from '@/pages/settings/personal';
import type { ColorPaletteProps } from '@/pages/settings/color-palette';
import type { Language } from '@/pages/settings/languages';
import { WorldBuilderPanel, type WorldGraph } from '@/pages/settings/worlds';
import ConfigureMap from '@/pages/settings/worlds/configure-map';
import EditWorldMap, {
    type AccessGroup as WorldMapAccessGroup,
    type EditableMapPayload,
} from '@/pages/settings/worlds/edit-map';
import EditNodeActivities from '@/pages/settings/worlds/edit-node-activities';
import type {
    ActivityGraphPayload,
    EditableItem,
    EditableSound,
    EditableTool,
} from '@/pages/settings/worlds/edit-node-activity-types';
import type { PublicPresentationSettings } from '@/theme/presentation';
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
type PresentationView = PresentationLocalizationSection;
type AssetView = AssetsWorldObjectsSection;
type LearningSupportView = LearningSupportSection;
type AiView = AiSection;

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

    const panel = new URL(window.location.href).searchParams.get('panel');

    if (
        !isSettingsPanelKey(panel) ||
        !canOpenPanel(panel, canAccessAdministration)
    ) {
        return null;
    }

    return panel;
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
    }

    if (panel !== 'admin-presentation-localization') {
        url.searchParams.delete('presentation');
    }

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

    window.history.pushState({ panel }, '', url);
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

    return value === 'sounds' || value === 'tools' || value === 'items'
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
        return 'admin-panel';
    }

    return new URL(window.location.href).searchParams.get('support') ===
        'journal'
        ? 'journal'
        : 'admin-panel';
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

function readPresentationViewFromUrl(): PresentationView {
    if (typeof window === 'undefined') {
        return 'public';
    }

    const value = new URL(window.location.href).searchParams.get(
        'presentation',
    );

    return value === 'palette' || value === 'languages' ? value : 'public';
}

function writePresentationViewToUrl(section: PresentationView): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-presentation-localization');
    url.searchParams.set('presentation', section);
    window.history.pushState(
        { panel: 'admin-presentation-localization' },
        '',
        url,
    );
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
    const { props, url: pageUrl } = usePage();
    const currentUser = props.auth.user as AuthUser | null;
    const [menuQuery, setMenuQuery] = useState('');
    const [selectedPanel, setSelectedPanel] = useState<SettingsPanelKey | null>(
        () => readPanelFromUrl(canAccessAdministration) ?? 'personal',
    );
    const [worldBuilderView, setWorldBuilderView] = useState<WorldBuilderView>(
        () => readWorldBuilderViewFromUrl(),
    );
    const [presentationView, setPresentationView] = useState<PresentationView>(
        () => readPresentationViewFromUrl(),
    );
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
            setWorldBuilderView(readWorldBuilderViewFromUrl());
            setPresentationView(readPresentationViewFromUrl());
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
            map:
                selectedWorldMap?.editableMap.map ??
                selectedWorldNode?.activityGraph.map ??
                null,
            node: selectedWorldNode?.activityGraph.node ?? null,
            view:
                selectedWorldMap || selectedWorldNode ? worldBuilderView : null,
        }),
        [selectedWorldMap, selectedWorldNode, worldBuilderView],
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
            <main className="settings-surface h-full min-h-0 overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden lg:flex-row">
                    <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white/90 lg:w-72 lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-[#111820]/95">
                        <div className="shrink-0 px-5 pt-5 pb-4">
                            <p
                                className="text-xs font-medium tracking-[0.18em] uppercase"
                                style={{ color: 'var(--settings-accent)' }}
                            >
                                {t('settings.eyebrow', 'Platform')}
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                                {t('settings.title', 'Settings')}
                            </h1>
                        </div>

                        <SettingsSidebarNavigation
                            activePanel={selectedPanel}
                            onOpenItem={openItem}
                            sections={sections}
                        />
                    </aside>

                    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <SettingsTopBar
                            activeItem={activeItem}
                            currentUser={currentUser}
                            menuQuery={menuQuery}
                            notifications={settingsNotifications}
                            onSearchChange={setMenuQuery}
                            worldBreadcrumb={worldBreadcrumb}
                        />

                        <div className="min-h-0 flex-1 overflow-hidden p-4">
                            <section className="h-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                                {selectedPanel ? (
                                    <SettingsDetail
                                        accessCapabilities={accessCapabilities}
                                        accessGroupUsers={accessGroupUsers}
                                        accessGroups={accessGroups}
                                        adminRoles={adminRoles}
                                        adminUsers={adminUsers}
                                        aiSettings={aiSettings}
                                        assetsWorldObjects={assetsWorldObjects}
                                        colorPaletteSettings={
                                            colorPaletteSettings
                                        }
                                        createdRegistrationToken={
                                            createdRegistrationToken
                                        }
                                        languages={languages}
                                        learningSupportSettings={
                                            learningSupportSettings
                                        }
                                        permissionResources={
                                            permissionResources
                                        }
                                        personalSettings={personalSettings}
                                        platformInfoPages={platformInfoPages}
                                        presentationView={presentationView}
                                        publicPresentation={publicPresentation}
                                        assignableRegistrationRoles={
                                            assignableRegistrationRoles
                                        }
                                        registrationTokens={registrationTokens}
                                        selectedWorldMap={selectedWorldMap}
                                        selectedWorldNode={selectedWorldNode}
                                        assetView={assetView}
                                        aiView={aiView}
                                        learningSupportView={
                                            learningSupportView
                                        }
                                        setAssetView={setAssetView}
                                        setAiView={setAiView}
                                        setLearningSupportView={
                                            setLearningSupportView
                                        }
                                        setPresentationView={
                                            setPresentationView
                                        }
                                        selectedPanel={selectedPanel}
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
                            </section>
                        </div>
                    </section>
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
    platformInfoPages,
    presentationView,
    registrationTokens,
    publicPresentation,
    selectedWorldMap,
    selectedWorldNode,
    selectedPanel,
    setAiView,
    setAssetView,
    setLearningSupportView,
    setPresentationView,
    worldBuilderView,
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
    platformInfoPages: Partial<
        Record<PlatformInfoPageKey, PlatformInfoContent>
    >;
    presentationView: PresentationView;
    registrationTokens: RegistrationTokenSummary[];
    publicPresentation: PublicPresentationSettings | null;
    selectedWorldMap: SelectedWorldMap | null;
    selectedWorldNode: SelectedWorldNode | null;
    selectedPanel: SettingsPanelKey;
    setAiView: (view: AiView) => void;
    setAssetView: (view: AssetView) => void;
    setLearningSupportView: (view: LearningSupportView) => void;
    setPresentationView: (view: PresentationView) => void;
    worldBuilderView: WorldBuilderView;
    worldGraph: WorldGraph | null;
}) {
    const content = panelContent[selectedPanel];
    const selectedItem = findSettingsItemForPanel(selectedPanel);

    return (
        <div className="h-full overflow-hidden bg-white dark:bg-[#111820]">
            {selectedPanel === 'personal' ? (
                <PersonalSettingsContent {...personalSettings} />
            ) : selectedPanel === 'admin-ai-integrations' && aiSettings ? (
                <div className="h-full min-h-0 p-4">
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
            ) : selectedPanel === 'admin-learning-support' ? (
                <LearningSupportPanel
                    activeSection={learningSupportView}
                    canViewAdminPanel={
                        (accessCapabilities.journal_feedback?.read ?? false) ||
                        (accessCapabilities.competence_topics?.read ?? false) ||
                        (accessCapabilities.organization_moderation?.read ??
                            false) ||
                        (accessCapabilities.world_maps?.read ?? false)
                    }
                    canViewJournal={
                        accessCapabilities.journal_settings?.read ?? false
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
                    canViewSounds={accessCapabilities.sounds?.read ?? false}
                    onSelectSection={(section) => {
                        setAssetView(section);
                        writeAssetViewToUrl(section);
                    }}
                />
            ) : selectedPanel === 'admin-presentation-localization' ? (
                <PresentationLocalizationPanel
                    activeSection={presentationView}
                    colorPaletteSettings={colorPaletteSettings}
                    languages={languages}
                    onSelectSection={(section) => {
                        setPresentationView(section);
                        writePresentationViewToUrl(section);
                    }}
                    platformInfoPages={platformInfoPages}
                    publicPresentation={publicPresentation}
                />
            ) : selectedPanel === 'admin-world-builder' && selectedWorldNode ? (
                <EditNodeActivities
                    activityGraph={selectedWorldNode.activityGraph}
                    items={selectedWorldNode.items}
                    sounds={selectedWorldNode.sounds}
                    tools={selectedWorldNode.tools}
                />
            ) : selectedPanel === 'admin-world-builder' &&
              selectedWorldMap &&
              worldBuilderView === 'configure' ? (
                <ConfigureMap
                    accessGroups={selectedWorldMap.accessGroups}
                    canDeleteWorldMaps={selectedWorldMap.canDeleteWorldMaps}
                    editableMap={selectedWorldMap.editableMap}
                    embedded
                    learningGroups={selectedWorldMap.learningGroups}
                />
            ) : selectedPanel === 'admin-world-builder' && selectedWorldMap ? (
                <EditWorldMap
                    accessGroups={selectedWorldMap.accessGroups}
                    editableMap={selectedWorldMap.editableMap}
                    tools={selectedWorldMap.tools}
                />
            ) : selectedPanel === 'admin-world-builder' && worldGraph ? (
                <div className="h-full min-h-0 p-4">
                    <WorldBuilderPanel worldGraph={worldGraph} />
                </div>
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
            <p className="max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
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

    return (
        <SettingsConfigurationLayout
            className="h-full"
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
            <SettingsContentPane>
                <div className="grid gap-5">
                    <SettingsPanelHeader
                        description={t(
                            'settings.access.description',
                            'Configure who can read, update or delete administration areas. Default roles stay available.',
                        )}
                        eyebrow={t(
                            'settings.access.title',
                            'Access management',
                        )}
                        icon={Shield}
                        title={t('settings.access.title', 'Access management')}
                    />

                    {section === 'users' && accessCapabilities.users?.read ? (
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
            </SettingsContentPane>
        </SettingsConfigurationLayout>
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

        if (!form) {
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
        <div>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
                <div>
                    <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                        <Users className="size-5" />
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            {t('settings.access.users.title', 'Users')}
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
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

            {createdRegistrationToken ? (
                <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] p-4 text-slate-950 dark:text-slate-50">
                    <p className="text-sm font-medium">
                        {t(
                            'settings.access.tokens.new',
                            'New registration token',
                        )}
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950/70">
                            {createdRegistrationToken}
                        </code>
                        <Button onClick={copyCreatedToken} variant="secondary">
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

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_150px_minmax(0,1fr)_180px] gap-3 bg-slate-100 px-4 py-3 text-xs font-medium tracking-[0.14em] text-slate-500 uppercase lg:grid dark:bg-white/5 dark:text-slate-400">
                    <span>{t('settings.access.users.table.user', 'User')}</span>
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
                        {t('settings.access.users.table.actions', 'Actions')}
                    </span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                    {users.map((user) => {
                        const form = forms[user.id];
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
                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                        {user.email}
                                    </span>
                                </button>

                                <RoleEditor
                                    assignableRoles={
                                        assignableRegistrationRoles
                                    }
                                    disabled={isCurrentUser || !canUpdateUsers}
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
                                                    event.currentTarget.value,
                                            })
                                        }
                                        type="datetime-local"
                                        value={form?.bannedUntil ?? ''}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        disabled={
                                            isCurrentUser || !canUpdateUsers
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

            <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-white/10">
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
                            className="flex flex-col gap-2 rounded-md bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-white/5"
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
                                <span className="ml-2 text-slate-500 dark:text-slate-400">
                                    {t(
                                        'settings.access.tokens.created_by',
                                        'created by :name',
                                        {
                                            name:
                                                token.created_by?.name ??
                                                t('common.unknown', 'Unknown'),
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
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatDate(token.created_at, t)}
                                </span>
                            </div>
                        </div>
                    ))}
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-2xl font-semibold text-slate-950 dark:text-white">
                {value}
            </p>
            <p className="mt-1 text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
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
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
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
                                className="rounded text-slate-500 transition hover:text-red-600 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:text-slate-400 dark:hover:text-red-300"
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
                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-3 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
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
                                className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100"
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
        <div className="inline-grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-medium dark:border-white/10 dark:bg-slate-950/70">
            <button
                className={cn(
                    'rounded-md px-2 py-1.5 transition',
                    !isDisabled
                        ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                        : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
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
                        : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
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

                <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
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
                        <p className="text-slate-500 dark:text-slate-400">
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
        <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-white/10">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                            {t('settings.access.roles.title', 'Roles')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
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
                                    ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] text-slate-950 dark:text-slate-50'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] dark:border-white/10 dark:bg-white/5 dark:text-slate-100',
                            )}
                            key={role.id}
                            onClick={() => selectRole(role)}
                            type="button"
                        >
                            <span className="block text-sm font-medium">
                                {role.name}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                {role.slug}
                            </span>
                        </button>
                    ))}
                </div>
            </aside>

            <section className="min-h-0 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                    <div className="flex gap-2">
                        {canUpdateRoles ? (
                            <Button onClick={saveRole}>
                                {selectedRole
                                    ? t('common.save', 'Save')
                                    : t('common.create', 'Create')}
                            </Button>
                        ) : (
                            <Button disabled variant="secondary">
                                {t('common.read_only', 'Read only')}
                            </Button>
                        )}
                        {selectedRole && canDeleteRoles ? (
                            <Button
                                disabled={selectedRole.is_system}
                                onClick={deleteRole}
                                variant="destructive"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>

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
                            disabled={!canUpdateRoles || Boolean(selectedRole)}
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

                <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="grid grid-cols-[minmax(12rem,1fr)_18rem_14rem] bg-slate-100 px-4 py-3 text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:bg-white/5 dark:text-slate-400">
                        <span>{t('settings.access.roles.area', 'Area')}</span>
                        <span>
                            {t(
                                'settings.access.roles.permission_level',
                                'Permission level',
                            )}
                        </span>
                        <span>{t('settings.access.roles.scope', 'Scope')}</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {groupedResources.map((group) => (
                            <div key={group.name}>
                                <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                                    {group.name}
                                </div>
                                {group.resources.map((resource) => (
                                    <div
                                        className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-[minmax(12rem,1fr)_18rem_14rem] sm:items-center dark:border-white/10"
                                        key={resource.key}
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-slate-950 dark:text-white">
                                                {resource.label}
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
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

                <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
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
        <div className="inline-grid grid-cols-4 rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-medium dark:border-white/10 dark:bg-slate-950/70">
            {options.map((option) => (
                <button
                    className={cn(
                        'rounded-md px-3 py-2 transition',
                        level === option.value
                            ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                            : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
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
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950"
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
            <dt className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
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
