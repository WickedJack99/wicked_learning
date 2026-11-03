import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
    BookOpen,
    LockKeyhole,
    Map as MapIcon,
    MapPin,
    RadioTower,
    Search,
    Signpost,
    X,
} from 'lucide-react';

import { apiClient } from './api/client';
import type { components } from './api/schema';

type PublicMap = components['schemas']['PublicMap'];
type PublicMapAsset = components['schemas']['PublicMapAsset'];
type PublicNode = components['schemas']['PublicNode'];
type PublicWorld = components['schemas']['PublicWorld'];

type WorldState =
    | { kind: 'loading' }
    | { kind: 'loaded'; world: PublicWorld }
    | { kind: 'empty' }
    | { kind: 'unavailable' };

type SearchState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; results: components['schemas']['PublicSearchResult'][] }
    | { kind: 'unavailable' };

const hexTileClipPath =
    'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';

export function PublicWorldPage({
    isAuthenticated,
}: {
    isAuthenticated: boolean;
}) {
    const [worldState, setWorldState] = useState<WorldState>({
        kind: 'loading',
    });

    useEffect(() => {
        void apiClient
            .GET('/public/world')
            .then(({ data, response }) => {
                if (response.status === 404) {
                    setWorldState({ kind: 'empty' });
                    return;
                }

                if (!response.ok || !data) {
                    setWorldState({ kind: 'unavailable' });
                    return;
                }

                setWorldState({ kind: 'loaded', world: data });
            })
            .catch(() => setWorldState({ kind: 'unavailable' }));
    }, []);

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
    world,
}: {
    isAuthenticated: boolean;
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

    function selectNode(node: PublicNode | null, map = selectedMap): void {
        if (!map) {
            return;
        }

        const next = new URLSearchParams(searchParams);
        next.set('map', map.slug);
        if (node) {
            next.set('focused', node.slug);
        } else {
            next.delete('focused');
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
            <WorldNavigation isAuthenticated={isAuthenticated} />
            <section className="absolute inset-0 overflow-hidden">
                <PublicMapSurface
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
                map={selectedMap}
                node={selectedNode}
                onClose={() => selectNode(null)}
                world={world}
            />
        </main>
    );
}

function WorldNavigation({ isAuthenticated }: { isAuthenticated: boolean }) {
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
                <Link
                    className="ml-auto inline-flex shrink-0 items-center rounded-lg border px-3 py-2 text-sm font-medium text-slate-100 no-underline transition hover:bg-white/10"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
                    to={isAuthenticated ? '/account' : '/login'}
                >
                    {isAuthenticated ? 'Account' : 'Local sign in'}
                </Link>
            </div>
        </header>
    );
}

