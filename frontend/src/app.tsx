import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useParams } from 'react-router';

import { apiClient } from './api/client';

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
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Navigate replace to="/about" />} />
        <Route path="/source" element={<SourceCodePage />} />
        <Route path="/:slug" element={<PublicPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <p aria-live="polite" className={`status ${readiness}`}>
        API status: {readiness}
      </p>
    </main>
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
