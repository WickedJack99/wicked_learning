import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
    Bookmark,
    CheckCircle2,
    ChevronDown,
    LockKeyhole,
    LogOut,
    Map as MapIcon,
    MapPin,
    NotebookPen,
    Search,
    X,
} from 'lucide-react';

import { apiClient, getCsrfToken } from './api/client';
import {
    imageAlphaMaskFor,
    useImageAlphaMasks,
} from './public-image-alpha-mask';
import {
    mapAssetSurfacesOverlap,
    pointInsideMapAsset,
} from './public-map-asset-interaction';
import type { components } from './api/schema';
import { PublicMapAssetVisual } from './public-map-asset-visual';
import { OriginalRouteStartButtons } from './original-activity-playback';
import type { OriginalAppearance } from './original-appearance';
import { OriginalJournalOverlay } from './original-journal';
import { resolveOriginalWorldTheme } from './original-world-theme';

type PublicMap = components['schemas']['PublicMap'];
type PublicMapAsset = components['schemas']['PublicMapAsset'];
type PublicNode = components['schemas']['PublicNode'];
type PublicWorld = components['schemas']['PublicWorld'];

type WorldState =
    | { kind: 'loading' }
    | {
          kind: 'loaded';
          learnerState: LearnerWorldState | null;
          world: PublicWorld;
      }
    | { kind: 'empty' }
    | { kind: 'unavailable' };

type LearnerWorldState = Pick<
    components['schemas']['LearnerWorldSnapshot'],
    | 'activity_progress'
    | 'available_routes'
    | 'bookmarked_nodes'
    | 'route_progress'
    | 'start_routes'
>;
type PanelSwipe = {
    isDragging: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
};

type SearchState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; results: components['schemas']['PublicSearchResult'][] }
    | { kind: 'unavailable' };

export function PublicWorldPage({
    appearance,
    isAuthenticated,
    onSignedOut,
    userEmail,
}: {
    appearance: OriginalAppearance;
    isAuthenticated: boolean;
    onSignedOut: () => void;
    userEmail: string | null;
}) {
    const [worldState, setWorldState] = useState<WorldState>({
        kind: 'loading',
    });

    useEffect(() => {
        let isCurrent = true;

        const updateWorldState = (nextState: WorldState) => {
            if (isCurrent) {
                setWorldState(nextState);
            }
        };

        async function loadWorld(): Promise<void> {
            updateWorldState({ kind: 'loading' });

            try {
                if (isAuthenticated) {
                    const { data, response } =
                        await apiClient.GET('/learner/world');

                    if (response.status === 404) {
                        updateWorldState({ kind: 'empty' });
                        return;
                    }
                    if (response.ok && data) {
                        updateWorldState({
                            kind: 'loaded',
                            learnerState: {
                                activity_progress: data.activity_progress,
                                available_routes: data.available_routes,
                                bookmarked_nodes: data.bookmarked_nodes,
                                route_progress: data.route_progress,
                                start_routes: data.start_routes,
                            },
                            world: data.world,
                        });
                        return;
                    }
                    if (response.status !== 401) {
                        updateWorldState({ kind: 'unavailable' });
                        return;
                    }
                }

                const { data, response } = await apiClient.GET('/public/world');

                if (response.status === 404) {
                    updateWorldState({ kind: 'empty' });
                    return;
                }
                if (!response.ok || !data) {
                    updateWorldState({ kind: 'unavailable' });
                    return;
                }

                updateWorldState({
                    kind: 'loaded',
                    learnerState: null,
                    world: data,
                });
            } catch {
                updateWorldState({ kind: 'unavailable' });
            }
        }

        void loadWorld();

        return () => {
            isCurrent = false;
        };
    }, [isAuthenticated]);

    if (worldState.kind === 'loading') {
        return <WorldMessage message="Loading the learning world…" />;
    }
    if (worldState.kind === 'empty') {
        return (
            <WorldMessage message="The learning world is not published yet." />
        );
    }
    if (worldState.kind === 'unavailable') {
        return (
            <WorldMessage
                message="The learning world is temporarily unavailable."
                role="alert"
            />
        );
    }

    return (
        <PublicWorldSurface
            appearance={appearance}
            isAuthenticated={isAuthenticated}
            learnerState={worldState.learnerState}
            onSignedOut={onSignedOut}
            userEmail={userEmail}
            world={worldState.world}
        />
    );
}

function WorldMessage({ message, role }: { message: string; role?: string }) {
    return (
        <main className="flex min-h-svh items-center justify-center bg-[#0b1117] p-6 text-slate-100">
            <p role={role}>{message}</p>
        </main>
    );
}

