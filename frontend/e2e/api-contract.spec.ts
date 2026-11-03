import { expect, test } from '@playwright/test';

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

  const missingResponse = await request.get('/api/v1/public/pages/not-published');

  expect(missingResponse.status()).toBe(404);
  await expect(missingResponse.json()).resolves.toEqual({
    code: 'not_found',
    title: 'The requested resource was not found.',
  });
});

test('an anonymous session reveals no credential or identity material', async ({ request }) => {
  const response = await request.get('/api/v1/session');

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    authenticated: false,
    subject_id: null,
  });
});
