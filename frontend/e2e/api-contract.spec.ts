import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const publicOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('the public-page endpoint returns the contracted resource and missing-resource problem', async ({
  request,
}) => {
  const pageResponse = await request.get('/api/v1/public/pages/about');

  expect(pageResponse.status()).toBe(200);
  expect(pageResponse.headers()['content-type']).toContain('application/json');
  await expect(pageResponse.json()).resolves.toMatchObject({
    slug: 'about',
    title: 'About Wicked Learning',
    body: expect.stringContaining('curiosity'),
  });

  const imprintResponse = await request.get('/api/v1/public/pages/imprint');

  expect(imprintResponse.status()).toBe(200);
  await expect(imprintResponse.json()).resolves.toMatchObject({
    slug: 'imprint',
    title: 'Imprint',
    body: expect.stringContaining('deployment-specific publisher information'),
  });

  const dataProtectionResponse = await request.get('/api/v1/public/pages/data-protection');

  expect(dataProtectionResponse.status()).toBe(200);
  await expect(dataProtectionResponse.json()).resolves.toMatchObject({
    slug: 'data-protection',
    title: 'Data Protection',
    body: expect.stringContaining('privacy and data protection information'),
  });

  const missingResponse = await request.get('/api/v1/public/pages/not-published');

  expect(missingResponse.status()).toBe(404);
  await expect(missingResponse.json()).resolves.toEqual({
    code: 'not_found',
    title: 'The requested resource was not found.',
  });
});

test('the public source-links endpoint returns only browser-safe link data', async ({ request }) => {
  const response = await request.get('/api/v1/public/source-links');

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    origin: {
      label: 'Original project',
      url: 'https://github.com/WickedJack99/wicked_learning',
    },
    modified_sources: [],
  });
});

test('the public world endpoint returns a bounded fresh exploration graph', async ({ request }) => {
  const response = await request.get('/api/v1/public/world');

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    slug: 'orientation-garden',
    title: 'Orientation Garden',
    maps: [
      {
        slug: 'first-path',
        title: 'The First Path',
        assets: [
          { slug: 'notice-the-map', interaction_mode: 'focusable' },
          { slug: 'choose-a-direction', interaction_mode: 'focusable' },
        ],
      },
    ],
  });
});

test('an anonymous session reveals no credential or identity material', async ({ request }) => {
  const response = await request.get('/api/v1/session');

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    authenticated: false,
    subject_id: null,
  });

  const currentUserResponse = await request.get('/api/v1/me');
  expect(currentUserResponse.status()).toBe(401);
  await expect(currentUserResponse.json()).resolves.toEqual({
    code: 'authentication_required',
    title: 'Authentication is required.',
  });
});

test('the CSRF foundation issues a non-cacheable token and protected cookie', async ({ request }) => {
  const response = await request.get('/api/v1/security/csrf');

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['set-cookie']).toContain('wicked_learning_csrf=');
  expect(response.headers()['set-cookie']).toContain('HttpOnly');
  expect(response.headers()['set-cookie']).toContain('SameSite=Strict');
  await expect(response.json()).resolves.toMatchObject({
    token: expect.stringMatching(/^[A-Za-z0-9+/]+={0,2}$/),
  });
});

test('a CI-only fresh identity can login, report its session, and logout', async ({ request }) => {
  const email = process.env.E2E_LOGIN_EMAIL;
  const password = process.env.E2E_LOGIN_PASSWORD;
  test.skip(!email || !password, 'requires the disposable CI identity');

  const csrfResponse = await request.get('/api/v1/security/csrf');
  const { token } = await csrfResponse.json();
  const login = await request.post('/api/v1/session/login', {
    headers: {
      Origin: publicOrigin,
      'X-CSRF-Token': token,
    },
    data: { email, password },
  });

  expect(login.status()).toBe(200);
  const session = await login.json();
  expect(session).toMatchObject({
    authenticated: true,
    subject_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });

  const currentSession = await request.get('/api/v1/session');
  await expect(currentSession.json()).resolves.toEqual(session);

  const currentUser = await request.get('/api/v1/me');
  expect(currentUser.status()).toBe(200);
  await expect(currentUser.json()).resolves.toEqual({
    subject_id: session.subject_id,
    roles: ['platform_administrator'],
  });

  const logout = await request.post('/api/v1/session/logout', {
    headers: {
      Origin: publicOrigin,
      'X-CSRF-Token': token,
    },
  });
  expect(logout.status()).toBe(204);

  const loggedOutSession = await request.get('/api/v1/session');
  await expect(loggedOutSession.json()).resolves.toEqual({
    authenticated: false,
    subject_id: null,
  });
});

test('unsafe browser requests require same-origin CSRF and login returns generic invalid credentials', async ({
  request,
}) => {
  const csrfResponse = await request.get('/api/v1/security/csrf');
  const { token } = await csrfResponse.json();
  const body = { email: 'nobody@example.test', password: 'not-a-real-password' };

  const missingToken = await request.post('/api/v1/session/logout', {
    headers: { Origin: publicOrigin },
  });
  expect(missingToken.status()).toBe(403);

  const foreignOrigin = await request.post('/api/v1/session/logout', {
    headers: {
      Origin: 'https://untrusted.example',
      'X-CSRF-Token': token,
    },
  });
  expect(foreignOrigin.status()).toBe(403);

  const invalidCredentials = await request.post('/api/v1/session/login', {
    headers: {
      Origin: publicOrigin,
      'X-CSRF-Token': token,
    },
    data: body,
  });
  expect(invalidCredentials.status()).toBe(401);
  await expect(invalidCredentials.json()).resolves.toEqual({
    code: 'invalid_credentials',
    title: 'The email address or password is not valid.',
  });
});

test('the same-origin entry point has the required browser security headers', async ({ request }) => {
  const response = await request.get('/about');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(response.headers()['cross-origin-resource-policy']).toBe('same-origin');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
});