function PublicMapSurface({
    map,
    onClearFocus,
    onSelectNode,
    selectedNode,
}: {
    map: PublicMap;
    onClearFocus: () => void;
    onSelectNode: (node: PublicNode) => void;
    selectedNode: PublicNode | null;
}) {
    const theme = map.background_config;
    const nodesByAssetSlug = useMemo(
        () => new Map(map.nodes.flatMap((node) => (node.asset_slug ? [[node.asset_slug, node] as const] : []))),
        [map.nodes],
    );

    return (
        <div
            className="relative h-full min-h-[56vh] overflow-hidden select-none"
            onClick={onClearFocus}
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
            <div className="pointer-events-none absolute inset-0 z-20">
                {map.assets.map((asset) => {
                    const node = nodesByAssetSlug.get(asset.slug) ?? null;
                    const canOpen = asset.interaction_mode === 'focusable' && node;
                    const selected = node?.slug === selectedNode?.slug;
                    const assetTheme = mergedThemeConfig(
                        node?.visual_config,
                        asset.visual_config,
                    );
                    const label =
                        stringConfig(assetTheme, 'label') ?? node?.title ?? asset.text ?? asset.title;
                    const tileColor = stringConfig(assetTheme, 'tileColor') ?? '#12343b';
                    const highlightColor = stringConfig(assetTheme, 'highlightColor') ?? '#7dd3fc';
                    const labelColor = stringConfig(assetTheme, 'labelColor') ?? '#ffffff';
                    const Icon = iconFor(assetTheme);
                    const style = {
                        left: `${asset.x}%`,
                        opacity: asset.opacity,
                        top: `${asset.y}%`,
                        width: `${asset.width}%`,
                        zIndex: asset.z + 20,
                    };

                    const content = (
                        <>
                            <span
                                className="absolute inset-0"
                                style={{ background: tileColor, clipPath: hexTileClipPath }}
                            />
                            <span
                                className="absolute inset-[7px] bg-black/14"
                                style={{ clipPath: hexTileClipPath }}
                            />
                            {asset.image_url ? (
                                <img
                                    alt=""
                                    className="absolute inset-[7px] size-[calc(100%-14px)] object-contain"
                                    src={asset.image_url}
                                    style={{ clipPath: hexTileClipPath }}
                                />
                            ) : null}
                            <span
                                className="pointer-events-none absolute inset-0 transition-opacity duration-150"
                                style={{
                                    background: highlightColor,
                                    clipPath: hexTileClipPath,
                                    filter: 'drop-shadow(0 0 12px var(--tile-highlight))',
                                    opacity: selected ? 0.72 : 0,
                                }}
                            />
                            <span className="relative z-10 flex size-full flex-col items-center justify-center gap-2 px-5 text-center">
                                {!asset.image_url ? (
                                    <Icon
                                        aria-hidden="true"
                                        className="size-7"
                                        style={{ color: stringConfig(assetTheme, 'foregroundColor') ?? '#ccfbf1' }}
                                    />
                                ) : null}
                                <span className="text-xs leading-tight font-medium" style={{ color: labelColor }}>
                                    {label}
                                </span>
                            </span>
                            {node?.state === 'locked' ? (
                                <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center" style={{ clipPath: hexTileClipPath }}>
                                    <LockKeyhole className="size-11 text-white/45" />
                                </span>
                            ) : null}
                        </>
                    );

                    if (!canOpen) {
                        return (
                            <div
                                aria-hidden="true"
                                className="absolute -translate-x-1/2 -translate-y-1/2"
                                key={asset.slug}
                                style={style}
                            >
                                <div className="relative aspect-square overflow-hidden">{content}</div>
                            </div>
                        );
                    }

                    return (
                        <button
                            aria-label={`${label}, ${node.state === 'locked' ? 'locked' : 'open location'}`}
                            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 text-left transition-transform duration-200 hover:z-20 hover:-translate-y-[calc(50%+0.25rem)] focus-visible:z-20 focus-visible:outline-none"
                            key={asset.slug}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (node.state !== 'locked' && node.state !== 'hidden') {
                                    onSelectNode(node);
                                }
                            }}
                            style={style}
                            type="button"
                        >
                            <span className="relative block aspect-square overflow-hidden">{content}</span>
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
    map,
    node,
    onClose,
    world,
}: {
    map: PublicMap;
    node: PublicNode | null;
    onClose: () => void;
    world: PublicWorld;
}) {
    const theme = map.background_config;
    const asset = node?.asset_slug ? map.assets.find((candidate) => candidate.slug === node.asset_slug) : null;
    const placePath = asset
        ? `/world/${world.slug}/maps/${map.slug}/assets/${asset.slug}`
        : null;

    return (
        <aside
            aria-label="Selected learning place"
            className={`absolute inset-x-0 top-0 bottom-0 z-50 w-full border-l shadow-2xl transition-transform duration-300 ease-out md:left-auto md:max-w-[420px] ${node ? 'translate-x-0' : 'pointer-events-none translate-x-full'}`}
            style={{
                background: stringConfig(theme, 'sidePanelBackground') ?? '#111820',
                borderColor: stringConfig(theme, 'sidePanelBorderColor') ?? 'rgba(255,255,255,0.1)',
                color: stringConfig(theme, 'sidePanelTextColor') ?? '#e2e8f0',
            }}
        >
            {node ? (
                <div className="flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="m-0 text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: stringConfig(theme, 'accentColor') ?? '#5eead4' }}>
                                Learning place
                            </p>
                            <h2 className="mt-3 mb-0 text-2xl font-semibold" style={{ color: stringConfig(theme, 'sidePanelHeadingColor') ?? stringConfig(theme, 'sidePanelTextColor') ?? '#f8fafc' }}>
                                {node.title}
                            </h2>
                        </div>
                        <button aria-label="Close place details" className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-white/10" onClick={onClose} type="button">
                            <X className="size-5" />
                        </button>
                    </div>
                    <p className="mt-6 text-sm leading-6 opacity-85">{node.description}</p>
                    {node.state === 'locked' ? (
                        <p className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm"><LockKeyhole className="size-4" /> This place is locked.</p>
                    ) : null}
                    {placePath ? (
                        <Link className="mt-auto inline-flex items-center gap-2 text-sm font-medium underline decoration-white/35 underline-offset-4 transition hover:decoration-current" to={placePath}>
                            <BookOpen className="size-4" />
                            View available routes
                        </Link>
                    ) : null}
                </div>
            ) : null}
        </aside>
    );
}

function iconFor(config: Record<string, unknown>) {
    switch (stringConfig(config, 'icon')) {
        case 'map':
        case 'map-pin':
            return MapPin;
        case 'signpost':
            return Signpost;
        default:
            return RadioTower;
    }
}

function mergedThemeConfig(...configs: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
    return Object.assign({}, ...configs.filter((config): config is Record<string, unknown> => Boolean(config)));
}

function stringConfig(config: Record<string, unknown>, key: string): string | undefined {
    const value = config[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
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
