import { type CSSProperties, type FormEvent, useEffect, useState } from 'react';
import {
    Link,
    Navigate,
    NavLink,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
    useSearchParams,
} from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Readiness = 'checking' | 'ready' | 'unavailable';
type PageState =
    | { kind: 'loading' }
    | { kind: 'loaded'; body: string; title: string }
    | { kind: 'not-found' }
    | { kind: 'unavailable' };
type SourceLinksState =
    | { kind: 'loading' }
    | {
          kind: 'loaded';
          modifiedSources: Array<{ label: string; url: string }>;
          origin: { label: string; url: string };
      }
    | { kind: 'unavailable' };
type CurrentUserState =
    | { kind: 'loading' }
    | { kind: 'anonymous' }
    | { kind: 'loaded'; roles: string[] }
    | { kind: 'unavailable' };
type PublicWorld = components['schemas']['PublicWorld'];
type WorldState =
    | { kind: 'loading' }
    | { kind: 'loaded'; world: PublicWorld }
    | { kind: 'empty' }
    | { kind: 'unavailable' };
type PublicSearch = components['schemas']['PublicSearch'];
type SearchState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; search: PublicSearch }
    | { kind: 'invalid' }
    | { kind: 'unavailable' };
type PublicMapAssetDetail = components['schemas']['PublicMapAssetDetail'];
type MapAssetState =
    | { kind: 'loading' }
    | { kind: 'loaded'; asset: PublicMapAssetDetail }
    | { kind: 'not-found' }
    | { kind: 'unavailable' };
type PublicRouteOutline = components['schemas']['PublicRouteOutline'];
type RouteState =
    | { kind: 'loading' }
    | { kind: 'loaded'; route: PublicRouteOutline }
    | { kind: 'not-found' }
    | { kind: 'unavailable' };

const publicSlugs = ['about', 'imprint', 'data-protection'] as const;

export function App() {
    const [readiness, setReadiness] = useState<Readiness>('checking');

    useEffect(() => {
        void apiClient
            .GET('/health/ready')
            .then(({ error }) => setReadiness(error ? 'unavailable' : 'ready'))
            .catch(() => setReadiness('unavailable'));
    }, []);

    return (
        <div className="learner-shell">
            <a className="skip-link" href="#learner-main-content">
                Skip to content
            </a>
            <header className="learner-header">
                <div className="learner-header-inner">
                    <NavLink className="learner-brand" to="/world">
                        <span aria-hidden="true" className="learner-brand-mark">
                            WL
                        </span>
                        <span>Wicked Learning</span>
                    </NavLink>
                    <nav
                        aria-label="Learner navigation"
                        className="learner-navigation"
                    >
                        <NavLink to="/world">Explore</NavLink>
                        <NavLink to="/search">Search</NavLink>
                        <NavLink to="/about">About</NavLink>
                        {publicSlugs.slice(1).map((slug) => (
                            <NavLink key={slug} to={`/${slug}`}>
                                {labelFor(slug)}
                            </NavLink>
                        ))}
                        <NavLink to="/source">Source code</NavLink>
                    </nav>
                    <NavLink className="account-link" to="/login">
                        Local sign in
                    </NavLink>
                </div>
            </header>
            <main className="learner-main" id="learner-main-content">
                <Routes>
                    <Route
                        path="/"
                        element={<Navigate replace to="/about" />}
                    />
                    <Route
                        path="/learning/search"
                        element={<LegacySearchRedirect />}
                    />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/source" element={<SourceCodePage />} />
                    <Route path="/world" element={<WorldPage />} />
                    <Route
                        path="/world/:worldSlug/maps/:mapSlug/assets/:assetSlug"
                        element={<MapAssetPage />}
                    />
                    <Route
                        path="/world/:worldSlug/maps/:mapSlug/assets/:assetSlug/routes/:routeSlug"
                        element={<RoutePage />}
                    />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/:slug" element={<PublicPage />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </main>
            <footer className="learner-footer">
                <p aria-live="polite" className={`status ${readiness}`}>
                    API status: {readiness}
                </p>
            </footer>
        </div>
    );
}

