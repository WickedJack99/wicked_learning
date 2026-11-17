import { Link, router } from '@inertiajs/react';
import {
    GitBranch,
    Map as MapIcon,
    Network,
    Sparkles,
    SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import {
    SettingsNestedWorkspace,
    SettingsSectionButton,
    SettingsSectionNavigation,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { WorldMapManagementPanel } from '@/features/settings/world-map-management-panel';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { readJsonResponse } from '@/lib/json-response';
import { WorldBuilderPanel } from '@/pages/settings/worlds';
import type { WorldGraph } from '@/pages/settings/worlds';

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
                resolvedSection === 'review' ? (
                    <WorldBuilderSectionWorkspace>
                        <WorldBuilderReviewQueue />
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
                resolvedSection !== 'review' &&
                !worldGraph ? (
                    <UnavailableWorldBuilder />
                ) : null}
            </div>
        </SettingsNestedWorkspace>
    );
}

type ReviewQueueItem = {
    activity: {
        id: number;
        title: string;
        type: string;
    };
    map: {
        id: number;
        title: string;
    };
    node: {
        id: number;
        title: string;
    };
};

type ReviewQueueResponse = {
    errors?: Record<string, string[]>;
    items: ReviewQueueItem[];
    message?: string;
    pagination: {
        lastPage: number;
        page: number;
        perPage: number;
        total: number;
    };
};

function WorldBuilderReviewQueue() {
    const t = usePlatformTranslation();
    const [page, setPage] = useState(1);
    const [reviewItems, setReviewItems] = useState<ReviewQueueItem[]>([]);
    const [pageCount, setPageCount] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requestVersion, setRequestVersion] = useState(0);
    const pageSize = 4;

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({
            page: String(page),
            per_page: String(pageSize),
        });

        void fetch('/settings/worlds/review-queue?' + params.toString(), {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal: controller.signal,
        })
            .then((response) =>
                readJsonResponse<ReviewQueueResponse>(
                    response,
                    'The review queue could not be loaded.',
                ),
            )
            .then((payload) => {
                setReviewItems(payload.items);
                setPageCount(Math.max(1, payload.pagination.lastPage));
                setTotal(payload.pagination.total);
                setPage((currentPage) =>
                    Math.min(
                        currentPage,
                        Math.max(1, payload.pagination.lastPage),
                    ),
                );
            })
            .catch((requestError: unknown) => {
                if (
                    requestError instanceof DOMException &&
                    requestError.name === 'AbortError'
                ) {
                    return;
                }

                setReviewItems([]);
                setTotal(0);
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'The review queue could not be loaded.',
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            });

        return () => controller.abort();
    }, [page, requestVersion]);

    const currentPage = Math.min(page, pageCount);

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
                    {total > 0
                        ? t(
                              total === 1
                                  ? 'settings.world_builder.review_queue.waiting_one'
                                  : 'settings.world_builder.review_queue.waiting_many',
                              total === 1
                                  ? '1 activity is waiting for review.'
                                  : ':count activities are waiting for review.',
                              { count: total },
                          )
                        : t(
                              'settings.world_builder.review_queue.empty',
                              'Everything in this world is up to date.',
                          )}
                </p>
            </header>

            {isLoading ? (
                <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
                    <p className="text-sm text-[var(--settings-muted-text)]">
                        Loading review queue…
                    </p>
                </div>
            ) : error ? (
                <div className="grid min-h-0 flex-1 place-items-center gap-3 p-6 text-center">
                    <p className="max-w-md text-sm leading-6 text-red-400">
                        {error}
                    </p>
                    <button
                        className="text-sm font-semibold text-[var(--settings-accent)] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                        onClick={() => {
                            setIsLoading(true);
                            setRequestVersion((version) => version + 1);
                        }}
                        type="button"
                    >
                        Try again
                    </button>
                </div>
            ) : total === 0 ? (
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
                    <div className="min-h-0 flex-1 overflow-hidden py-4 pr-1">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {reviewItems.map(({ activity, map, node }) => (
                                <Link
                                    aria-label={`Review ${activity.title}`}
                                    className="group min-w-0 rounded-lg border border-[var(--settings-border-color)] p-3 transition hover:border-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--settings-content-background)] focus-visible:outline-none"
                                    href={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&node=${node.id}&worldView=nodes&reviewActivity=${activity.id}`}
                                    key={activity.id}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                                                {map.title}
                                            </p>
                                            <h3 className="mt-1 truncate text-sm font-semibold">
                                                {activity.title}
                                            </h3>
                                            <p className="mt-1 truncate text-xs text-[var(--settings-muted-text)]">
                                                {node.title} · {activity.type}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-xs font-semibold text-[var(--settings-accent)] group-hover:underline">
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

                    <footer className="shrink-0 border-t border-[var(--settings-border-color)] pt-3">
                        <PaginationControls
                            buttonClassName="text-sm text-[var(--settings-accent)] transition hover:text-[var(--settings-accent-foreground)]"
                            currentPage={currentPage}
                            label={t(
                                'settings.world_builder.review_queue.pagination',
                                'Review queue pagination',
                            )}
                            nextLabel={t(
                                'settings.world_builder.review_queue.next',
                                'Next',
                            )}
                            onPageChange={(nextPage) => {
                                setIsLoading(true);
                                setError(null);
                                setPage(nextPage);
                            }}
                            pageCount={pageCount}
                            previousLabel={t(
                                'settings.world_builder.review_queue.previous',
                                'Previous',
                            )}
                            textClassName="text-xs text-[var(--settings-muted-text)]"
                        />
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
