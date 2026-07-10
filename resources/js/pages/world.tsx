import { Head, router, usePage } from '@inertiajs/react';
import { Map as MapIcon, MapPin, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    selectLearningTool,
    useSelectedLearningTool,
} from '@/features/tools/tool-selection';
import { persistActiveActivity } from '@/features/world/active-activity';
import { ActivityPanel } from '@/features/world/activity-panel';
import { deleteJson, getJson, postJson } from '@/features/world/api';
import { resolveThemeVariant } from '@/features/world/theme';
import { worldHref } from '@/features/world/types';
import { WorldMap } from '@/features/world/world-map';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type {
    LearningActivity,
    LearningMap,
    LearningNode,
    LearningProgress,
    LearningWorld,
} from '@/types';

type WorldProps = {
    bookmarkedNodeIds: number[];
    world: LearningWorld | null;
    progress: LearningProgress;
};

type PanelSwipe = {
    isDragging: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
};

type SearchResult =
    | {
          id: string;
          kind: 'map';
          mapId: number;
          mapSlug: string;
          subtitle: string;
          title: string;
      }
    | {
          id: string;
          kind: 'node';
          mapId: number;
          mapSlug: string;
          nodeId: number;
          nodeSlug: string;
          subtitle: string;
          title: string;
      };

type SearchResponse = {
    results: SearchResult[];
};

