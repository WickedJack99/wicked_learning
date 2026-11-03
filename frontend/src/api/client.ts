import createClient from 'openapi-fetch';

import type { paths } from './schema';

const API_TIMEOUT_MILLISECONDS = 10_000;

const sameOriginFetch: typeof fetch = async (input, init) => {
  const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MILLISECONDS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    signal,
  });
};

export const apiClient = createClient<paths>({
  baseUrl: '/api/v1',
  fetch: sameOriginFetch,
});

export async function getCsrfToken(): Promise<string> {
  const { data, response } = await apiClient.GET('/security/csrf');
  if (!response.ok || !data) {
    throw new Error('The security token is unavailable.');
  }

  return data.token;
}
