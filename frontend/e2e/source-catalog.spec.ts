import { expect, test } from './authenticated';

test('the source catalog consumes its fixed platform catalog copy', async ({ page }) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'source-catalog-admin@example.test',
                roles: ['administrator'],
                settings_access: { world_activities: true, world_maps: true, world_nodes: true },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.world_builder.source_catalog.concept_filter_label': 'Localized concept filter',
                    'settings.world_builder.source_catalog.description': 'Localized reusable citation guidance.',
                    'settings.world_builder.source_catalog.field_title': 'Localized citation title',
                    'settings.world_builder.source_catalog.new_title': 'Localized new citation',
                    'settings.world_builder.source_catalog.search_label': 'Localized source search',
                    'settings.world_builder.source_catalog.title': 'Localized source catalog',
                },
            }),
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps: [],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route('**/api/v1/admin/source-records**', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                items: [],
                pagination: { current_page: 1, last_page: 1, per_page: 12, total: 0 },
            }),
        });
    });

    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Source catalog' }).click();

    const catalog = page.locator('[data-wl-id="authoring.source-catalog"]');
    await expect(catalog.getByRole('heading', { name: 'Localized source catalog' })).toBeVisible();
    await expect(catalog.getByText('Localized reusable citation guidance.')).toBeVisible();
    await expect(catalog.getByLabel('Localized source search')).toBeVisible();
    await expect(catalog.getByLabel('Localized concept filter')).toBeVisible();
    await expect(catalog.getByRole('heading', { name: 'Localized new citation' })).toBeVisible();
    await expect(catalog.getByLabel('Localized citation title')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(catalog.getByLabel('Localized source search')).toBeVisible();
    const bounds = await catalog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});

test('a local author can maintain the source-adapted reusable source catalog', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Source catalog' }).click();
    const catalog = page.locator('[data-wl-id="authoring.source-catalog"]');
    await expect(catalog).toBeVisible();

    const title = `Source ${Date.now()}`;
    await catalog.getByLabel('Title').fill(title);
    await catalog.getByLabel('URL').fill('https://example.test/source');
    await catalog.getByLabel('Publisher').fill('Local publisher');
    await catalog.getByLabel('Concepts (comma-separated)').fill('retrieval, practice');
    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/admin/source-records'),
    );
    await catalog.getByRole('button', { name: 'Save source' }).click();
    expect((await created).status()).toBe(201);
    await expect(catalog.getByText(title, { exact: true })).toBeVisible();

    const updatedTitle = `${title} revised`;
    await catalog.getByLabel('Title').fill(updatedTitle);
    const updated = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/admin/source-records/'),
    );
    await catalog.getByRole('button', { name: 'Save source' }).click();
    expect((await updated).status()).toBe(200);
    await expect(catalog.getByText('Source history')).toBeVisible();
    await expect(catalog.getByText(title, { exact: true }).last()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/admin/source-records/') &&
            response.url().includes('/versions/'),
    );
    await catalog.getByRole('button', { name: 'Restore' }).first().click();
    expect((await restored).status()).toBe(200);
    await expect(catalog.getByLabel('Title')).toHaveValue(title);

    page.once('dialog', (dialog) => dialog.accept());
    const deleted = page.waitForResponse(
        (response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes('/api/v1/admin/source-records/'),
    );
    await catalog.getByRole('button', { name: 'Delete' }).click();
    expect((await deleted).status()).toBe(204);
    await expect(catalog.getByText(title, { exact: true })).toBeHidden();
});