export default function World({
    bookmarkedNodeIds: initialBookmarkedNodeIds,
    world,
    progress,
}: WorldProps) {
    const { url } = usePage();
    const { resolvedAppearance } = useAppearance();
    const selectedTool = useSelectedLearningTool();
    const mapSlug = useMemo(
        () => new URL(url, 'http://learning.local').searchParams.get('map'),
        [url],
    );
    const urlMap = useMemo(() => findMap(world, mapSlug), [mapSlug, world]);
    const [currentMapId, setCurrentMapId] = useState<number | null>(
        urlMap?.id ?? world?.maps[0]?.id ?? null,
    );
    const map = useMemo(
        () =>
            world?.maps.find((candidate) => candidate.id === currentMapId) ??
            urlMap ??
            world?.maps[0] ??
            null,
        [currentMapId, urlMap, world],
    );
    const mapTheme = map
        ? resolveThemeVariant(map.backgroundConfig, resolvedAppearance)
        : null;
    const focusedNodeSlug = useMemo(
        () => new URL(url, 'http://learning.local').searchParams.get('focused'),
        [url],
    );
    const focusedNode = useMemo(() => {
        if (!map || !focusedNodeSlug) {
            return null;
        }

        return (
            map.nodes.find(
                (node) =>
                    node.slug === focusedNodeSlug ||
                    node.id.toString() === focusedNodeSlug,
            ) ?? null
        );
    }, [focusedNodeSlug, map]);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const [panelSwipe, setPanelSwipe] = useState<PanelSwipe | null>(null);
    const activityProgress = progress.activities;
    const [bookmarkedNodeIds, setBookmarkedNodeIds] = useState(
        initialBookmarkedNodeIds,
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearchLoading, setIsSearchLoading] = useState(false);

    const selectedNode = useMemo(() => {
        if (!map) {
            return null;
        }

        return map.nodes.find((node) => node.id === selectedNodeId) ?? null;
    }, [map, selectedNodeId]);
    const selectedNodeIsCompleted = selectedNode
        ? nodeHasCompletedActivity(selectedNode, activityProgress)
        : false;
    useEffect(() => {
        const query = searchTerm.trim();

        if (query.length === 0) {
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setIsSearchLoading(true);

            void getJson<SearchResponse>(
                `/learning/search?query=${encodeURIComponent(query)}`,
                controller.signal,
            )
                .then((response) => setSearchResults(response.results))
                .catch((error: unknown) => {
                    if (
                        error instanceof DOMException &&
                        error.name === 'AbortError'
                    ) {
                        return;
                    }

                    setSearchResults([]);
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setIsSearchLoading(false);
                    }
                });
        }, 180);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [searchTerm]);

    useEffect(() => {
        if (!focusedNodeSlug) {
            return;
        }

        if (
            !focusedNode ||
            focusedNode.state === 'locked' ||
            focusedNode.state === 'hidden'
        ) {
            clearFocusedQueryParam();

            return;
        }

        const animationFrame = window.requestAnimationFrame(() => {
            setSelectedNodeId(focusedNode.id);
            setPanelSwipe(null);
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [focusedNode, focusedNodeSlug]);

    const openNode = useCallback((node: LearningNode) => {
        if (node.state === 'locked' || node.state === 'hidden') {
            return;
        }

        setSelectedNodeId(node.id);
    }, []);
    const useToolOnHiddenNode = useCallback(
        async (node: LearningNode) => {
            if (!selectedTool) {
                return;
            }

            const response = await postJson<{
                result: { discovered: boolean; isUseful: boolean };
            }>(`/learning/nodes/${node.id}/reveal-tool`, {
                tool_id: selectedTool.id,
            });

            if (response.result.discovered) {
                router.reload({
                    only: ['world'],
                });
            }
        },
        [selectedTool],
    );
    const focusNode = useCallback(
        (node: LearningNode, targetMap: LearningMap) => {
            setCurrentMapId(targetMap.id);
            setSelectedNodeId(node.id);
            setPanelSwipe(null);

            replaceWorldQuery({
                focused: node.slug,
                map: targetMap.slug,
            });
        },
        [],
    );
    const clearNodeFocus = useCallback(() => {
        setSelectedNodeId(null);
        setPanelSwipe(null);
        clearFocusedQueryParam();
    }, []);

    const goToSearchResult = useCallback(
        (result: SearchResult) => {
            if (result.kind === 'map') {
                const resultMap = findMap(world, result.mapSlug);

                if (!resultMap) {
                    window.location.assign(
                        `/world?map=${encodeURIComponent(result.mapSlug)}`,
                    );

                    return;
                }

                setCurrentMapId(resultMap.id);
                setSelectedNodeId(null);
                setPanelSwipe(null);
                replaceWorldQuery({
                    map: resultMap.slug,
                });

                return;
            }

            const resultMap = findMap(world, result.mapSlug);
            const resultNode =
                resultMap?.nodes.find(
                    (candidate) =>
                        candidate.id === result.nodeId ||
                        candidate.slug === result.nodeSlug,
                ) ?? null;

            if (!resultMap || !resultNode) {
                window.location.assign(
                    `/world?map=${encodeURIComponent(result.mapSlug)}&focused=${encodeURIComponent(result.nodeSlug)}`,
                );

                return;
            }

            focusNode(resultNode, resultMap);
        },
        [focusNode, world],
    );

    const toggleBookmark = useCallback(
        async (node: LearningNode) => {
            const isBookmarked = bookmarkedNodeIds.includes(node.id);
            const response = isBookmarked
                ? await deleteJson<{ bookmarkedNodeIds: number[] }>(
                      `/learning/nodes/${node.id}/bookmark`,
                  )
                : await postJson<{ bookmarkedNodeIds: number[] }>(
                      `/learning/nodes/${node.id}/bookmark`,
                      {},
                  );

            setBookmarkedNodeIds(response.bookmarkedNodeIds);
        },
        [bookmarkedNodeIds],
    );

    const updateSearchTerm = useCallback((value: string) => {
        setSearchTerm(value);

        if (value.trim().length === 0) {
            setSearchResults([]);
            setIsSearchLoading(false);
        }
    }, []);

    const startNode = useCallback(
        (node: LearningNode, activityId: number | null) => {
            const firstActivity =
                getActivityById(node, activityId) ?? getStartActivity(node);

            if (firstActivity) {
                persistActiveActivity(node, firstActivity);
            }

            const activityQuery = firstActivity
                ? `?activity=${firstActivity.id}`
                : '';

            router.visit(`/learning/nodes/${node.id}/play${activityQuery}`);
        },
        [],
    );

    if (!world || !map) {
        return (
            <>
                <Head title="World" />
                <main className="flex min-h-[70vh] flex-col justify-center gap-3 p-6">
                    <p className="text-sm text-muted-foreground">
                        No learning world has been seeded yet.
                    </p>
                    <p className="max-w-xl text-2xl font-semibold">
                        Run the demo seeder to create the first explorable map.
                    </p>
                </main>
            </>
        );
    }

    return (
        <>
            <Head title={world.title} />
            <main
                className="relative min-h-svh overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
                data-world-appearance={resolvedAppearance}
                style={{
                    background: mapTheme?.pageBackground,
                    color: mapTheme?.sidePanelTextColor,
                }}
            >
                <section className="absolute inset-0 overflow-hidden">
                    <WorldMap
                        map={map}
                        mode={resolvedAppearance}
                        selectedNode={selectedNode}
                        activityProgress={activityProgress}
                        onClearFocus={clearNodeFocus}
                        onClearEquippedTool={() => selectLearningTool(null)}
                        onSelectNode={openNode}
                        onUseToolOnHiddenNode={useToolOnHiddenNode}
                        selectedTool={selectedTool}
                    />
                </section>

                <WorldSearch
                    onClear={() => updateSearchTerm('')}
                    onSearchTermChange={updateSearchTerm}
                    onSelectResult={goToSearchResult}
                    results={searchResults}
                    searchTerm={searchTerm}
                    isLoading={isSearchLoading}
                />

                <aside
                    className={cn(
                        'absolute inset-0 z-50 w-full touch-pan-y border-l border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-300 ease-out md:left-auto md:max-w-[420px] dark:border-white/10 dark:bg-[#111820] dark:text-slate-100',
                        selectedNode
                            ? 'translate-x-0'
                            : 'pointer-events-none translate-x-full',
                        panelSwipe?.isDragging && 'transition-none',
                    )}
                    onPointerCancel={() => setPanelSwipe(null)}
                    onPointerDown={(event) => {
                        if (
                            event.pointerType === 'mouse' ||
                            event.button !== 0
                        ) {
                            return;
                        }

                        setPanelSwipe({
                            isDragging: false,
                            pointerId: event.pointerId,
                            startX: event.clientX,
                            startY: event.clientY,
                            offsetX: 0,
                        });
                    }}
                    onPointerMove={(event) => {
                        if (
                            !panelSwipe ||
                            panelSwipe.pointerId !== event.pointerId
                        ) {
                            return;
                        }

                        const deltaX = event.clientX - panelSwipe.startX;
                        const deltaY = event.clientY - panelSwipe.startY;
                        const isHorizontalSwipe =
                            Math.abs(deltaX) > 12 &&
                            Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

                        if (!panelSwipe.isDragging && !isHorizontalSwipe) {
                            return;
                        }

                        event.preventDefault();

                        setPanelSwipe({
                            ...panelSwipe,
                            isDragging: true,
                            offsetX: Math.max(0, deltaX),
                        });
                    }}
                    onPointerUp={(event) => {
                        if (
                            !panelSwipe ||
                            panelSwipe.pointerId !== event.pointerId
                        ) {
                            return;
                        }

                        if (panelSwipe.offsetX > 96) {
                            clearNodeFocus();
                        } else {
                            setPanelSwipe(null);
                        }
                    }}
                    style={{
                        background: mapTheme?.sidePanelBackground,
                        borderColor: mapTheme?.sidePanelBorderColor,
                        color: mapTheme?.sidePanelTextColor,
                        transform:
                            selectedNode && panelSwipe?.offsetX
                                ? `translateX(${panelSwipe.offsetX}px)`
                                : undefined,
                    }}
                >
                    <ActivityPanel
                        isBookmarked={
                            selectedNode
                                ? bookmarkedNodeIds.includes(selectedNode.id)
                                : false
                        }
                        isCompleted={selectedNodeIsCompleted}
                        node={selectedNode}
                        onClose={clearNodeFocus}
                        onStart={startNode}
                        onToggleBookmark={(node) => void toggleBookmark(node)}
                    />
                </aside>
            </main>
        </>
    );
}

World.layout = {
    breadcrumbs: [
        {
            title: 'World',
            href: worldHref,
        },
    ],
};

function findMap(
    world: LearningWorld | null,
    mapSlug: string | null,
): LearningMap | null {
    if (!world || !mapSlug) {
        return null;
    }

    return (
        world.maps.find(
            (map) => map.slug === mapSlug || map.id.toString() === mapSlug,
        ) ?? null
    );
}

function nodeHasCompletedActivity(
    node: LearningNode,
    activityProgress: LearningProgress['activities'],
): boolean {
    return node.activities.some(
        (activity) => activityProgress[activity.id]?.status === 'completed',
    );
}

function WorldSearch({
    isLoading,
    onClear,
    onSearchTermChange,
    onSelectResult,
    results,
    searchTerm,
}: {
    isLoading: boolean;
    onClear: () => void;
    onSearchTermChange: (value: string) => void;
    onSelectResult: (result: SearchResult) => void;
    results: SearchResult[];
    searchTerm: string;
}) {
    const hasSearch = searchTerm.trim().length > 0;

    return (
        <div className="absolute bottom-5 left-4 z-20 w-[min(24rem,calc(100%-2rem))] md:left-5">
            {hasSearch ? (
                <div className="mb-2 max-h-[42svh] overflow-y-auto rounded-xl border border-slate-200 bg-white/92 p-2 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/86">
                    {isLoading ? (
                        <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                            Searching...
                        </p>
                    ) : results.length > 0 ? (
                        <div className="grid gap-1">
                            {results.map((result) => (
                                <button
                                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:hover:bg-teal-200/10 dark:focus-visible:ring-teal-200"
                                    key={result.id}
                                    onClick={() => onSelectResult(result)}
                                    type="button"
                                >
                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/12 dark:text-teal-200">
                                        {result.kind === 'map' ? (
                                            <MapIcon className="size-4" />
                                        ) : (
                                            <MapPin className="size-4" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                                            {result.title}
                                        </span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                                            {result.subtitle}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                            No visible maps or tiles found.
                        </p>
                    )}
                </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/92 p-2 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/86">
                <Search className="ml-2 size-4 shrink-0 text-slate-500 dark:text-slate-400" />
                <Input
                    aria-label="Search maps and tiles"
                    className="h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                    onChange={(event) =>
                        onSearchTermChange(event.currentTarget.value)
                    }
                    placeholder="Search maps and tiles"
                    value={searchTerm}
                />
                {hasSearch ? (
                    <Button
                        aria-label="Clear search"
                        onClick={onClear}
                        size="icon"
                        type="button"
                        variant="ghost"
                    >
                        <X className="size-4" />
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

function getStartActivity(node: LearningNode): LearningActivity | null {
    return (
        getActivityById(node, node.startRoutes[0]?.activityId ?? null) ??
        node.activities.find(
            (activity) => activity.id === node.startActivityId,
        ) ??
        node.activities[0] ??
        null
    );
}

function getActivityById(
    node: LearningNode,
    activityId: number | null,
): LearningActivity | null {
    if (!activityId) {
        return null;
    }

    return (
        node.activities.find((activity) => activity.id === activityId) ?? null
    );
}

function replaceWorldQuery(params: { focused?: string; map?: string }): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (params.map) {
        url.searchParams.set('map', params.map);
    }

    if (!params.focused) {
        url.searchParams.delete('focused');
    }

    if (params.focused) {
        url.searchParams.set('focused', params.focused);
    }

    window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
    );
}

function clearFocusedQueryParam(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (!url.searchParams.has('focused')) {
        return;
    }

    url.searchParams.delete('focused');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;

    window.history.replaceState(window.history.state, '', nextUrl);
}
