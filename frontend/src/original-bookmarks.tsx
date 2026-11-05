import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, Bookmark, MapPin, X } from 'lucide-react';
import { Link, Navigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { PublicMapAssetVisual } from './public-map-asset-visual';

type BookmarkMap = components['schemas']['LearnerBookmarkMap'];
type BookmarkPlace = components['schemas']['LearnerBookmarkPlace'];

type BookmarkState =
    | { kind: 'loading' }
    | { kind: 'loaded'; bookmarkMap: BookmarkMap }
    | { kind: 'unavailable' };

/**
 * Source-adapted from `resources/js/pages/bookmarks.tsx`. It keeps the
 * original personal-map, selected-place and remove-bookmark workflow while
 * replacing Inertia props and JSON helpers with the typed Rust API client.
 */
export function OriginalBookmarksPage({
    isAuthenticationLoading,
    isAuthenticated,
}: {
    isAuthenticationLoading: boolean;
    isAuthenticated: boolean;
}) {
    const [bookmarkState, setBookmarkState] = useState<BookmarkState>({
        kind: 'loading',
    });
    const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(
        null,
    );

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        let isCurrent = true;

        void apiClient.GET('/learner/bookmarks').then(({ data, response }) => {
            if (!isCurrent) {
                return;
            }
            if (response.ok && data) {
                setBookmarkState({ kind: 'loaded', bookmarkMap: data });
                return;
            }
            setBookmarkState({ kind: 'unavailable' });
        }).catch(() => {
            if (isCurrent) {
                setBookmarkState({ kind: 'unavailable' });
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [isAuthenticated]);

    const bookmarkMap =
        bookmarkState.kind === 'loaded' ? bookmarkState.bookmarkMap : null;
    const selectedPlace = useMemo(
        () =>
            bookmarkMap?.places.find(
                (place) => bookmarkPlaceKey(place) === selectedPlaceKey,
            ) ?? null,
        [bookmarkMap?.places, selectedPlaceKey],
    );

    if (isAuthenticationLoading) {
        return <BookmarksMessage message="Loading bookmarked places…" />;
    }
    if (!isAuthenticated) {
        return <Navigate replace to="/login" />;
    }
    if (bookmarkState.kind === 'loading') {
        return <BookmarksMessage message="Loading bookmarked places…" />;
    }
    if (bookmarkState.kind === 'unavailable' || !bookmarkMap) {
        return <BookmarksMessage message="Bookmarked places are temporarily unavailable." />;
    }

    async function removeBookmark(place: BookmarkPlace): Promise<void> {
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/learner/maps/{map_slug}/nodes/{node_slug}/bookmark',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            map_slug: place.map_slug,
                            node_slug: place.node_slug,
                        },
                    },
                },
            );
            if (!response.ok) {
                return;
            }
            setBookmarkState((current) =>
                current.kind !== 'loaded'
                    ? current
                    : {
                          kind: 'loaded',
                          bookmarkMap: {
                              ...current.bookmarkMap,
                              places: current.bookmarkMap.places.filter(
                                  (candidate) =>
                                      bookmarkPlaceKey(candidate) !==
                                      bookmarkPlaceKey(place),
                              ),
                          },
                      },
            );
            setSelectedPlaceKey(null);
        } catch {
            // The original keeps the existing personal map after a failed
            // request, so a learner can safely retry the explicit action.
        }
    }

    return (
        <main
            className="relative min-h-svh overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
            data-wl-id="learner.bookmarks.page"
            id="learner-main-content"
            style={bookmarkMapStyle(bookmarkMap.background_config)}
            tabIndex={-1}
        >
            <section className="absolute inset-0 overflow-hidden">
                {bookmarkMap.places.length > 0 ? (
                    <BookmarkMapSurface
                        bookmarkMap={bookmarkMap}
                        onClearFocus={() => setSelectedPlaceKey(null)}
                        onSelectPlace={(place) =>
                            setSelectedPlaceKey(bookmarkPlaceKey(place))
                        }
                        selectedPlace={selectedPlace}
                    />
                ) : (
                    <EmptyBookmarksState />
                )}
            </section>

            <aside
                aria-label="Selected bookmarked place"
                className={`absolute inset-x-0 top-28 bottom-0 z-50 w-full border-l border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-300 ease-out sm:top-16 md:left-auto md:max-w-[420px] dark:border-white/10 dark:bg-[#111820] dark:text-slate-100 ${selectedPlace ? 'translate-x-0' : 'pointer-events-none translate-x-full'}`}
                style={bookmarkPanelStyle(bookmarkMap.background_config)}
            >
                {selectedPlace ? (
                    <BookmarkPanel
                        place={selectedPlace}
                        onClose={() => setSelectedPlaceKey(null)}
                        onRemove={() => void removeBookmark(selectedPlace)}
                    />
                ) : null}
            </aside>
        </main>
    );
}

