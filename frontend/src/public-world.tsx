import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
    ArrowRight,
    Bookmark,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    LockKeyhole,
    Map as MapIcon,
    MapPin,
    PlayCircle,
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
    | 'bookmarked_node_slugs'
    | 'route_progress'
    | 'start_routes'
>;
type LearnerActivityStart = components['schemas']['LearnerActivityStart'];
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
    isAuthenticated,
    onSignedOut,
    userEmail,
}: {
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
                    const { data, response } = await apiClient.GET(
                        '/learner/world',
                    );

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
                                bookmarked_node_slugs:
                                    data.bookmarked_node_slugs,
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
        return <WorldMessage message="The learning world is not published yet." />;
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
    isAuthenticated,
    learnerState,
    onSignedOut,
    userEmail,
    world,
}: {
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
    const completedNodeSlugs = useMemo(
        () => completedNodeSlugsFrom(learnerState),
        [learnerState],
    );
    const [panelSwipe, setPanelSwipe] = useState<PanelSwipe | null>(null);

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

    if (!selectedMap) {
        return <WorldMessage message="The learning world has no published maps yet." />;
    }

    return (
        <main
            className="public-world relative min-h-svh overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
            data-wl-id="public-world"
            style={worldSurfaceStyle(selectedMap.background_config)}
        >
            <WorldNavigation
                isAuthenticated={isAuthenticated}
                onSignedOut={onSignedOut}
                userEmail={userEmail}
            />
            <section className="absolute inset-0 overflow-hidden">
                <PublicMapSurface
                    bookmarkedNodeSlugs={learnerState?.bookmarked_node_slugs ?? []}
                    completedNodeSlugs={completedNodeSlugs}
                    map={selectedMap}
                    onClearFocus={() => selectNode(null)}
                    onSelectNode={selectNode}
                    selectedNode={selectedNode}
                />
            </section>

            <WorldSearch
                map={selectedMap}
                onSelectMap={selectMap}
                onSelectNode={selectNode}
                world={world}
            />

            {world.maps.length > 1 ? (
                <nav
                    aria-label="Published maps"
                    className="absolute right-5 bottom-5 z-20 flex max-w-[calc(100%-2.5rem)] gap-2 overflow-x-auto rounded-xl border p-2 shadow-2xl backdrop-blur-md"
                    style={floatingPanelStyle(selectedMap.background_config)}
                >
                    {world.maps.map((map) => (
                        <button
                            aria-current={map.slug === selectedMap.slug ? 'page' : undefined}
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
                bookmarked={selectedNode ? learnerState?.bookmarked_node_slugs.includes(selectedNode.slug) ?? false : false}
                completed={selectedNode ? completedNodeSlugs.has(selectedNode.slug) : false}
                isAuthenticated={isAuthenticated}
                map={selectedMap}
                node={selectedNode}
                onClose={() => selectNode(null)}
                onSwipeChange={setPanelSwipe}
                starts={selectedNode ? learnerState?.start_routes.filter((start) => start.node_slug === selectedNode.slug) ?? [] : []}
                swipe={panelSwipe}
            />
        </main>
    );
}

function WorldNavigation({
    isAuthenticated,
    onSignedOut,
    userEmail,
}: {
    isAuthenticated: boolean;
    onSignedOut: () => void;
    userEmail: string | null;
}) {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
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
            style={{
                background: 'rgba(7, 17, 31, 0.84)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
        >
            <a
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-[80] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-950"
                href="#learner-main-content"
            >
                Skip to content
            </a>
            <div className="flex min-h-16 flex-wrap items-center gap-x-5 px-4 sm:px-6 lg:px-8 xl:flex-nowrap">
                <Link className="flex shrink-0 items-center gap-3 text-slate-100 no-underline" to="/world">
                    <MapIcon aria-hidden="true" className="size-8 text-teal-300" />
                    <span className="hidden text-sm font-semibold tracking-wide sm:block">Wicked Learning</span>
                </Link>
                <nav
                    aria-label="Learner navigation"
                    className="order-3 -mx-4 flex w-[calc(100%+2rem)] basis-full flex-wrap gap-0 border-t px-4 xl:order-none xl:mx-0 xl:min-w-0 xl:flex-1 xl:flex-nowrap xl:border-t-0 xl:px-0"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
                >
                    <Link
                        aria-current="page"
                        className="relative inline-flex shrink-0 items-center gap-2 px-3 py-3 text-sm text-teal-200 no-underline after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-teal-300 xl:py-[1.35rem]"
                        to="/world"
                    >
                        Current map
                    </Link>
                </nav>
                {isAuthenticated && userEmail ? (
                    <div className="relative ml-auto shrink-0">
                        <button
                            aria-expanded={isUserMenuOpen}
                            aria-haspopup="menu"
                            aria-label="Open user menu"
                            className="grid size-10 place-items-center rounded-full border text-sm font-medium text-slate-100 transition hover:bg-white/10"
                            onClick={() => setIsUserMenuOpen((open) => !open)}
                            style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
                            type="button"
                        >
                            {userEmail.slice(0, 1).toUpperCase()}
                        </button>
                        {isUserMenuOpen ? (
                            <div
                                className="absolute top-12 right-0 z-[80] grid min-w-56 gap-2 rounded-lg border bg-slate-950 p-2 shadow-2xl"
                                role="menu"
                                style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
                            >
                                <p className="truncate px-2 py-1 text-sm text-slate-300">
                                    {userEmail}
                                </p>
                                <button
                                    className="rounded-md px-2 py-2 text-left text-sm font-medium text-slate-100 transition hover:bg-white/10"
                                    onClick={() => void signOut()}
                                    role="menuitem"
                                    type="button"
                                >
                                    Log out
                                </button>
                                {signOutError ? (
                                    <p className="px-2 text-sm text-red-300" role="alert">
                                        {signOutError}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <Link
                        className="ml-auto inline-flex shrink-0 items-center rounded-lg border px-3 py-2 text-sm font-medium text-slate-100 no-underline transition hover:bg-white/10"
                        style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
                        to="/login"
                    >
                        Log in
                    </Link>
                )}
            </div>
        </header>
    );
}

function PublicMapSurface({
    bookmarkedNodeSlugs,
    completedNodeSlugs,
    map,
    onClearFocus,
    onSelectNode,
    selectedNode,
}: {
    bookmarkedNodeSlugs: string[];
    completedNodeSlugs: Set<string>;
    map: PublicMap;
    onClearFocus: () => void;
    onSelectNode: (node: PublicNode) => void;
    selectedNode: PublicNode | null;
}) {
    const theme = map.background_config;
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
        () => new Map(map.nodes.flatMap((node) => (node.asset_slug ? [[node.asset_slug, node] as const] : []))),
        [map.nodes],
    );
    const assetThemes = map.assets.map((asset) =>
        mergedThemeConfig(
            nodesByAssetSlug.get(asset.slug)?.visual_config,
            asset.visual_config,
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
        ? map.assets.findIndex((asset) => asset.slug === selectedNode.asset_slug)
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
                          imageAlphaMaskFor(alphaMaskRequests[index], alphaMasks),
                      )
                    : false;
                const hiddenForFocusedAsset =
                    selectedAsset &&
                    selectedAssetIndex >= 0 &&
                    (asset.z > selectedAsset.z ||
                        (asset.z === selectedAsset.z && index > selectedAssetIndex)) &&
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
                      imageAlphaMaskFor(
                          alphaMaskRequests[index],
                          alphaMasks,
                      ),
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
                    style={{ backgroundImage: `url(${stringConfig(theme, 'imageUrl')})` }}
                />
            ) : null}
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: stringConfig(theme, 'overlay') ?? 'rgba(0, 0, 0, 0.4)' }}
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
                        asset.interaction_mode === 'focusable' &&
                        node;
                    const canToggle = asset.interaction_mode === 'toggle';
                    const selected = node?.slug === selectedNode?.slug;
                    const isBookmarked = Boolean(
                        node && bookmarkedNodeSlugs.includes(node.slug),
                    );
                    const isCompleted = Boolean(
                        node && completedNodeSlugs.has(node.slug),
                    );
                    const isHidden = hiddenAssetSlugs.has(asset.slug);
                    const assetTheme = assetThemes[index];
                    const label =
                        stringConfig(assetTheme, 'label') ?? node?.title ?? asset.text ?? asset.title;
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
                                data-map-asset-visibility={isHidden ? 'hidden' : 'visible'}
                                key={asset.slug}
                                style={style}
                            >
                                <PublicMapAssetVisual
                                    backgroundColor={stringConfig(assetTheme, 'borderColor') ?? stringConfig(assetTheme, 'tileColor') ?? '#12343b'}
                                    highlightBorderColor={stringConfig(assetTheme, 'highlightBorderColor') ?? stringConfig(assetTheme, 'highlightColor')}
                                    highlightColor={stringConfig(assetTheme, 'highlightColor')}
                                    highlighted={false}
                                    highlightedLabelColor={stringConfig(assetTheme, 'highlightedLabelColor')}
                                    imageFit={stringConfig(assetTheme, 'imageFit')}
                                    imagePosition={stringConfig(assetTheme, 'imagePosition')}
                                    imageUrl={surface.imageUrl}
                                    label={label}
                                    labelColor={stringConfig(assetTheme, 'labelColor')}
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
                            data-map-asset-visibility={isHidden ? 'hidden' : 'visible'}
                            key={asset.slug}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (canToggle) {
                                    setToggledAssetSlugs((current) =>
                                        current.includes(asset.slug)
                                            ? current.filter((slug) => slug !== asset.slug)
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
                                backgroundColor={stringConfig(assetTheme, 'borderColor') ?? stringConfig(assetTheme, 'tileColor') ?? '#12343b'}
                                highlightBorderColor={stringConfig(assetTheme, 'highlightBorderColor') ?? stringConfig(assetTheme, 'highlightColor')}
                                highlightColor={stringConfig(assetTheme, 'highlightColor')}
                                highlightImageEnabled={assetTheme.highlightImageEnabled === true}
                                highlightImageUrl={stringConfig(assetTheme, 'highlightImageUrl')}
                                highlighted={isHighlighted}
                                highlightedLabelColor={stringConfig(assetTheme, 'highlightedLabelColor')}
                                imageFit={stringConfig(assetTheme, 'imageFit')}
                                imagePosition={stringConfig(assetTheme, 'imagePosition')}
                                imageUrl={surface.imageUrl}
                                label={label}
                                labelColor={stringConfig(assetTheme, 'labelColor')}
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
                <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: stringConfig(theme, 'accentColor') ?? '#ccfbf1' }}>
                    <MapIcon className="size-4" />
                    <span>Current map</span>
                </div>
                <h1 className="m-0 text-3xl font-semibold tracking-normal" style={{ color: stringConfig(theme, 'panelTextColor') ?? '#e2e8f0' }}>
                    {map.title}
                </h1>
                {map.description ? (
                    <p className="mt-3 mb-0 max-w-md text-sm leading-6" style={{ color: stringConfig(theme, 'panelMutedTextColor') ?? stringConfig(theme, 'panelTextColor') ?? '#e2e8f0' }}>
                        {map.description}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function assetSurface(asset: PublicMapAsset, secondState: boolean): {
    imageUrl: string | null;
    width: number;
    x: number;
    y: number;
} {
    const states = objectConfig(asset.interaction_config, 'states');
    const state = secondState ? objectConfig(states, 'second') : objectConfig(states, 'first');

    return {
        imageUrl: stringConfig(state, 'imageUrl') ?? asset.image_url,
        width: numberConfig(state, 'width', asset.width),
        x: numberConfig(state, 'x', asset.x),
        y: numberConfig(state, 'y', asset.y),
    };
}

function WorldSearch({
    map,
    onSelectMap,
    onSelectNode,
    world,
}: {
    map: PublicMap;
    onSelectMap: (map: PublicMap) => void;
    onSelectNode: (node: PublicNode, map: PublicMap) => void;
    world: PublicWorld;
}) {
    const [term, setTerm] = useState('');
    const [search, setSearch] = useState<SearchState>({ kind: 'idle' });

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

    function chooseResult(result: components['schemas']['PublicSearchResult']): void {
        const resultMap = world.maps.find((candidate) => candidate.slug === result.map_slug);
        if (!resultMap) {
            return;
        }
        const node = resultMap.nodes.find((candidate) => candidate.asset_slug === result.asset_slug);
        if (node) {
            onSelectNode(node, resultMap);
        } else {
            onSelectMap(resultMap);
        }
        setTerm('');
    }

    const theme = map.background_config;
    const hasSearch = term.trim().length > 0;
    return (
        <div className="absolute bottom-5 left-5 z-20 w-[min(24rem,calc(100%-2.5rem))]">
            {hasSearch ? (
                <div className="mb-2 rounded-xl border p-2 shadow-2xl backdrop-blur-md" style={floatingPanelStyle(theme)}>
                    {search.kind === 'loading' ? <p className="px-3 py-4 text-sm">Searching…</p> : null}
                    {search.kind === 'unavailable' ? <p className="px-3 py-4 text-sm">Search is temporarily unavailable.</p> : null}
                    {search.kind === 'loaded' && search.results.length === 0 ? <p className="px-3 py-4 text-sm">No visible maps or places found.</p> : null}
                    {search.kind === 'loaded' ? (
                        <div className="grid gap-1">
                            {search.results.map((result) => (
                                <button
                                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                                    key={`${result.map_slug}-${result.asset_slug}`}
                                    onClick={() => chooseResult(result)}
                                    type="button"
                                >
                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-300/12" style={{ color: stringConfig(theme, 'accentColor') ?? '#ccfbf1' }}>
                                        <MapPin className="size-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold">{result.title}</span>
                                        <span className="mt-0.5 block truncate text-xs opacity-75">{result.map_title}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
            <label className="flex items-center gap-2 rounded-xl border p-2 shadow-2xl backdrop-blur-md" style={floatingPanelStyle(theme)}>
                <Search className="ml-2 size-4 shrink-0 opacity-75" />
                <span className="sr-only">Search maps and places</span>
                <input
                    aria-label="Search maps and places"
                    className="h-9 border-0 bg-transparent px-1 text-current shadow-none outline-none placeholder:text-current/60"
                    onChange={(event) => setTerm(event.currentTarget.value)}
                    placeholder="Search maps and places"
                    type="search"
                    value={term}
                />
                {hasSearch ? (
                    <button aria-label="Clear search" className="grid size-9 place-items-center rounded-md hover:bg-white/10" onClick={() => setTerm('')} type="button">
                        <X className="size-4" />
                    </button>
                ) : null}
            </label>
        </div>
    );
}

function NodeDrawer({
    bookmarked,
    completed,
    isAuthenticated,
    map,
    node,
    onClose,
    onSwipeChange,
    starts,
    swipe,
}: {
    bookmarked: boolean;
    completed: boolean;
    isAuthenticated: boolean;
    map: PublicMap;
    node: PublicNode | null;
    onClose: () => void;
    onSwipeChange: (swipe: PanelSwipe | null) => void;
    starts: LearnerActivityStart[];
    swipe: PanelSwipe | null;
}) {
    const theme = map.background_config;

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
                    color: stringConfig(theme, 'sidePanelTextColor') ?? '#e2e8f0',
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
                            {completed ? <span aria-label="Node completed" className="grid size-9 place-items-center rounded-md text-emerald-600 dark:text-emerald-300" title="Completed"><CheckCircle2 className="size-4" /></span> : null}
                            {bookmarked ? <span aria-label="Saved place" className="grid size-9 place-items-center rounded-md text-cyan-600 dark:text-teal-200"><Bookmark className="size-4 fill-current" /></span> : null}
                        </div>
                        <button aria-label="Close node panel" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button">
                            <X className="size-5" />
                        </button>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6"><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{node.description}</p></div>
                    {node.state === 'locked' ? (
                        <p className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm"><LockKeyhole className="size-4" /> This place is locked.</p>
                    ) : null}
                    {isAuthenticated ? (
                        <ActivityStartButtons starts={starts} />
                    ) : null}
                </div>
            ) : null}
        </aside>
    );
}

function ActivityStartButtons({
    starts,
}: {
    starts: LearnerActivityStart[];
}) {
    const [pageState, setPageState] = useState({
        nodeSlug: starts[0]?.node_slug ?? null,
        page: 1,
    });
    const pageCount = Math.max(1, Math.ceil(starts.length / 3));
    const currentPage = Math.min(
        pageState.nodeSlug === (starts[0]?.node_slug ?? null)
            ? pageState.page
            : 1,
        pageCount,
    );
    const visibleStarts = starts.slice((currentPage - 1) * 3, currentPage * 3);

    if (!starts.length) {
        return (
            <EmptyActivityState message="No activity configured yet" />
        );
    }

    return (
        <section
            className="relative mt-auto flex shrink-0 flex-col pb-12 md:pb-14"
            data-wl-id="learner.world.activity-starts"
        >
            <div className="grid gap-2 px-1 pt-2 pb-1">
                {visibleStarts.map((start) => (
                    <ActivityStartPreview key={start.start_id} start={start} />
                ))}
            </div>
            <PaginationControls
                currentPage={currentPage}
                onPageChange={(page) =>
                    setPageState({
                        nodeSlug: starts[0]?.node_slug ?? null,
                        page,
                    })
                }
                pageCount={pageCount}
            />
        </section>
    );
}

function ActivityStartPreview({ start }: { start: LearnerActivityStart }) {
    const image = start.image_dark ?? start.image_light;
    const borderColor =
        start.button_border_color_dark ?? 'rgba(255, 255, 255, 0.1)';
    const buttonStyle = {
        ...(start.button_color_dark
            ? { backgroundColor: start.button_color_dark }
            : {}),
        backgroundClip: 'padding-box',
        boxShadow: `inset 0 0 0 2px ${borderColor}`,
    };
    const progress = activityStartProgressText(start.progress);

    return (
        <li className="grid gap-1.5">
            {image ? (
                <button
                    aria-describedby={`activity-start-${start.start_id}-availability`}
                    aria-label={`Start ${start.label}`}
                    className="group relative overflow-hidden rounded-lg bg-slate-950 text-left transition duration-200 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80 dark:focus-visible:ring-teal-200"
                    disabled
                    type="button"
                >
                    <img alt="" className="h-32 w-full object-cover" decoding="async" loading="lazy" src={image} />
                    <span className="absolute inset-x-0 top-0 z-[1] flex min-h-10 items-center justify-between gap-3 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-slate-950 backdrop-blur-md dark:bg-slate-950/82 dark:text-white" style={buttonStyle}>
                        <span className="inline-flex min-w-0 items-center gap-2">
                            <PlayCircle className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                            <span className="truncate">{start.label}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                    </span>
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] rounded-lg" style={{ boxShadow: `inset 0 0 0 2px ${borderColor}` }} />
                </button>
            ) : (
                <button
                    aria-describedby={`activity-start-${start.start_id}-availability`}
                    aria-label={`Start ${start.label}`}
                    className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-transparent bg-white/90 px-3 text-sm font-medium text-slate-950 shadow-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80 dark:bg-slate-950 dark:text-white dark:focus-visible:ring-teal-200"
                    disabled
                    style={buttonStyle}
                    type="button"
                >
                    <span className="inline-flex min-w-0 items-center gap-2">
                        <PlayCircle className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                        <span className="truncate">{start.label}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                </button>
            )}
            {progress ? <p className="m-0 px-1 text-xs opacity-70">{progress}</p> : null}
            {start.description ? <p className="m-0 px-1 text-xs leading-5 opacity-80">{start.description}</p> : null}
            <p className="m-0 px-1 text-xs leading-5 opacity-70" id={`activity-start-${start.start_id}-availability`}>
                Starting activities is not available in this preview yet.
            </p>
        </li>
    );
}

function EmptyActivityState({ message }: { message: string }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/15 dark:bg-slate-950/24">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {message}
            </p>
        </div>
    );
}

function PaginationControls({
    currentPage,
    onPageChange,
    pageCount,
}: {
    currentPage: number;
    onPageChange: (page: number) => void;
    pageCount: number;
}) {
    if (pageCount <= 1) {
        return null;
    }

    return (
        <nav
            aria-label="Activity start pagination"
            className="mt-2 flex min-h-8 items-center justify-between gap-3 px-1 text-xs text-slate-500 dark:text-slate-400"
        >
            <button
                className="inline-flex min-w-0 items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)] disabled:pointer-events-none disabled:opacity-40"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                type="button"
            >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Previous
            </button>
            <span aria-live="polite">Page {currentPage} of {pageCount}</span>
            <button
                className="inline-flex min-w-0 items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)] disabled:pointer-events-none disabled:opacity-40"
                disabled={currentPage === pageCount}
                onClick={() => onPageChange(currentPage + 1)}
                type="button"
            >
                Next
                <ChevronRight aria-hidden="true" className="size-4" />
            </button>
        </nav>
    );
}

function activityStartProgressText(
    progress: components['schemas']['LearnerActivityStartProgress'] | null,
): string | null {
    if (!progress) {
        return null;
    }

    if (progress.completion_count > 0) {
        return `Completed ${progress.completion_count}×`;
    }

    return progress.status === 'in_progress' ? 'In progress' : null;
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

function mergedThemeConfig(...configs: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
    return Object.assign({}, ...configs.filter((config): config is Record<string, unknown> => Boolean(config)));
}

function stringConfig(config: Record<string, unknown>, key: string): string | undefined {
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

    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function worldSurfaceStyle(config: Record<string, unknown>) {
    return {
        background: stringConfig(config, 'pageBackground') ?? '#0b1117',
        color: stringConfig(config, 'sidePanelTextColor') ?? '#e2e8f0',
    };
}

function mapPanelStyle(config: Record<string, unknown>) {
    return {
        background: stringConfig(config, 'panelBackground') ?? 'rgba(5, 15, 22, 0.72)',
        borderColor: stringConfig(config, 'panelBorderColor') ?? stringConfig(config, 'cardBorderColor') ?? 'rgba(255,255,255,0.1)',
        color: stringConfig(config, 'panelTextColor') ?? '#e2e8f0',
    };
}

function floatingPanelStyle(config: Record<string, unknown>) {
    return {
        background: stringConfig(config, 'panelBackground') ?? 'rgba(5, 15, 22, 0.86)',
        borderColor: stringConfig(config, 'panelBorderColor') ?? stringConfig(config, 'cardBorderColor') ?? 'rgba(255,255,255,0.1)',
        color: stringConfig(config, 'panelTextColor') ?? '#e2e8f0',
    };
}