function PublicWorldSurface({
    appearance,
    isAuthenticated,
    learnerState,
    onSignedOut,
    userEmail,
    world,
}: {
    appearance: OriginalAppearance;
    isAuthenticated: boolean;
    learnerState: LearnerWorldState | null;
    onSignedOut: () => void;
    userEmail: string | null;
    world: PublicWorld;
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedMapSlug = searchParams.get('map');
    const selectedMap =
        world.maps.find((map) => map.slug === requestedMapSlug) ??
        world.maps[0] ??
        null;
    const requestedNodeSlug = searchParams.get('focused');
    const selectedNode =
        selectedMap?.nodes.find((node) => node.slug === requestedNodeSlug) ??
        null;
    const selectedMapTheme = selectedMap
        ? resolveOriginalWorldTheme(selectedMap.background_config, appearance)
        : null;
    const completedNodeSlugs = useMemo(
        () => completedNodeSlugsFrom(learnerState),
        [learnerState],
    );
    const [bookmarkedNodes, setBookmarkedNodes] = useState(
        learnerState?.bookmarked_nodes ?? [],
    );
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [panelSwipe, setPanelSwipe] = useState<PanelSwipe | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        setBookmarkedNodes(learnerState?.bookmarked_nodes ?? []);
    }, [learnerState?.bookmarked_nodes]);

    function selectNode(node: PublicNode | null, map = selectedMap): void {
        if (!map) {
            return;
        }

        const next = new URLSearchParams(searchParams);
        next.set('map', map.slug);
        if (node) {
            next.set('focused', node.slug);
            setPanelSwipe(null);
        } else {
            next.delete('focused');
            setPanelSwipe(null);
        }
        setSearchParams(next, { replace: true });
    }

    function selectMap(map: PublicMap): void {
        const next = new URLSearchParams(searchParams);
        next.set('map', map.slug);
        next.delete('focused');
        setSearchParams(next, { replace: true });
    }

    async function startRoute(
        start: components['schemas']['LearnerActivityStart'],
        reset = false,
    ): Promise<void> {
        try {
            const token = await getCsrfToken();
            const endpoint = reset
                ? '/learner/activity-starts/{start_id}/reset'
                : '/learner/activity-starts/{start_id}/start';
            const { data, response } = await apiClient.POST(endpoint, {
                params: {
                    header: { 'X-CSRF-Token': token },
                    path: { start_id: start.start_id },
                },
            });
            if (!response.ok || !data) {
                return;
            }
            navigate(
                `/learning/nodes/${encodeURIComponent(start.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
            );
        } catch {
            // The original controls keep their presentation on a transient
            // request failure; the next selection is safe to retry.
        }
    }

    const toggleBookmark = useCallback(
        async (node: PublicNode): Promise<void> => {
            if (!isAuthenticated || !selectedMap || isBookmarking) {
                return;
            }

            setIsBookmarking(true);
            try {
                const token = await getCsrfToken();
                const bookmarked = bookmarkedNodes.some(
                    (bookmark) =>
                        bookmark.map_slug === selectedMap.slug &&
                        bookmark.node_slug === node.slug,
                );
                const endpoint =
                    '/learner/maps/{map_slug}/nodes/{node_slug}/bookmark';
                const { data, response } = bookmarked
                    ? await apiClient.DELETE(endpoint, {
                          params: {
                              header: { 'X-CSRF-Token': token },
                              path: {
                                  map_slug: selectedMap.slug,
                                  node_slug: node.slug,
                              },
                          },
                      })
                    : await apiClient.POST(endpoint, {
                          params: {
                              header: { 'X-CSRF-Token': token },
                              path: {
                                  map_slug: selectedMap.slug,
                                  node_slug: node.slug,
                              },
                          },
                      });
                if (response.ok && data) {
                    setBookmarkedNodes(data.bookmarked_nodes);
                }
            } catch {
                // Preserve the original visible state on a transient failure.
            } finally {
                setIsBookmarking(false);
            }
        },
        [bookmarkedNodes, isAuthenticated, isBookmarking, selectedMap],
    );

    if (!selectedMap) {
        return (
            <WorldMessage message="The learning world has no published maps yet." />
        );
    }

    return (
        <main
            className="public-world relative min-h-svh overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
            data-wl-id="public-world"
            style={worldSurfaceStyle(selectedMapTheme!)}
        >
            <WorldNavigation
                isAuthenticated={isAuthenticated}
                onSignedOut={onSignedOut}
                theme={selectedMapTheme!}
                userEmail={userEmail}
            />
            <section className="absolute inset-0 overflow-hidden">
                <PublicMapSurface
                    appearance={appearance}
                    bookmarkedNodes={bookmarkedNodes}
                    completedNodeSlugs={completedNodeSlugs}
                    map={selectedMap}
                    onClearFocus={() => selectNode(null)}
                    onSelectNode={selectNode}
                    selectedNode={selectedNode}
                    theme={selectedMapTheme!}
                />
            </section>

            <WorldSearch
                onSelectMap={selectMap}
                onSelectNode={selectNode}
                theme={selectedMapTheme!}
                world={world}
            />

            {world.maps.length > 1 ? (
                <nav
                    aria-label="Published maps"
                    className="absolute right-5 bottom-5 z-20 flex max-w-[calc(100%-2.5rem)] gap-2 overflow-x-auto rounded-xl border p-2 shadow-2xl backdrop-blur-md"
                    style={floatingPanelStyle(selectedMapTheme!)}
                >
                    {world.maps.map((map) => (
                        <button
                            aria-current={
                                map.slug === selectedMap.slug
                                    ? 'page'
                                    : undefined
                            }
                            className="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/10"
                            key={map.slug}
                            onClick={() => selectMap(map)}
                            type="button"
                        >
                            {map.title}
                        </button>
                    ))}
                </nav>
            ) : null}

            <NodeDrawer
                appearance={appearance}
                bookmarked={
                    selectedNode
                        ? bookmarkedNodes.some(
                              (bookmark) =>
                                  bookmark.map_slug === selectedMap.slug &&
                                  bookmark.node_slug === selectedNode.slug,
                          )
                        : false
                }
                completed={
                    selectedNode
                        ? completedNodeSlugs.has(selectedNode.slug)
                        : false
                }
                canBookmark={isAuthenticated}
                isBookmarking={isBookmarking}
                node={selectedNode}
                onClose={() => selectNode(null)}
                onReset={(start) => void startRoute(start, true)}
                onStart={(start) => void startRoute(start)}
                onToggleBookmark={(node) => void toggleBookmark(node)}
                onSwipeChange={setPanelSwipe}
                startRoutes={
                    isAuthenticated ? (learnerState?.start_routes ?? []) : []
                }
                swipe={panelSwipe}
                theme={selectedMapTheme!}
            />
        </main>
    );
}

function WorldNavigation({
    isAuthenticated,
    onSignedOut,
    theme,
    userEmail,
}: {
    isAuthenticated: boolean;
    onSignedOut: () => void;
    theme: Record<string, unknown>;
    userEmail: string | null;
}) {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isJournalOpen, setIsJournalOpen] = useState(false);
    const [signOutError, setSignOutError] = useState<string | null>(null);

    async function signOut(): Promise<void> {
        setSignOutError(null);

        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/session/logout', {
                params: { header: { 'X-CSRF-Token': token } },
            });

            if (!response.ok) {
                setSignOutError('Sign out is temporarily unavailable.');
                return;
            }

            setIsUserMenuOpen(false);
            onSignedOut();
        } catch {
            setSignOutError('Sign out is temporarily unavailable.');
        }
    }

    return (
        <header
            className="fixed top-0 right-0 left-0 z-[70] border-b backdrop-blur-xl"
            data-wl-id="learner.navigation.header"
            style={learnerNavigationStyle(theme)}
        >
            <a
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-[80] focus:rounded-md focus:bg-[var(--learner-panel-background)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--learner-heading-text)] focus:ring-2 focus:ring-[var(--learner-action-accent)] focus:outline-none"
                href="#learner-main-content"
            >
                Skip to content
            </a>
            <div className="flex min-h-16 flex-wrap items-center gap-x-5 px-4 sm:px-6 lg:px-8 xl:flex-nowrap">
                <div
                    className="flex shrink-0 items-center gap-3"
                    data-wl-id="learner.navigation.brand"
                >
                    <img
                        alt=""
                        aria-hidden="true"
                        className="size-8 object-contain"
                        draggable={false}
                        src="/images/logo.png"
                    />
                    <span className="hidden text-sm font-semibold tracking-wide text-[var(--learner-heading-text)] sm:block">
                        Learning Worlds
                    </span>
                </div>
                <nav
                    aria-label="Learner navigation"
                    className="order-3 -mx-4 flex w-[calc(100%+2rem)] basis-full flex-wrap gap-0 border-t px-4 xl:order-none xl:mx-0 xl:min-w-0 xl:flex-1 xl:flex-nowrap xl:border-t-0 xl:px-0"
                    style={{ borderColor: 'var(--learner-border-color)' }}
                >
                    <Link
                        aria-current="page"
                        className="relative inline-flex shrink-0 items-center gap-2 px-2 py-3 text-sm text-[var(--learner-heading-text)] transition hover:text-[var(--learner-heading-text)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-[var(--learner-accent)] xl:py-[1.35rem] 2xl:px-3"
                        to="/world"
                    >
                        Current map
                    </Link>
                </nav>
                {isAuthenticated && userEmail ? (
                    <div className="relative ml-auto flex shrink-0 items-center gap-2">
                        <button
                            aria-controls="learning-journal-panel"
                            aria-expanded={isJournalOpen}
                            aria-label="Journal"
                            className="grid size-10 place-items-center rounded-lg border bg-[var(--learner-panel-background)] text-[var(--learner-muted-text)] shadow-none transition hover:bg-[var(--learner-panel-muted-background)] hover:text-[var(--learner-heading-text)]"
                            onClick={() => setIsJournalOpen(true)}
                            style={{ borderColor: 'var(--learner-border-color)' }}
                            type="button"
                        >
                            <NotebookPen className="size-4" />
                        </button>
                        <button
                            aria-expanded={isUserMenuOpen}
                            aria-haspopup="menu"
                            aria-label="Open user menu"
                            className="flex h-10 items-center gap-2 rounded-lg border bg-[var(--learner-panel-background)] px-2.5 text-[var(--learner-heading-text)] shadow-none transition hover:bg-[var(--learner-panel-muted-background)]"
                            onClick={() => setIsUserMenuOpen((open) => !open)}
                            style={{ borderColor: 'var(--learner-border-color)' }}
                            type="button"
                        >
                            <span className="grid size-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--learner-accent)_20%,transparent)] text-xs text-[var(--learner-accent)]">
                                {userEmail.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="hidden max-w-32 truncate text-sm sm:block">
                                {userEmail}
                            </span>
                            <ChevronDown className="hidden size-3.5 text-[var(--learner-muted-text)] sm:block" />
                        </button>
                        {isUserMenuOpen ? (
                            <div
                                className="absolute top-12 right-0 z-[80] w-60 rounded-lg border bg-[var(--learner-panel-background)] p-1 shadow-2xl"
                                role="menu"
                                style={{
                                    borderColor: 'var(--learner-border-color)',
                                }}
                            >
                                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                                    <span className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--learner-accent)_20%,transparent)] text-xs text-[var(--learner-accent)]">
                                        {userEmail.slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="min-w-0 truncate font-medium text-[var(--learner-heading-text)]">
                                        {userEmail}
                                    </span>
                                </div>
                                <div
                                    aria-hidden="true"
                                    className="my-1 h-px bg-[var(--learner-border-color)]"
                                />
                                <button
                                    className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm font-medium text-[var(--learner-heading-text)] transition hover:bg-[var(--learner-panel-muted-background)]"
                                    onClick={() => void signOut()}
                                    role="menuitem"
                                    type="button"
                                >
                                    <LogOut className="mr-2 size-4" />
                                    Log out
                                </button>
                                {signOutError ? (
                                    <p
                                        className="px-2 text-sm text-red-300"
                                        role="alert"
                                    >
                                        {signOutError}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {isJournalOpen ? (
                <OriginalJournalOverlay
                    onClose={() => setIsJournalOpen(false)}
                />
            ) : null}
        </header>
    );
}

function PublicMapSurface({
    appearance,
    bookmarkedNodes,
    completedNodeSlugs,
    map,
    onClearFocus,
    onSelectNode,
    selectedNode,
    theme,
}: {
    appearance: OriginalAppearance;
    bookmarkedNodes: components['schemas']['LearnerBookmark'][];
    completedNodeSlugs: Set<string>;
    map: PublicMap;
    onClearFocus: () => void;
    onSelectNode: (node: PublicNode) => void;
    selectedNode: PublicNode | null;
    theme: Record<string, unknown>;
}) {
    const [toggledAssetSlugs, setToggledAssetSlugs] = useState<string[]>([]);
    const [focusedAssetSlug, setFocusedAssetSlug] = useState<string | null>(
        null,
    );
    const [mapPointer, setMapPointer] = useState<{
        height: number;
        width: number;
        x: number;
        y: number;
    } | null>(null);
    const nodesByAssetSlug = useMemo(
        () =>
            new Map(
                map.nodes.flatMap((node) =>
                    node.asset_slug ? [[node.asset_slug, node] as const] : [],
                ),
            ),
        [map.nodes],
    );
    const assetThemes = map.assets.map((asset) =>
        mergedThemeConfig(
            resolveOriginalWorldTheme(
                nodesByAssetSlug.get(asset.slug)?.visual_config ?? {},
                appearance,
            ),
            resolveOriginalWorldTheme(asset.visual_config, appearance),
        ),
    );
    const currentSurfaces = map.assets.map((asset) =>
        assetSurface(asset, toggledAssetSlugs.includes(asset.slug)),
    );
    const alphaMaskRequests = map.assets.map((asset, index) => ({
        imageFit: stringConfig(assetThemes[index], 'imageFit'),
        imagePosition: stringConfig(assetThemes[index], 'imagePosition'),
        imageUrl: currentSurfaces[index].imageUrl,
    }));
    const alphaMasks = useImageAlphaMasks(alphaMaskRequests);
    const selectedAssetIndex = selectedNode?.asset_slug
        ? map.assets.findIndex(
              (asset) => asset.slug === selectedNode.asset_slug,
          )
        : -1;
    const selectedAsset =
        selectedAssetIndex >= 0 ? map.assets[selectedAssetIndex] : null;
    const hiddenAssetSlugs = new Set(
        map.assets
            .filter((asset, index) => {
                if (asset.interaction_mode !== 'hide_on_hover') {
                    return false;
                }

                const hiddenByPointer = mapPointer
                    ? pointInsideMapAsset(
                          currentSurfaces[index],
                          mapPointer,
                          mapPointer,
                          imageAlphaMaskFor(
                              alphaMaskRequests[index],
                              alphaMasks,
                          ),
                      )
                    : false;
                const hiddenForFocusedAsset =
                    selectedAsset &&
                    selectedAssetIndex >= 0 &&
                    (asset.z > selectedAsset.z ||
                        (asset.z === selectedAsset.z &&
                            index > selectedAssetIndex)) &&
                    mapPointer &&
                    mapAssetSurfacesOverlap(
                        currentSurfaces[index],
                        currentSurfaces[selectedAssetIndex],
                        mapPointer,
                        imageAlphaMaskFor(alphaMaskRequests[index], alphaMasks),
                        imageAlphaMaskFor(
                            alphaMaskRequests[selectedAssetIndex],
                            alphaMasks,
                        ),
                    );

                return hiddenByPointer || hiddenForFocusedAsset;
            })
            .map((asset) => asset.slug),
    );
    const pointerAssetSlug = mapPointer
        ? map.assets.reduce<string | null>((currentSlug, asset, index) => {
              const isInteractive =
                  asset.interaction_mode === 'focusable' ||
                  asset.interaction_mode === 'toggle';

              if (
                  !isInteractive ||
                  !pointInsideMapAsset(
                      currentSurfaces[index],
                      mapPointer,
                      mapPointer,
                      imageAlphaMaskFor(alphaMaskRequests[index], alphaMasks),
                  )
              ) {
                  return currentSlug;
              }

              if (currentSlug === null) {
                  return asset.slug;
              }

              const currentIndex = map.assets.findIndex(
                  (candidate) => candidate.slug === currentSlug,
              );
              const currentAsset = map.assets[currentIndex];

              return asset.z > currentAsset.z ||
                  (asset.z === currentAsset.z && index > currentIndex)
                  ? asset.slug
                  : currentSlug;
          }, null)
        : null;

    return (
        <div
            className="relative h-full min-h-[56vh] overflow-hidden select-none"
            onClick={onClearFocus}
            onPointerLeave={() => setMapPointer(null)}
            onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                setMapPointer({
                    height: bounds.height,
                    width: bounds.width,
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                });
            }}
        >
            {stringConfig(theme, 'imageUrl') ? (
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center transition-opacity"
                    style={{
                        backgroundImage: `url(${stringConfig(theme, 'imageUrl')})`,
                    }}
                />
            ) : null}
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        stringConfig(theme, 'overlay') ?? 'rgba(0, 0, 0, 0.4)',
                }}
            />
            <div
                className="pointer-events-none absolute inset-0 z-20"
                data-wl-id="learner.world.map-assets"
            >
                {map.assets.map((asset, index) => {
                    const node = nodesByAssetSlug.get(asset.slug) ?? null;
                    const isToggled = toggledAssetSlugs.includes(asset.slug);
                    const surface = currentSurfaces[index];
                    const canOpen =
                        asset.interaction_mode === 'focusable' && node;
                    const canToggle = asset.interaction_mode === 'toggle';
                    const selected = node?.slug === selectedNode?.slug;
                    const isBookmarked = Boolean(
                        node &&
                            bookmarkedNodes.some(
                                (bookmark) =>
                                    bookmark.map_slug === map.slug &&
                                    bookmark.node_slug === node.slug,
                            ),
                    );
                    const isCompleted = Boolean(
                        node && completedNodeSlugs.has(node.slug),
                    );
                    const isHidden = hiddenAssetSlugs.has(asset.slug);
                    const assetTheme = assetThemes[index];
                    const label =
                        stringConfig(assetTheme, 'label') ??
                        node?.title ??
                        asset.text ??
                        asset.title;
                    const isHighlighted =
                        selected ||
                        pointerAssetSlug === asset.slug ||
                        focusedAssetSlug === asset.slug;
                    const style = {
                        left: `${surface.x}%`,
                        opacity: isHidden ? 0 : asset.opacity,
                        top: `${surface.y}%`,
                        transition: 'opacity 140ms ease',
                        width: `${surface.width}%`,
                        zIndex: asset.z + 20,
                    };

                    if (!canOpen && !canToggle) {
                        return (
                            <div
                                aria-hidden="true"
                                className="absolute -translate-x-1/2 -translate-y-1/2"
                                data-map-asset-mode={asset.interaction_mode}
                                data-map-asset-slug={asset.slug}
                                data-map-asset-visibility={
                                    isHidden ? 'hidden' : 'visible'
                                }
                                key={asset.slug}
                                style={style}
                            >
                                <PublicMapAssetVisual
                                    backgroundColor={
                                        stringConfig(
                                            assetTheme,
                                            'borderColor',
                                        ) ??
                                        stringConfig(assetTheme, 'tileColor') ??
                                        '#12343b'
                                    }
                                    highlightBorderColor={
                                        stringConfig(
                                            assetTheme,
                                            'highlightBorderColor',
                                        ) ??
                                        stringConfig(
                                            assetTheme,
                                            'highlightColor',
                                        )
                                    }
                                    highlightColor={stringConfig(
                                        assetTheme,
                                        'highlightColor',
                                    )}
                                    highlighted={false}
                                    highlightedLabelColor={stringConfig(
                                        assetTheme,
                                        'highlightedLabelColor',
                                    )}
                                    imageFit={stringConfig(
                                        assetTheme,
                                        'imageFit',
                                    )}
                                    imagePosition={stringConfig(
                                        assetTheme,
                                        'imagePosition',
                                    )}
                                    imageUrl={surface.imageUrl}
                                    label={label}
                                    labelColor={stringConfig(
                                        assetTheme,
                                        'labelColor',
                                    )}
                                />
                            </div>
                        );
                    }

                    return (
                        <button
                            aria-label={
                                canToggle
                                    ? `${label}, ${isToggled ? 'second state' : 'first state'}`
                                    : `${label}, ${node?.state === 'locked' ? 'locked' : 'open location'}`
                            }
                            aria-pressed={canToggle ? isToggled : undefined}
                            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 text-center focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none ${isHidden ? 'pointer-events-none' : ''}`}
                            data-map-asset-mode={asset.interaction_mode}
                            data-map-asset-slug={asset.slug}
                            data-map-asset-highlighted={
                                isHighlighted ? 'true' : 'false'
                            }
                            data-map-asset-visibility={
                                isHidden ? 'hidden' : 'visible'
                            }
                            key={asset.slug}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (canToggle) {
                                    setToggledAssetSlugs((current) =>
                                        current.includes(asset.slug)
                                            ? current.filter(
                                                  (slug) => slug !== asset.slug,
                                              )
                                            : [...current, asset.slug],
                                    );
                                } else if (
                                    node &&
                                    node.state !== 'locked' &&
                                    node.state !== 'hidden'
                                ) {
                                    onSelectNode(node);
                                }
                            }}
                            onBlur={() =>
                                setFocusedAssetSlug((current) =>
                                    current === asset.slug ? null : current,
                                )
                            }
                            onFocus={() => setFocusedAssetSlug(asset.slug)}
                            onPointerDown={(event) => event.stopPropagation()}
                            style={style}
                            type="button"
                        >
                            <PublicMapAssetVisual
                                backgroundColor={
                                    stringConfig(assetTheme, 'borderColor') ??
                                    stringConfig(assetTheme, 'tileColor') ??
                                    '#12343b'
                                }
                                highlightBorderColor={
                                    stringConfig(
                                        assetTheme,
                                        'highlightBorderColor',
                                    ) ??
                                    stringConfig(assetTheme, 'highlightColor')
                                }
                                highlightColor={stringConfig(
                                    assetTheme,
                                    'highlightColor',
                                )}
                                highlightImageEnabled={
                                    assetTheme.highlightImageEnabled === true
                                }
                                highlightImageUrl={stringConfig(
                                    assetTheme,
                                    'highlightImageUrl',
                                )}
                                highlighted={isHighlighted}
                                highlightedLabelColor={stringConfig(
                                    assetTheme,
                                    'highlightedLabelColor',
                                )}
                                imageFit={stringConfig(assetTheme, 'imageFit')}
                                imagePosition={stringConfig(
                                    assetTheme,
                                    'imagePosition',
                                )}
                                imageUrl={surface.imageUrl}
                                label={label}
                                labelColor={stringConfig(
                                    assetTheme,
                                    'labelColor',
                                )}
                            />
                            {isBookmarked || isCompleted ? (
                                <span className="pointer-events-none absolute top-1 right-1 flex gap-1 text-teal-100 drop-shadow-md">
                                    {isBookmarked ? (
                                        <Bookmark
                                            aria-label="Saved place"
                                            className="size-4 fill-current"
                                        />
                                    ) : null}
                                    {isCompleted ? (
                                        <CheckCircle2
                                            aria-label="Activity complete"
                                            className="size-4"
                                        />
                                    ) : null}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <div
                className="pointer-events-none absolute top-28 left-1/2 z-10 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border p-4 text-left shadow-2xl backdrop-blur-md sm:top-24 md:left-8 md:w-auto md:translate-x-0"
                style={mapPanelStyle(theme)}
            >
                <div
                    className="mb-3 flex items-center gap-2 text-sm"
                    style={{
                        color: stringConfig(theme, 'accentColor') ?? '#ccfbf1',
                    }}
                >
                    <MapIcon className="size-4" />
                    <span>Current map</span>
                </div>
                <h1
                    className="m-0 text-3xl font-semibold tracking-normal"
                    style={{
                        color:
                            stringConfig(theme, 'panelTextColor') ?? '#e2e8f0',
                    }}
                >
                    {map.title}
                </h1>
                {map.description ? (
                    <p
                        className="mt-3 mb-0 max-w-md text-sm leading-6"
                        style={{
                            color:
                                stringConfig(theme, 'panelMutedTextColor') ??
                                stringConfig(theme, 'panelTextColor') ??
                                '#e2e8f0',
                        }}
                    >
                        {map.description}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function assetSurface(
    asset: PublicMapAsset,
    secondState: boolean,
): {
    imageUrl: string | null;
    width: number;
    x: number;
    y: number;
} {
    const states = objectConfig(asset.interaction_config, 'states');
    const state = secondState
        ? objectConfig(states, 'second')
        : objectConfig(states, 'first');

    return {
        imageUrl: stringConfig(state, 'imageUrl') ?? asset.image_url,
        width: numberConfig(state, 'width', asset.width),
        x: numberConfig(state, 'x', asset.x),
        y: numberConfig(state, 'y', asset.y),
    };
}

function WorldSearch({
    onSelectMap,
    onSelectNode,
    theme,
    world,
}: {
    onSelectMap: (map: PublicMap) => void;
    onSelectNode: (node: PublicNode, map: PublicMap) => void;
    theme: Record<string, unknown>;
    world: PublicWorld;
}) {
    const [term, setTerm] = useState('');
    const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

    useEffect(() => {
        const query = term.trim();
        if (query.length < 2) {
            setSearch({ kind: 'idle' });
            return;
        }

        const timer = window.setTimeout(() => {
            setSearch({ kind: 'loading' });
            void apiClient
                .GET('/public/search', { params: { query: { q: query } } })
                .then(({ data, response }) => {
                    if (!response.ok || !data) {
                        setSearch({ kind: 'unavailable' });
                        return;
                    }
                    setSearch({ kind: 'loaded', results: data.results });
                })
                .catch(() => setSearch({ kind: 'unavailable' }));
        }, 180);

        return () => window.clearTimeout(timer);
    }, [term]);

    function chooseResult(
        result: components['schemas']['PublicSearchResult'],
    ): void {
        const resultMap = world.maps.find(
            (candidate) => candidate.slug === result.map_slug,
        );
        if (!resultMap) {
            return;
        }
        const node = resultMap.nodes.find(
            (candidate) => candidate.asset_slug === result.asset_slug,
        );
        if (node) {
            onSelectNode(node, resultMap);
        } else {
            onSelectMap(resultMap);
        }
        setTerm('');
        setIsMobilePanelOpen(false);
    }

    const hasSearch = term.trim().length > 0;
    const searchLabel = 'Search maps and places';
    const searchResults = () => {
        if (search.kind === 'loading') {
            return <p className="px-3 py-4 text-sm">Searching…</p>;
        }
        if (search.kind === 'unavailable') {
            return (
                <p className="px-3 py-4 text-sm">
                    Search is temporarily unavailable.
                </p>
            );
        }
        if (search.kind === 'loaded' && search.results.length === 0) {
            return (
                <p className="px-3 py-4 text-sm">
                    No visible maps or places found.
                </p>
            );
        }
        if (search.kind !== 'loaded') {
            return null;
        }

        return (
            <div className="grid gap-1">
                {search.results.map((result) => (
                    <button
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                        key={`${result.map_slug}-${result.asset_slug}`}
                        onClick={() => chooseResult(result)}
                        type="button"
                    >
                        <span
                            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-300/12"
                            style={{
                                color:
                                    stringConfig(theme, 'accentColor') ??
                                    '#ccfbf1',
                            }}
                        >
                            <MapPin className="size-4" />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                                {result.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs opacity-75">
                                {result.map_title}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
        );
    };
    const searchInput = (autoFocus = false) => (
        <div
            className="flex items-center gap-2 rounded-xl border p-2 shadow-2xl backdrop-blur-md"
            style={floatingPanelStyle(theme)}
        >
            <Search className="ml-2 size-4 shrink-0 opacity-75" />
            <span className="sr-only">{searchLabel}</span>
            <input
                aria-label={searchLabel}
                autoFocus={autoFocus}
                className="h-9 border-0 bg-transparent px-1 text-current shadow-none outline-none placeholder:text-current/60"
                onChange={(event) => setTerm(event.currentTarget.value)}
                placeholder={searchLabel}
                type="search"
                value={term}
            />
            {hasSearch ? (
                <button
                    aria-label="Clear search"
                    className="grid size-9 place-items-center rounded-md hover:bg-white/10"
                    onClick={() => setTerm('')}
                    type="button"
                >
                    <X className="size-4" />
                </button>
            ) : null}
        </div>
    );

    return (
        <>
            <div className="absolute bottom-5 left-5 z-20 hidden w-[min(24rem,calc(100%-2rem))] md:block">
                {hasSearch ? (
                    <div
                        className="mb-2 rounded-xl border p-2 shadow-2xl backdrop-blur-md"
                        style={floatingPanelStyle(theme)}
                    >
                        {searchResults()}
                    </div>
                ) : null}
                {searchInput()}
            </div>

            <button
                aria-label="Open map search"
                className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30 grid size-12 place-items-center rounded-2xl border shadow-2xl backdrop-blur-md transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none md:hidden dark:focus-visible:ring-teal-200"
                onClick={() => setIsMobilePanelOpen(true)}
                style={floatingPanelStyle(theme)}
                type="button"
            >
                <Search className="size-5" />
            </button>

            {isMobilePanelOpen ? (
                <div className="fixed inset-0 z-[80] md:hidden">
                    <button
                        aria-label="Close map search"
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                        onClick={() => setIsMobilePanelOpen(false)}
                        type="button"
                    />
                    <section
                        aria-label="Map search"
                        className="absolute inset-x-4 top-4 bottom-4 flex min-h-0 flex-col overflow-hidden rounded-2xl border shadow-2xl"
                        style={floatingPanelStyle(theme)}
                    >
                        <div
                            className="flex items-center justify-between gap-4 border-b px-4 py-3"
                            style={{
                                borderColor:
                                    stringConfig(theme, 'panelBorderColor') ??
                                    'rgba(255,255,255,0.1)',
                            }}
                        >
                            <div>
                                <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-75">
                                    Search
                                </p>
                                <h2 className="text-lg font-semibold">
                                    Map search
                                </h2>
                            </div>
                            <button
                                aria-label="Close map search"
                                className="grid size-9 place-items-center rounded-md hover:bg-white/10"
                                onClick={() => setIsMobilePanelOpen(false)}
                                type="button"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="p-4">{searchInput(true)}</div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                            {hasSearch ? (
                                <div
                                    className="rounded-xl border p-2"
                                    style={{
                                        borderColor:
                                            stringConfig(
                                                theme,
                                                'panelBorderColor',
                                            ) ?? 'rgba(255,255,255,0.1)',
                                    }}
                                >
                                    {searchResults()}
                                </div>
                            ) : (
                                <p
                                    className="rounded-xl border px-3 py-4 text-sm opacity-75"
                                    style={{
                                        borderColor:
                                            stringConfig(
                                                theme,
                                                'panelBorderColor',
                                            ) ?? 'rgba(255,255,255,0.1)',
                                    }}
                                >
                                    Enter a word to search visible maps and
                                    places.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            ) : null}
        </>
    );
}

function NodeDrawer({
    appearance,
    bookmarked,
    canBookmark,
    completed,
    isBookmarking,
    node,
    onClose,
    onReset,
    onStart,
    onSwipeChange,
    onToggleBookmark,
    startRoutes,
    swipe,
    theme,
}: {
    appearance: OriginalAppearance;
    bookmarked: boolean;
    canBookmark: boolean;
    completed: boolean;
    isBookmarking: boolean;
    node: PublicNode | null;
    onClose: () => void;
    onReset: (start: components['schemas']['LearnerActivityStart']) => void;
    onStart: (start: components['schemas']['LearnerActivityStart']) => void;
    onSwipeChange: (swipe: PanelSwipe | null) => void;
    onToggleBookmark: (node: PublicNode) => void;
    startRoutes: components['schemas']['LearnerActivityStart'][];
    swipe: PanelSwipe | null;
    theme: Record<string, unknown>;
}) {

    return (
        <aside
            aria-label="Selected learning place"
            className={`absolute inset-x-0 top-28 bottom-0 z-50 w-full touch-pan-y border-l border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-300 ease-out sm:top-16 md:left-auto md:max-w-[420px] dark:border-white/10 dark:bg-[#111820] dark:text-slate-100 ${node ? 'translate-x-0' : 'pointer-events-none translate-x-full'} ${swipe?.isDragging ? 'transition-none' : ''}`}
            onPointerCancel={() => onSwipeChange(null)}
            onPointerDown={(event) => {
                if (event.pointerType === 'mouse' || event.button !== 0) {
                    return;
                }

                onSwipeChange({
                    isDragging: false,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    offsetX: 0,
                });
            }}
            onPointerMove={(event) => {
                if (!swipe || swipe.pointerId !== event.pointerId) {
                    return;
                }

                const deltaX = event.clientX - swipe.startX;
                const deltaY = event.clientY - swipe.startY;
                const isHorizontalSwipe =
                    Math.abs(deltaX) > 12 &&
                    Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

                if (!swipe.isDragging && !isHorizontalSwipe) {
                    return;
                }

                event.preventDefault();
                onSwipeChange({
                    ...swipe,
                    isDragging: true,
                    offsetX: Math.max(0, deltaX),
                });
            }}
            onPointerUp={(event) => {
                if (!swipe || swipe.pointerId !== event.pointerId) {
                    return;
                }

                if (swipe.offsetX > 96) {
                    onClose();
                } else {
                    onSwipeChange(null);
                }
            }}
            style={
                {
                    '--map-side-panel-heading-color':
                        stringConfig(theme, 'sidePanelHeadingColor') ??
                        stringConfig(theme, 'accentColor'),
                    background:
                        stringConfig(theme, 'sidePanelBackground') ?? '#111820',
                    borderColor:
                        stringConfig(theme, 'sidePanelBorderColor') ??
                        'rgba(255,255,255,0.1)',
                    color:
                        stringConfig(theme, 'sidePanelTextColor') ?? '#e2e8f0',
                    transform:
                        node && swipe?.offsetX
                            ? `translateX(${swipe.offsetX}px)`
                            : undefined,
                } as CSSProperties
            }
        >
            {node ? (
                <div className="flex h-full min-h-[44vh] flex-col gap-5 overflow-y-auto overscroll-contain p-5 md:p-7">
                    <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium tracking-[0.18em] [color:var(--map-side-panel-heading-color)] text-cyan-700 uppercase dark:text-teal-200/78">
                                Learning place
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
                                {node.title}
                            </h2>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            {completed ? (
                                <span
                                    aria-label="Node completed"
                                    className="grid size-9 place-items-center rounded-md text-emerald-600 dark:text-emerald-300"
                                    title="Completed"
                                >
                                    <CheckCircle2 className="size-4" />
                                </span>
                            ) : null}
                            {canBookmark ? (
                                <button
                                    aria-label={
                                        bookmarked
                                            ? 'Remove bookmark'
                                            : 'Bookmark this tile'
                                    }
                                    className="grid size-9 place-items-center rounded-md hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
                                    disabled={isBookmarking}
                                    onClick={() => onToggleBookmark(node)}
                                    type="button"
                                >
                                    <Bookmark
                                        className={`size-4 ${bookmarked ? 'fill-cyan-600 text-cyan-600 dark:fill-teal-200 dark:text-teal-200' : ''}`}
                                    />
                                </button>
                            ) : null}
                        </div>
                        <button
                            aria-label="Close node panel"
                            className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10"
                            onClick={onClose}
                            type="button"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {node.description}
                        </p>
                    </div>
                    {node.state === 'locked' ? (
                        <p className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm">
                            <LockKeyhole className="size-4" /> This place is
                            locked.
                        </p>
                    ) : null}
                    {node.state !== 'locked' ? (
                        <OriginalRouteStartButtons
                            appearance={appearance}
                            onReset={onReset}
                            onStart={onStart}
                            starts={startRoutes.filter(
                                (start) => start.node_slug === node.slug,
                            )}
                        />
                    ) : null}
                </div>
            ) : null}
        </aside>
    );
}

function completedNodeSlugsFrom(
    learnerState: LearnerWorldState | null,
): Set<string> {
    return new Set(
        learnerState?.activity_progress
            .filter((progress) => progress.status === 'completed')
            .map((progress) => progress.node_slug) ?? [],
    );
}

function mergedThemeConfig(
    ...configs: Array<Record<string, unknown> | undefined>
): Record<string, unknown> {
    return Object.assign(
        {},
        ...configs.filter((config): config is Record<string, unknown> =>
            Boolean(config),
        ),
    );
}

function stringConfig(
    config: Record<string, unknown>,
    key: string,
): string | undefined {
    const value = config[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function objectConfig(
    config: Record<string, unknown>,
    key: string,
): Record<string, unknown> {
    const value = config[key];

    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function numberConfig(
    config: Record<string, unknown>,
    key: string,
    fallback: number,
): number {
    const value = config[key];

    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function worldSurfaceStyle(config: Record<string, unknown>) {
    return {
        background: stringConfig(config, 'pageBackground') ?? '#0b1117',
        color: stringConfig(config, 'sidePanelTextColor') ?? '#e2e8f0',
    };
}

function mapPanelStyle(config: Record<string, unknown>) {
    return {
        background:
            stringConfig(config, 'panelBackground') ?? 'rgba(5, 15, 22, 0.72)',
        borderColor:
            stringConfig(config, 'panelBorderColor') ??
            stringConfig(config, 'cardBorderColor') ??
            'rgba(255,255,255,0.1)',
        color: stringConfig(config, 'panelTextColor') ?? '#e2e8f0',
    };
}

/**
 * The source learner header is parameterized by these variables. Keep the
 * same component-level contract while deriving its values from the selected
 * server-owned map theme instead of preserving the old Laravel page props.
 */
function learnerNavigationStyle(
    config: Record<string, unknown>,
): CSSProperties {
    const panelBackground =
        stringConfig(config, 'panelBackground') ?? 'rgba(5, 15, 22, 0.86)';
    const borderColor =
        stringConfig(config, 'panelBorderColor') ??
        stringConfig(config, 'cardBorderColor') ??
        'rgba(255,255,255,0.1)';
    const headingText =
        stringConfig(config, 'panelTextColor') ??
        stringConfig(config, 'sidePanelTextColor') ??
        '#e2e8f0';
    const accent = stringConfig(config, 'accentColor') ?? '#2dd4bf';

    return {
        background: 'var(--learner-header-background)',
        borderColor: 'var(--learner-border-color)',
        '--learner-accent': accent,
        '--learner-action-accent': accent,
        '--learner-border-color': borderColor,
        '--learner-header-background': panelBackground,
        '--learner-heading-text': headingText,
        '--learner-muted-text':
            stringConfig(config, 'panelMutedTextColor') ?? headingText,
        '--learner-panel-background': panelBackground,
        '--learner-panel-muted-background': `color-mix(in srgb, ${accent} 16%, transparent)`,
    } as CSSProperties;
}

function floatingPanelStyle(config: Record<string, unknown>) {
    return {
        background:
            stringConfig(config, 'panelBackground') ?? 'rgba(5, 15, 22, 0.86)',
        borderColor:
            stringConfig(config, 'panelBorderColor') ??
            stringConfig(config, 'cardBorderColor') ??
            'rgba(255,255,255,0.1)',
        color: stringConfig(config, 'panelTextColor') ?? '#e2e8f0',
    };
}
