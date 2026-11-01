import { useEffect, useState } from 'react';

import { apiClient } from './api/client';

type Readiness = 'checking' | 'ready' | 'unavailable';
type PageState =
  | { kind: 'loading' }
  | { kind: 'loaded'; body: string; title: string }
  | { kind: 'unavailable' };

export function App() {
  const [readiness, setReadiness] = useState<Readiness>('checking');
  const [page, setPage] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    void apiClient
      .GET('/health/ready')
      .then(({ error }) => setReadiness(error ? 'unavailable' : 'ready'))
      .catch(() => setReadiness('unavailable'));

    void apiClient
      .GET('/public/pages/{slug}', { params: { path: { slug: 'about' } } })
      .then(({ data, error }) => {
        if (error || !data) {
          setPage({ kind: 'unavailable' });
          return;
        }

        setPage({ kind: 'loaded', body: data.body, title: data.title });
      })
      .catch(() => setPage({ kind: 'unavailable' }));
  }, []);

  return (
    <main>
      <p className="eyebrow">Rust/Axum foundation</p>
      <h1>{page.kind === 'loaded' ? page.title : 'Wicked Learning'}</h1>
      {page.kind === 'loading' ? <p aria-live="polite">Loading public information…</p> : null}
      {page.kind === 'loaded' ? (
        <div className="page-body">
          {page.body.split('\n\n').map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      {page.kind === 'unavailable' ? (
        <p role="alert">Public information is temporarily unavailable.</p>
      ) : null}
      <p aria-live="polite" className={`status ${readiness}`}>
        API status: {readiness}
      </p>
    </main>
  );
}
