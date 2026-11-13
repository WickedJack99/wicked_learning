import { expect, test } from '@playwright/test';

test('a learner receives the canonical English platform catalog while no alternate locale is enabled', async ({
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
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

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
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/home');
    await expect(
        page.getByRole('link', { name: 'Lernbereich' }),
    ).toBeVisible();

    const desktopNavigationItems = page.locator(
        '[data-wl-id^="learner.navigation.item."]',
    );
    await expect(desktopNavigationItems).toHaveCount(6);
    await expectNavigationItemsInsideViewport(page, desktopNavigationItems);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
        page.getByRole('link', { name: 'Lernbereich' }),
    ).toBeVisible();
    await expectNavigationItemsInsideViewport(
        page,
        page.locator('[data-wl-id^="learner.navigation.item."]'),
    );
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
