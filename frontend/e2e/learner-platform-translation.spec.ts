import { expect, test } from '@playwright/test';

test('a learner receives the canonical English platform catalog while no alternate locale is enabled', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const catalog = await page.request.get(
        '/api/v1/learner/platform-translations',
    );
    expect(catalog.status()).toBe(200);
    await expect(catalog.json()).resolves.toMatchObject({
        locale: 'en',
        translations: { 'common.cancel': 'Cancel' },
    });
});

test('the lifted learner header consumes the scoped platform catalog', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'navigation.primary.learning_desk': 'Lernbereich',
                },
            }),
        }),
    );
    await page.goto('/home');
    await expect(page.getByRole('link', { name: 'Lernbereich' })).toBeVisible();

    const desktopNavigationItems = page.locator(
        '[data-wl-id^="learner.navigation.item."]',
    );
    await expect(desktopNavigationItems).toHaveCount(6);
    await expectNavigationItemsInsideViewport(page, desktopNavigationItems);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('link', { name: 'Lernbereich' })).toBeVisible();
    await expectNavigationItemsInsideViewport(
        page,
        page.locator('[data-wl-id^="learner.navigation.item."]'),
    );
});

test('the lifted Paths reader consumes its source platform catalog entries', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'paths.description': 'Translated route guidance.',
                    'paths.eyebrow': 'Translated routes',
                    'paths.title': 'Translated Paths',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/paths**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 6,
                    total: 0,
                },
                paths: [],
                selected_purpose: null,
                selected_time_budget: null,
                topic_context: null,
            }),
        }),
    );

    await page.goto('/paths');
    await expect(
        page.getByRole('heading', { name: 'Translated Paths' }),
    ).toBeVisible();
    await expect(page.getByText('Translated route guidance.')).toBeVisible();
    await expect(page.getByText('Translated routes')).toBeVisible();
});

async function expectNavigationItemsInsideViewport(
    page: import('@playwright/test').Page,
    items: import('@playwright/test').Locator,
): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('the test browser has no viewport');

    for (let index = 0; index < (await items.count()); index += 1) {
        const box = await items.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
}