function BookmarksMessage({ message }: { message: string }) {
    return (
        <main className="flex min-h-svh items-center justify-center bg-[#0b1117] p-6 text-slate-100">
            <p role="alert">{message}</p>
        </main>
    );
}

function BookmarkMapSurface({
    bookmarkMap,
    onClearFocus,
    onSelectPlace,
    selectedPlace,
}: {
    bookmarkMap: BookmarkMap;
    onClearFocus: () => void;
    onSelectPlace: (place: BookmarkPlace) => void;
    selectedPlace: BookmarkPlace | null;
}) {
    const background = bookmarkMap.background_config;

    return (
        <div
            className="relative h-full min-h-[56vh] overflow-hidden select-none"
            onClick={onClearFocus}
        >
            {stringConfig(background, 'imageUrl') ? (
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center transition-opacity"
                    style={{
                        backgroundImage: `url(${stringConfig(background, 'imageUrl')})`,
                    }}
                />
            ) : null}
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        stringConfig(background, 'overlay') ??
                        'rgba(0, 0, 0, 0.4)',
                }}
            />
            <div
                className="pointer-events-none absolute inset-0 z-20"
                data-wl-id="learner.bookmarks.map-assets"
            >
                {bookmarkMap.places.map((place) => {
                    const asset = place.asset;
                    if (!asset) {
                        return null;
                    }

                    const visualConfig = mergeConfig(
                        place.visual_config,
                        asset.visual_config,
                    );
                    const selected =
                        bookmarkPlaceKey(place) ===
                        (selectedPlace
                            ? bookmarkPlaceKey(selectedPlace)
                            : null);
                    const label =
                        stringConfig(visualConfig, 'label') ??
                        place.title ??
                        asset.text ??
                        asset.title;

                    return (
                        <button
                            aria-label={`${label}, open bookmarked place`}
                            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 text-center focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:outline-none"
                            key={bookmarkPlaceKey(place)}
                            onClick={(event) => {
                                event.stopPropagation();
                                onSelectPlace(place);
                            }}
                            style={{
                                left: `${asset.x}%`,
                                opacity: asset.opacity,
                                top: `${asset.y}%`,
                                width: `${asset.width}%`,
                                zIndex: asset.z + 20,
                            }}
                            type="button"
                        >
                            <PublicMapAssetVisual
                                backgroundColor={
                                    stringConfig(visualConfig, 'borderColor') ??
                                    stringConfig(visualConfig, 'tileColor') ??
                                    '#12343b'
                                }
                                highlightBorderColor={
                                    stringConfig(
                                        visualConfig,
                                        'highlightBorderColor',
                                    ) ??
                                    stringConfig(visualConfig, 'highlightColor')
                                }
                                highlightColor={stringConfig(
                                    visualConfig,
                                    'highlightColor',
                                )}
                                highlightImageEnabled={
                                    visualConfig.highlightImageEnabled === true
                                }
                                highlightImageUrl={stringConfig(
                                    visualConfig,
                                    'highlightImageUrl',
                                )}
                                highlighted={selected}
                                highlightedLabelColor={stringConfig(
                                    visualConfig,
                                    'highlightedLabelColor',
                                )}
                                imageFit={stringConfig(visualConfig, 'imageFit')}
                                imagePosition={stringConfig(
                                    visualConfig,
                                    'imagePosition',
                                )}
                                imageUrl={asset.image_url}
                                label={label}
                                labelColor={stringConfig(
                                    visualConfig,
                                    'labelColor',
                                )}
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function EmptyBookmarksState() {
    return (
        <div className="grid h-full place-items-center px-6 text-center">
            <div className="max-w-sm rounded-lg border border-slate-200 bg-white/82 p-6 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                <Bookmark className="mx-auto mb-4 size-10 text-cyan-700 dark:text-teal-200" />
                <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">
                    No bookmarks yet
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Open a node on the world map and use the bookmark icon to
                    add it to your personal map.
                </p>
                <Link
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white shadow transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    to="/world"
                >
                    Open world map
                </Link>
            </div>
        </div>
    );
}

function BookmarkPanel({
    onClose,
    onRemove,
    place,
}: {
    onClose: () => void;
    onRemove: () => void;
    place: BookmarkPlace;
}) {
    return (
        <div className="flex h-full min-h-[44vh] flex-col gap-5 overflow-y-auto overscroll-contain p-5 md:p-7">
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/78">
                        Bookmarked place
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
                        {place.title}
                    </h2>
                </div>
                <button
                    aria-label="Close bookmark panel"
                    className="grid size-9 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10"
                    onClick={onClose}
                    type="button"
                >
                    <X className="size-4" />
                </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-teal-100">
                    <MapPin className="size-4" />
                    <span>{place.map_title}</span>
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {place.description || 'No summary has been added yet.'}
                </p>
                {place.state === 'locked' ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        This node is visible but currently locked. You can still
                        use it for orientation.
                    </p>
                ) : null}
            </div>

            <div className="mt-auto grid gap-3">
                <Link
                    className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white/90 px-4 text-sm font-medium text-slate-950 transition hover:bg-cyan-50 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
                    to={`/world?map=${encodeURIComponent(place.map_slug)}&focused=${encodeURIComponent(place.node_slug)}`}
                >
                    Go to node
                    <ArrowRight className="ml-2 size-4" />
                </Link>
                <button
                    className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium transition hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10"
                    onClick={onRemove}
                    type="button"
                >
                    <Bookmark className="mr-2 size-4 fill-current" />
                    Remove bookmark
                </button>
            </div>
        </div>
    );
}

function bookmarkPlaceKey(place: BookmarkPlace): string {
    return `${place.map_slug}\u0000${place.node_slug}`;
}

function mergeConfig(
    nodeConfig: Record<string, unknown>,
    assetConfig: Record<string, unknown>,
): Record<string, unknown> {
    return { ...assetConfig, ...nodeConfig };
}

function stringConfig(
    config: Record<string, unknown>,
    key: string,
): string | undefined {
    const value = config[key];

    return typeof value === 'string' && value.trim() ? value : undefined;
}

function bookmarkMapStyle(
    config: Record<string, unknown>,
): CSSProperties {
    return {
        background: stringConfig(config, 'pageBackground') ?? '#0b1117',
        color: stringConfig(config, 'sidePanelTextColor') ?? '#e2e8f0',
    };
}

function bookmarkPanelStyle(
    config: Record<string, unknown>,
): CSSProperties {
    return {
        background: stringConfig(config, 'sidePanelBackground') ?? '#111820',
        borderColor:
            stringConfig(config, 'sidePanelBorderColor') ??
            'rgba(255,255,255,0.1)',
        color: stringConfig(config, 'sidePanelTextColor') ?? '#e2e8f0',
    };
}
