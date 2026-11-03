import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useParams } from 'react-router';

import { apiClient } from './api/client';

type Readiness = 'checking' | 'ready' | 'unavailable';
type PageState =
  | { kind: 'loading' }
  | { kind: 'loaded'; body: string; title: string }
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
    <main>
      <header className="site-header">
        <p className="eyebrow">Wicked Learning</p>
        <nav aria-label="Public information">
          {publicSlugs.map((slug) => (
            <NavLink key={slug} to={`/${slug}`}>
              {labelFor(slug)}
            </NavLink>
          ))}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Navigate replace to="/about" />} />
        <Route path="/:slug" element={<PublicPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <p aria-live="polite" className={`status ${readiness}`}>
        API status: {readiness}
      </p>
    </main>
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