function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
    const [search, setSearch] = useState<SearchState>({ kind: 'idle' });

    async function searchPlaces(queryToSearch: string) {
        const normalizedQuery = queryToSearch.trim();
        if (normalizedQuery.length < 2 || normalizedQuery.length > 80) {
            setSearch({ kind: 'invalid' });
            return;
        }

        setSearch({ kind: 'loading' });
        try {
            const { data, response } = await apiClient.GET('/public/search', {
                params: { query: { q: normalizedQuery } },
            });
            if (response.status === 400) {
                setSearch({ kind: 'invalid' });
                return;
            }
            if (!response.ok || !data) {
                setSearch({ kind: 'unavailable' });
                return;
            }

            setSearch({ kind: 'loaded', search: data });
        } catch {
            setSearch({ kind: 'unavailable' });
        }
    }

    useEffect(() => {
        const requestedQuery = searchParams.get('q');
        if (!requestedQuery) {
            return;
        }

        setQuery(requestedQuery);
        void searchPlaces(requestedQuery);
    }, [searchParams]);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const normalizedQuery = query.trim();
        setSearchParams(normalizedQuery ? { q: normalizedQuery } : {});
    }

    return (
        <article>
            <h1>Search the learning world</h1>
            <p>
                Searches only look through published places in this fresh public
                world.
            </p>
            <form className="credential-form" onSubmit={submit}>
                <label>
                    Search places
                    <input
                        maxLength={80}
                        minLength={2}
                        onChange={(event) =>
                            setQuery(event.currentTarget.value)
                        }
                        required
                        type="search"
                        value={query}
                    />
                </label>
                <button type="submit">Search</button>
            </form>
            {search.kind === 'loading' ? (
                <p aria-live="polite">Searching places…</p>
            ) : null}
            {search.kind === 'invalid' ? (
                <p role="alert">
                    Enter between 2 and 80 characters to search places.
                </p>
            ) : null}
            {search.kind === 'unavailable' ? (
                <p role="alert">Search is temporarily unavailable.</p>
            ) : null}
            {search.kind === 'loaded' ? (
                search.search.results.length ? (
                    <ul className="search-results">
                        {search.search.results.map((result) => (
                            <li key={`${result.map_slug}-${result.asset_slug}`}>
                                <h2>
                                    <Link
                                        to={mapAssetPath(
                                            result.world_slug,
                                            result.map_slug,
                                            result.asset_slug,
                                        )}
                                    >
                                        {result.title}
                                    </Link>
                                </h2>
                                <p>{result.description}</p>
                                <p className="eyebrow">{result.map_title}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No published places match “{search.search.query}”.</p>
                )
            ) : null}
        </article>
    );
}

function LegacySearchRedirect() {
    const location = useLocation();
    const legacyQuery = new URLSearchParams(location.search).get('query');
    const search = legacyQuery ? `?q=${encodeURIComponent(legacyQuery)}` : '';

    return <Navigate replace to={`/search${search}`} />;
}

function WorldPage() {
    const [world, setWorld] = useState<WorldState>({ kind: 'loading' });

    useEffect(() => {
        void apiClient
            .GET('/public/world')
            .then(({ data, response }) => {
                if (response.status === 404) {
                    setWorld({ kind: 'empty' });
                    return;
                }
                if (!response.ok || !data) {
                    setWorld({ kind: 'unavailable' });
                    return;
                }

                setWorld({ kind: 'loaded', world: data });
            })
            .catch(() => setWorld({ kind: 'unavailable' }));
    }, []);

    if (world.kind === 'loading') {
        return <p aria-live="polite">Loading the learning world…</p>;
    }
    if (world.kind === 'empty') {
        return <p>The learning world is not published yet.</p>;
    }
    if (world.kind === 'unavailable') {
        return (
            <p role="alert">The learning world is temporarily unavailable.</p>
        );
    }

    return (
        <article className="world-surface">
            <section className="world-introduction">
                <p className="eyebrow">Explore</p>
                <h1>{world.world.title}</h1>
                <p>{world.world.description}</p>
            </section>
            {world.world.maps.map((map) => (
                <section className="world-map" key={map.slug}>
                    <div className="world-map-heading">
                        <div>
                            <p className="eyebrow">Map</p>
                            <h2>{map.title}</h2>
                        </div>
                        <p>{map.description}</p>
                    </div>
                    <div
                        className="world-map-stage"
                        role="region"
                        aria-label={`${map.title} map`}
                    >
                        <div aria-hidden="true" className="world-map-grid" />
                        {map.assets.map((asset) => (
                            <Link
                                aria-label={`Open ${asset.title} on ${map.title}`}
                                className="world-map-place"
                                key={asset.slug}
                                style={
                                    {
                                        '--map-place-x': `${asset.x}%`,
                                        '--map-place-y': `${asset.y}%`,
                                    } as CSSProperties
                                }
                                to={mapAssetPath(
                                    world.world.slug,
                                    map.slug,
                                    asset.slug,
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className="world-map-place-marker"
                                >
                                    {asset.title.slice(0, 1)}
                                </span>
                                <span className="world-map-place-label">
                                    {asset.title}
                                </span>
                            </Link>
                        ))}
                    </div>
                    <section
                        aria-labelledby={`${map.slug}-places`}
                        className="world-place-list"
                    >
                        <div className="world-place-list-heading">
                            <h3 id={`${map.slug}-places`}>Available places</h3>
                            <p>
                                Choose a place to see its available learning
                                routes.
                            </p>
                        </div>
                        <ul>
                            {map.assets.map((asset) => (
                                <li key={asset.slug}>
                                    <h4>
                                        <Link
                                            to={mapAssetPath(
                                                world.world.slug,
                                                map.slug,
                                                asset.slug,
                                            )}
                                        >
                                            {asset.title}
                                        </Link>
                                    </h4>
                                    <p>{asset.description}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                </section>
            ))}
        </article>
    );
}

function MapAssetPage() {
    const { assetSlug, mapSlug, worldSlug } = useParams();
    const [asset, setAsset] = useState<MapAssetState>({ kind: 'loading' });

    useEffect(() => {
        if (!assetSlug || !mapSlug || !worldSlug) {
            setAsset({ kind: 'not-found' });
            return;
        }

        void apiClient
            .GET(
                '/public/worlds/{world_slug}/maps/{map_slug}/assets/{asset_slug}',
                {
                    params: {
                        path: {
                            asset_slug: assetSlug,
                            map_slug: mapSlug,
                            world_slug: worldSlug,
                        },
                    },
                },
            )
            .then(({ data, response }) => {
                if (response.status === 404) {
                    setAsset({ kind: 'not-found' });
                    return;
                }
                if (!response.ok || !data) {
                    setAsset({ kind: 'unavailable' });
                    return;
                }

                setAsset({ kind: 'loaded', asset: data });
            })
            .catch(() => setAsset({ kind: 'unavailable' }));
    }, [assetSlug, mapSlug, worldSlug]);

    if (asset.kind === 'loading') {
        return <p aria-live="polite">Loading this place…</p>;
    }
    if (asset.kind === 'not-found') {
        return (
            <article>
                <h1>Place not found</h1>
                <p>This published place is not available.</p>
                <p>
                    <Link to="/world">Back to exploration</Link>
                </p>
            </article>
        );
    }
    if (asset.kind === 'unavailable') {
        return <p role="alert">This place is temporarily unavailable.</p>;
    }

    return (
        <article>
            <p className="eyebrow">
                {asset.asset.world_title} / {asset.asset.map_title}
            </p>
            <h1>{asset.asset.title}</h1>
            <p>{asset.asset.description}</p>
            <h2>Available routes</h2>
            {asset.asset.routes.length ? (
                <ul className="search-results">
                    {asset.asset.routes.map((route) => (
                        <li key={route.slug}>
                            <h3>
                                <Link
                                    to={routePath(
                                        asset.asset.world_slug,
                                        asset.asset.map_slug,
                                        asset.asset.slug,
                                        route.slug,
                                    )}
                                >
                                    {route.title}
                                </Link>
                            </h3>
                            <p>{route.description}</p>
                            <p className="eyebrow">
                                {route.activity_count}{' '}
                                {route.activity_count === 1
                                    ? 'activity'
                                    : 'activities'}
                            </p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No routes are published for this place yet.</p>
            )}
            <p>
                <Link to="/world">Back to exploration</Link>
            </p>
        </article>
    );
}

function RoutePage() {
    const { assetSlug, mapSlug, routeSlug, worldSlug } = useParams();
    const [route, setRoute] = useState<RouteState>({ kind: 'loading' });
    const placePath =
        assetSlug && mapSlug && worldSlug
            ? mapAssetPath(worldSlug, mapSlug, assetSlug)
            : '/world';

    useEffect(() => {
        if (!assetSlug || !mapSlug || !routeSlug || !worldSlug) {
            setRoute({ kind: 'not-found' });
            return;
        }

        void apiClient
            .GET(
                '/public/worlds/{world_slug}/maps/{map_slug}/assets/{asset_slug}/routes/{route_slug}',
                {
                    params: {
                        path: {
                            asset_slug: assetSlug,
                            map_slug: mapSlug,
                            route_slug: routeSlug,
                            world_slug: worldSlug,
                        },
                    },
                },
            )
            .then(({ data, response }) => {
                if (response.status === 404) {
                    setRoute({ kind: 'not-found' });
                    return;
                }
                if (!response.ok || !data) {
                    setRoute({ kind: 'unavailable' });
                    return;
                }

                setRoute({ kind: 'loaded', route: data });
            })
            .catch(() => setRoute({ kind: 'unavailable' }));
    }, [assetSlug, mapSlug, routeSlug, worldSlug]);

    if (route.kind === 'loading') {
        return <p aria-live="polite">Loading this route…</p>;
    }
    if (route.kind === 'not-found') {
        return (
            <article>
                <h1>Route not found</h1>
                <p>This published route is not available.</p>
                <p>
                    <Link to={placePath}>Back to the place</Link>
                </p>
            </article>
        );
    }
    if (route.kind === 'unavailable') {
        return <p role="alert">This route is temporarily unavailable.</p>;
    }

    return (
        <article>
            <p className="eyebrow">
                {route.route.world_title} / {route.route.map_title} /{' '}
                {route.route.asset_title}
            </p>
            <h1>{route.route.title}</h1>
            <p>{route.route.description}</p>
            <h2>Activities in this route</h2>
            {route.route.activities.length ? (
                <ol className="search-results">
                    {route.route.activities.map((activity) => (
                        <li key={activity.slug}>
                            <h3>{activity.title}</h3>
                            <p>{activity.description}</p>
                        </li>
                    ))}
                </ol>
            ) : (
                <p>No activities are published for this route yet.</p>
            )}
            <p>
                This route is an outline only; starting and recording activities
                will be added separately.
            </p>
            <p>
                <Link to={placePath}>Back to the place</Link>
            </p>
        </article>
    );
}

function mapAssetPath(
    worldSlug: string,
    mapSlug: string,
    assetSlug: string,
): string {
    return `/world/${worldSlug}/maps/${mapSlug}/assets/${assetSlug}`;
}

function routePath(
    worldSlug: string,
    mapSlug: string,
    assetSlug: string,
    routeSlug: string,
): string {
    return `${mapAssetPath(worldSlug, mapSlug, assetSlug)}/routes/${routeSlug}`;
}

function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/session/login', {
                body: { email, password },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (response.status === 401) {
                setError('The email address or password is not valid.');
                return;
            }
            if (!response.ok || !data) {
                setError('Sign in is temporarily unavailable.');
                return;
            }

            navigate('/account', { replace: true });
        } catch {
            setError('Sign in is temporarily unavailable.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <article>
            <h1>Local sign in</h1>
            <p>
                This is the Rust replatforming proof of concept. Only a securely
                bootstrapped local administrator can sign in; registration,
                recovery, MFA and passkeys are not available yet.
            </p>
            <form className="credential-form" onSubmit={submit}>
                <label>
                    Email address
                    <input
                        autoComplete="username"
                        onChange={(event) =>
                            setEmail(event.currentTarget.value)
                        }
                        required
                        type="email"
                        value={email}
                    />
                </label>
                <label>
                    Password
                    <input
                        autoComplete="current-password"
                        onChange={(event) =>
                            setPassword(event.currentTarget.value)
                        }
                        required
                        type="password"
                        value={password}
                    />
                </label>
                {error ? <p role="alert">{error}</p> : null}
                <button disabled={submitting} type="submit">
                    {submitting ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </article>
    );
}

function AccountPage() {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<CurrentUserState>({
        kind: 'loading',
    });

    useEffect(() => {
        void apiClient
            .GET('/me')
            .then(({ data, response }) => {
                if (response.status === 401) {
                    setCurrentUser({ kind: 'anonymous' });
                    return;
                }
                if (!response.ok || !data) {
                    setCurrentUser({ kind: 'unavailable' });
                    return;
                }

                setCurrentUser({ kind: 'loaded', roles: data.roles });
            })
            .catch(() => setCurrentUser({ kind: 'unavailable' }));
    }, []);

    async function logout() {
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/session/logout', {
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok) {
                setError('Sign out is temporarily unavailable.');
                return;
            }

            navigate('/login', { replace: true });
        } catch {
            setError('Sign out is temporarily unavailable.');
        }
    }

    if (currentUser.kind === 'loading') {
        return <p aria-live="polite">Loading account status…</p>;
    }
    if (currentUser.kind === 'anonymous') {
        return (
            <article>
                <h1>Sign in required</h1>
                <p>
                    This local proof of concept has no authenticated session in
                    this browser.
                </p>
                <NavLink to="/login">Sign in</NavLink>
            </article>
        );
    }
    if (currentUser.kind === 'unavailable') {
        return <p role="alert">Account status is temporarily unavailable.</p>;
    }

    return (
        <article>
            <h1>Account</h1>
            <p>Your current application roles:</p>
            <ul>
                {currentUser.roles.map((role) => (
                    <li key={role}>{role.replaceAll('_', ' ')}</li>
                ))}
            </ul>
            {error ? <p role="alert">{error}</p> : null}
            <button onClick={() => void logout()} type="button">
                Sign out
            </button>
        </article>
    );
}

function SourceCodePage() {
    const [links, setLinks] = useState<SourceLinksState>({ kind: 'loading' });

    useEffect(() => {
        void apiClient
            .GET('/public/source-links')
            .then(({ data }) => {
                if (!data) {
                    setLinks({ kind: 'unavailable' });
                    return;
                }

                setLinks({
                    kind: 'loaded',
                    modifiedSources: data.modified_sources,
                    origin: data.origin,
                });
            })
            .catch(() => setLinks({ kind: 'unavailable' }));
    }, []);

    if (links.kind === 'loading') {
        return <p aria-live="polite">Loading source-code links…</p>;
    }
    if (links.kind === 'unavailable') {
        return (
            <p role="alert">Source-code links are temporarily unavailable.</p>
        );
    }

    return (
        <article>
            <h1>Source code</h1>
            <p>
                This page points to the source code for the original project
                and, when configured, source locations for modified versions.
            </p>
            <ul>
                <li>
                    <a href={links.origin.url} rel="noreferrer" target="_blank">
                        {links.origin.label}
                    </a>
                </li>
                {links.modifiedSources.map((link) => (
                    <li key={link.url}>
                        <a href={link.url} rel="noreferrer" target="_blank">
                            {link.label}
                        </a>
                    </li>
                ))}
            </ul>
        </article>
    );
}

function PublicPage() {
    const { slug } = useParams();
    const [page, setPage] = useState<PageState>({ kind: 'loading' });

    useEffect(() => {
        if (
            !slug ||
            !publicSlugs.includes(slug as (typeof publicSlugs)[number])
        ) {
            setPage({ kind: 'not-found' });
            return;
        }

        setPage({ kind: 'loading' });
        void apiClient
            .GET('/public/pages/{slug}', { params: { path: { slug } } })
            .then(({ data, response }) => {
                if (response.status === 404) {
                    setPage({ kind: 'not-found' });
                    return;
                }
                if (!data) {
                    setPage({ kind: 'unavailable' });
                    return;
                }

                setPage({ kind: 'loaded', body: data.body, title: data.title });
            })
            .catch(() => setPage({ kind: 'unavailable' }));
    }, [slug]);

    if (page.kind === 'loading') {
        return <p aria-live="polite">Loading public information…</p>;
    }
    if (page.kind === 'not-found') {
        return <NotFound />;
    }
    if (page.kind === 'unavailable') {
        return (
            <p role="alert">Public information is temporarily unavailable.</p>
        );
    }

    return (
        <article>
            <h1>{page.title}</h1>
            <div className="page-body">
                {page.body.split('\n\n').map((paragraph, index) => (
                    <p key={`${index}-${paragraph}`}>{paragraph}</p>
                ))}
            </div>
        </article>
    );
}

function NotFound() {
    return (
        <article>
            <h1>Page not found</h1>
            <p>The requested public information page is not available.</p>
        </article>
    );
}

function labelFor(slug: (typeof publicSlugs)[number]): string {
    return {
        about: 'About',
        imprint: 'Imprint',
        'data-protection': 'Data protection',
    }[slug];
}
