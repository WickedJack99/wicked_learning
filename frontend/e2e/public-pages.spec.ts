import { expect, test } from '@playwright/test';

test('the root redirects to and renders the public About page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { name: 'About Wicked Learning' })).toBeVisible();
  await expect(
    page.getByText('It does not use point totals, competitive rankings or streak pressure.'),
  ).toBeVisible();
});

test('all public-information navigation entries resolve to their published pages', async ({ page }) => {
  await page.goto('/about');

  await page.getByRole('link', { name: 'Imprint' }).click();
  await expect(page).toHaveURL(/\/imprint$/);
  await expect(page.getByRole('heading', { name: 'Imprint' })).toBeVisible();
  await expect(page.getByText('deployment-specific publisher information')).toBeVisible();

  await page.getByRole('link', { name: 'Data protection' }).click();
  await expect(page).toHaveURL(/\/data-protection$/);
  await expect(page.getByRole('heading', { name: 'Data Protection' })).toBeVisible();
  await expect(page.getByText('privacy and data protection information')).toBeVisible();
});

test('the source-code page provides the original project link safely', async ({ page }) => {
  await page.goto('/about');

  await page.getByRole('link', { name: 'Source code' }).click();
  await expect(page).toHaveURL(/\/source$/);
  await expect(page.getByRole('heading', { name: 'Source code' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original project' })).toHaveAttribute(
    'href',
    'https://github.com/WickedJack99/wicked_learning',
  );
  await expect(page.getByRole('link', { name: 'Original project' })).toHaveAttribute(
    'rel',
    'noreferrer',
  );
});

test('the public explorer presents maps and places without requiring a session', async ({ page }) => {
  await page.goto('/about');

  await page.getByRole('link', { name: 'Explore' }).click();
  await expect(page).toHaveURL(/\/world$/);
  await expect(page.getByRole('heading', { name: 'Orientation Garden' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The First Path' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notice the map' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose a direction' })).toBeVisible();
});

test('a learner can open a map place and inspect its route previews', async ({ page }) => {
  await page.goto('/world');

  await page.getByRole('link', { name: 'Choose a direction' }).click();

  await expect(page).toHaveURL(
    /\/world\/orientation-garden\/maps\/first-path\/assets\/choose-a-direction$/,
  );
  await expect(page.getByRole('heading', { name: 'Choose a direction' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Available routes' })).toBeVisible();
  await expect(page.getByText('1 activity')).toBeVisible();
  await page.getByRole('link', { name: 'Choose your next step' }).click();
  await expect(page).toHaveURL(
    /\/world\/orientation-garden\/maps\/first-path\/assets\/choose-a-direction\/routes\/choose-your-next-step$/,
  );
  await expect(page.getByRole('heading', { name: 'Activities in this route' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consider a direction' })).toBeVisible();
});

test('a missing public map place has its own recoverable not-found state', async ({ page }) => {
  await page.goto('/world/orientation-garden/maps/first-path/assets/not-published');

  await expect(page.getByRole('heading', { name: 'Place not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to exploration' }).click();
  await expect(page).toHaveURL(/\/world$/);
});

test('the public explorer search is bounded and presents matching places', async ({ page }) => {
  await page.goto('/about');

  await page.getByRole('link', { name: 'Search' }).click();
  await page.getByLabel('Search places').fill('direction');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.getByRole('heading', { name: 'Choose a direction' })).toBeVisible();
  await expect(page.getByText('The First Path')).toBeVisible();
});

test('a CI-only local administrator can use the React sign-in and sign-out flow', async ({ page }) => {
  const email = process.env.E2E_LOGIN_EMAIL;
  const password = process.env.E2E_LOGIN_PASSWORD;
  test.skip(!email || !password, 'requires the disposable CI identity');

  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
  await expect(page.getByText('platform administrator')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Local sign in' })).toBeVisible();
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
