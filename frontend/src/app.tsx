import { useEffect, useState } from 'react';

import { apiClient } from './api/client';

type Readiness = 'checking' | 'ready' | 'unavailable';

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
      <p className="eyebrow">Rust/Axum foundation</p>
      <h1>Wicked Learning</h1>
      <p>
        The independently built React client is connected to the Axum API at the
        same public origin.
      </p>
      <p aria-live="polite" className={`status ${readiness}`}>
        API status: {readiness}
      </p>
    </main>
  );
}
