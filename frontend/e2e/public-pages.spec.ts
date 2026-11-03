import { expect, test } from '@playwright/test';

test('the root redirects to and renders the public About page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { name: 'About Wicked Learning' })).toBeVisible();
  await expect(
    page.getByText('It does not use point totals, competitive rankings or streak pressure.'),
  ).toBeVisible();
});

test('an unavailable public-page API is presented without a stale page', async ({ page }) => {
  await page.route('**/api/v1/public/pages/about', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'dependency_unavailable',
        title: 'A required service is unavailable.',
      }),
    });
  });

  await page.goto('/about');

  await expect(page.getByRole('alert')).toHaveText(
    'Public information is temporarily unavailable.',
  );
  await expect(page.getByRole('heading', { name: 'About Wicked Learning' })).not.toBeVisible();
});

test('unknown browser routes render the client-side not-found state', async ({ page }) => {
  await page.goto('/not-a-public-page');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByText('The requested public information page is not available.')).toBeVisible();
});
