import { router } from '@inertiajs/react';
import {
    GitBranch,
    Map as MapIcon,
    Network,
    SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    SettingsLevelBanner,
    SettingsSectionButton,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import { WorldMapManagementPanel } from '@/features/settings/world-map-management-panel';
import { WorldBuilderPanel, type WorldGraph } from '@/pages/settings/worlds';

export type WorldBuilderSection = 'graph' | 'structural';
export type WorldBuilderMapView = 'configure' | 'nodes';

type Props = {
    activeSection: WorldBuilderSection;
    canViewGraph: boolean;
    canViewStructural: boolean;
    onSelectSection: (section: WorldBuilderSection) => void;
    selectedMapDetail?: WorldBuilderMapDetail | null;
    worldGraph: WorldGraph | null;
};

type WorldBuilderMapDetail = {
    activeView: WorldBuilderMapView;
    content: ReactNode;
    mapId: number;
    mapTitle: string;
    nodeId?: number;
    nodeTitle?: string;
};

const sections = [
    {
        description: 'See maps and portal routes as a connected graph.',
        icon: GitBranch,
        key: 'graph',
        label: 'Graph',
    },
    {
        description: 'Choose maps and open map or node configuration.',
        icon: Network,
        key: 'structural',
        label: 'Structural',
    },
] satisfies SettingsNavigationItem<WorldBuilderSection>[];

const mapViewSections = [
    {
        description: 'Edit tiles, node placement and node activities.',
        icon: GitBranch,
        key: 'nodes',
        label: 'Configure nodes',
    },
    {
        description: 'Edit map details, visuals and access.',
        icon: SlidersHorizontal,
        key: 'configure',
        label: 'Configure map',
    },
] satisfies {
    description: string;
    icon: LucideIcon;
    key: WorldBuilderMapView;
    label: string;
}[];

export function WorldBuilderSettingsPanel({
    activeSection,
    canViewGraph,
    canViewStructural,
    onSelectSection,
    selectedMapDetail = null,
    worldGraph,
}: Props) {
    const visibleSections = sections.filter((section) =>
        section.key === 'structural' ? canViewStructural : canViewGraph,
    );
    const resolvedSection = visibleSections.some(
        (section) => section.key === activeSection,
    )
        ? activeSection
        : visibleSections[0]?.key;
    const activeSectionMeta = sections.find(
        (section) => section.key === resolvedSection,
    );

    if (!resolvedSection) {
        return <UnavailableWorldBuilder />;
    }

    return (
        <div className="grid h-full min-h-0 gap-0 overflow-hidden lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                <nav className="grid gap-2">
                    {visibleSections.map((section) => (
                        <SettingsSectionButton
                            active={resolvedSection === section.key}
                            description={section.description}
                            icon={section.icon}
                            id={section.key}
                            key={section.key}
                            label={section.label}
                            onSelect={onSelectSection}
                        />
                    ))}
                </nav>
            </aside>

            <div className="min-h-0 overflow-hidden bg-[var(--settings-panel-background)]">
                {selectedMapDetail && resolvedSection === 'graph' ? (
                    <WorldBuilderMapWorkspace
                        activeSection={resolvedSection}
                        detail={selectedMapDetail}
                    />
                ) : null}

                {(!selectedMapDetail || resolvedSection !== 'graph') &&
                resolvedSection === 'graph' &&
                worldGraph &&
                activeSectionMeta ? (
                    <WorldBuilderSectionWorkspace section={activeSectionMeta}>
                        <WorldBuilderPanel worldGraph={worldGraph} />
                    </WorldBuilderSectionWorkspace>
                ) : null}

                {resolvedSection === 'structural' &&
                worldGraph &&
                activeSectionMeta ? (
                    <WorldBuilderSectionWorkspace section={activeSectionMeta}>
                        <WorldMapManagementPanel
                            detail={selectedMapDetail}
                            maps={worldGraph.maps}
                        />
                    </WorldBuilderSectionWorkspace>
                ) : null}

                {(!selectedMapDetail || resolvedSection !== 'graph') &&
                !worldGraph ? (
                    <UnavailableWorldBuilder />
                ) : null}
            </div>
        </div>
    );
}

function WorldBuilderSectionWorkspace({
    children,
    section,
}: {
    children: ReactNode;
    section: (typeof sections)[number];
}) {
    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden">
            <SettingsLevelBanner item={section} />

            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </section>
    );
}

function WorldBuilderMapWorkspace({
    activeSection,
    detail,
}: {
    activeSection: WorldBuilderSection;
    detail: WorldBuilderMapDetail;
}) {
    const selectMapView = (view: WorldBuilderMapView) => {
        router.visit(
            `/settings?panel=admin-world-builder&worldSection=${activeSection}&map=${detail.mapId}&worldView=${view}`,
        );
    };

    return (
        <section className="grid h-full min-h-0 gap-0 overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0">
                <div className="mb-3 flex items-center gap-2 px-3 py-2 text-[var(--settings-accent)]">
                    <MapIcon className="size-4" />
                    <p className="truncate text-xs font-medium tracking-[0.18em] uppercase">
                        {detail.mapTitle}
                    </p>
                </div>
                <nav className="grid gap-2">
                    {mapViewSections.map((section) => (
                        <SettingsSectionButton
                            active={detail.activeView === section.key}
                            description={section.description}
                            icon={section.icon}
                            id={section.key}
                            key={section.key}
                            label={section.label}
                            onSelect={selectMapView}
                        />
                    ))}
                </nav>
            </aside>

            <div className="min-h-0 overflow-hidden bg-[var(--settings-panel-background)]">
                {detail.content}
            </div>
        </section>
    );
}

function UnavailableWorldBuilder() {
    return (
        <section className="grid h-full place-items-center p-6 text-center">
            <p className="max-w-lg text-sm leading-6 text-[var(--settings-muted-text)]">
                World builder settings are not available with the current
                permissions.
            </p>
        </section>
    );
}
