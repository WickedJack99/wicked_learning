import { Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    GitBranch,
    Map as MapIcon,
    Network,
    Sparkles,
    SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
    SettingsNestedWorkspace,
    SettingsSectionButton,
    SettingsSectionNavigation,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { WorldMapManagementPanel } from '@/features/settings/world-map-management-panel';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { WorldBuilderPanel } from '@/pages/settings/worlds';
import type {
    ReviewActivitySummary,
    WorldGraph,
} from '@/pages/settings/worlds';

export type WorldBuilderSection = 'graph' | 'review' | 'structural';
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
        description: 'Open activities waiting for an authoring review.',
        icon: Sparkles,
        key: 'review',
        label: 'Review queue',
    },
    {
        description: 'Choose maps and open map or MapAsset configuration.',
        icon: Network,
        key: 'structural',
        label: 'Structural',
    },
] satisfies SettingsNavigationItem<WorldBuilderSection>[];

const mapViewSections = [
    {
        description: 'Edit MapAssets, placement and connected activities.',
        icon: GitBranch,
        key: 'nodes',
        label: 'Configure MapAssets',
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

    if (!resolvedSection) {
        return <UnavailableWorldBuilder />;
    }

    return (
        <SettingsNestedWorkspace
            contentClassName="p-0 sm:p-0"
            sidebar={
                <SettingsSectionNavigation
                    activeSection={resolvedSection}
                    ariaLabel="World builder sections"
                    items={visibleSections}
                    onChange={onSelectSection}
                />
            }
        >
            <div className="h-full min-h-0 overflow-hidden bg-[var(--settings-content-background)]">
                {selectedMapDetail && resolvedSection === 'graph' ? (
                    <WorldBuilderMapWorkspace
                        activeSection={resolvedSection}
                        detail={selectedMapDetail}
                    />
                ) : null}

                {(!selectedMapDetail || resolvedSection !== 'graph') &&
                resolvedSection === 'graph' &&
                worldGraph ? (
                    <WorldBuilderSectionWorkspace>
                        <WorldBuilderPanel worldGraph={worldGraph} />
                    </WorldBuilderSectionWorkspace>
                ) : null}

                {(!selectedMapDetail || resolvedSection !== 'graph') &&
                resolvedSection === 'review' &&
                worldGraph ? (
                    <WorldBuilderSectionWorkspace>
                        <WorldBuilderReviewQueue worldGraph={worldGraph} />
                    </WorldBuilderSectionWorkspace>
                ) : null}

                {resolvedSection === 'structural' && worldGraph ? (
                    <WorldBuilderSectionWorkspace>
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
        </SettingsNestedWorkspace>
    );
}

function WorldBuilderReviewQueue({ worldGraph }: { worldGraph: WorldGraph }) {
    const t = usePlatformTranslation();
    const reviewItems = worldGraph.maps.flatMap((map) =>
        map.nodes.flatMap((node) =>
            node.pendingReviewActivities.map(
                (activity: ReviewActivitySummary) => ({
                    activity,
                    map,
                    node,
                }),
            ),
        ),
    );
    const [page, setPage] = useState(0);
    const pageSize = 6;
    const pageCount = Math.max(1, Math.ceil(reviewItems.length / pageSize));
    const currentPage = Math.min(page, pageCount - 1);
    const visibleItems = reviewItems.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize,
    );

    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6">
            <header className="shrink-0 border-b border-[var(--settings-border-color)] pb-4">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    {t(
                        'settings.world_builder.review_queue.eyebrow',
                        'Authoring',
                    )}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                    {t(
                        'settings.world_builder.review_queue.title',
                        'Review queue',
                    )}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {reviewItems.length > 0
                        ? t(
                              reviewItems.length === 1
                                  ? 'settings.world_builder.review_queue.waiting_one'
                                  : 'settings.world_builder.review_queue.waiting_many',
                              reviewItems.length === 1
                                  ? '1 activity is waiting for review.'
                                  : ':count activities are waiting for review.',
                              { count: reviewItems.length },
                          )
                        : t(
                              'settings.world_builder.review_queue.empty',
                              'Everything in this world is up to date.',
                          )}
                </p>
            </header>

            {reviewItems.length === 0 ? (
                <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
                    <p className="max-w-md text-sm leading-6 text-[var(--settings-muted-text)]">
                        {t(
                            'settings.world_builder.review_queue.empty_detail',
                            'New or changed activities will appear here after an author saves them.',
                        )}
                    </p>
                </div>
            ) : (
                <>
                    <div className="min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto py-4 pr-2">
                        <div className="grid gap-3">
                            {visibleItems.map(({ activity, map, node }) => (
                                <Link
                                    aria-label={`Review ${activity.title}`}
                                    className="group rounded-lg border border-[var(--settings-border-color)] p-4 transition hover:border-[var(--settings-accent)]"
                                    href={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&node=${node.id}&worldView=nodes&reviewActivity=${activity.id}`}
                                    key={activity.id}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                                                {map.title}
                                            </p>
                                            <h3 className="mt-1 truncate font-semibold">
                                                {activity.title}
                                            </h3>
                                            <p className="mt-1 text-sm text-[var(--settings-muted-text)]">
                                                {node.title} · {activity.type}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-sm font-semibold text-[var(--settings-accent)] group-hover:underline">
                                            {t(
                                                'settings.world_builder.review_queue.open',
                                                'Open',
                                            )}{' '}
                                            <span aria-hidden="true">→</span>
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <footer className="flex shrink-0 items-center justify-between border-t border-[var(--settings-border-color)] pt-3">
                        <Button
                            disabled={currentPage === 0}
                            onClick={() => setPage((value) => value - 1)}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            <ArrowLeft className="size-4" />
                            {t(
                                'settings.world_builder.review_queue.previous',
                                'Previous',
                            )}
                        </Button>
                        <span className="text-xs text-[var(--settings-muted-text)]">
                            {t(
                                'settings.world_builder.review_queue.page',
                                'Page :current of :total',
                                {
                                    current: currentPage + 1,
                                    total: pageCount,
                                },
                            )}
                        </span>
                        <Button
                            disabled={currentPage >= pageCount - 1}
                            onClick={() => setPage((value) => value + 1)}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            {t(
                                'settings.world_builder.review_queue.next',
                                'Next',
                            )}
                            <ArrowRight className="size-4" />
                        </Button>
                    </footer>
                </>
            )}
        </section>
    );
}

function WorldBuilderSectionWorkspace({ children }: { children: ReactNode }) {
    return (
        <section className="h-full min-h-0 overflow-hidden">{children}</section>
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

            <div className="min-h-0 overflow-hidden bg-[var(--settings-content-background)]">
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
