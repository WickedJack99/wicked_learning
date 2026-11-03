import { type FormEvent, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router';

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
    <main>
      <header className="site-header">
        <p className="eyebrow">Wicked Learning</p>
        <nav aria-label="Public information">
          {publicSlugs.map((slug) => (
            <NavLink key={slug} to={`/${slug}`}>
              {labelFor(slug)}
            </NavLink>
          ))}
          <NavLink to="/source">Source code</NavLink>
          <NavLink to="/world">Explore</NavLink>
          <NavLink to="/login">Local sign in</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Navigate replace to="/about" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/source" element={<SourceCodePage />} />
        <Route path="/world" element={<WorldPage />} />
        <Route path="/:slug" element={<PublicPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <p aria-live="polite" className={`status ${readiness}`}>
        API status: {readiness}
      </p>
    </main>
  );
}

function WorldPage() {
  const [world, setWorld] = useState<WorldState>({ kind: 'loading' });

  useEffect(() => {
    void apiClient.GET('/public/world').then(({ data, response }) => {
      if (response.status === 404) {
        setWorld({ kind: 'empty' });
        return;
      }
      if (!response.ok || !data) {
        setWorld({ kind: 'unavailable' });
        return;
      }

      setWorld({ kind: 'loaded', world: data });
    }).catch(() => setWorld({ kind: 'unavailable' }));
  }, []);

  if (world.kind === 'loading') {
    return <p aria-live="polite">Loading the learning world…</p>;
  }
  if (world.kind === 'empty') {
    return <p>The learning world is not published yet.</p>;
  }
  if (world.kind === 'unavailable') {
    return <p role="alert">The learning world is temporarily unavailable.</p>;
  }

  return (
    <article>
      <h1>{world.world.title}</h1>
      <p>{world.world.description}</p>
      {world.world.maps.map((map) => (
        <section className="world-map" key={map.slug}>
          <h2>{map.title}</h2>
          <p>{map.description}</p>
          <ul>
            {map.assets.map((asset) => (
              <li key={asset.slug}>
                <h3>{asset.title}</h3>
                <p>{asset.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
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
        This is the Rust replatforming proof of concept. Only a securely bootstrapped local
        administrator can sign in; registration, recovery, MFA and passkeys are not available yet.
      </p>
      <form className="credential-form" onSubmit={submit}>
        <label>
          Email address
          <input
            autoComplete="username"
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.currentTarget.value)}
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
  const [currentUser, setCurrentUser] = useState<CurrentUserState>({ kind: 'loading' });

  useEffect(() => {
    void apiClient.GET('/me').then(({ data, response }) => {
      if (response.status === 401) {
        setCurrentUser({ kind: 'anonymous' });
        return;
      }
      if (!response.ok || !data) {
        setCurrentUser({ kind: 'unavailable' });
        return;
      }

      setCurrentUser({ kind: 'loaded', roles: data.roles });
    }).catch(() => setCurrentUser({ kind: 'unavailable' }));
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
        <p>This local proof of concept has no authenticated session in this browser.</p>
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
    void apiClient.GET('/public/source-links').then(({ data }) => {
      if (!data) {
        setLinks({ kind: 'unavailable' });
        return;
      }

      setLinks({
        kind: 'loaded',
        modifiedSources: data.modified_sources,
        origin: data.origin,
      });
    }).catch(() => setLinks({ kind: 'unavailable' }));
  }, []);

  if (links.kind === 'loading') {
    return <p aria-live="polite">Loading source-code links…</p>;
  }
  if (links.kind === 'unavailable') {
    return <p role="alert">Source-code links are temporarily unavailable.</p>;
  }

  return (
    <article>
      <h1>Source code</h1>
      <p>
        This page points to the source code for the original project and, when configured,
        source locations for modified versions.
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
    if (!slug || !publicSlugs.includes(slug as (typeof publicSlugs)[number])) {
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
    return <p role="alert">Public information is temporarily unavailable.</p>;
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
