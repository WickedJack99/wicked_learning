import { expect, test } from './authenticated';

test('the source settings information route preserves its scoped markdown editor', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    let body = '# About this space\n\nA calm place to explore.';

    await page.route('**/api/v1/public/pages/about', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ body, slug: 'about', title: 'About Wicked Learning' }),
        });
    });
    await page.route('**/api/v1/admin/public-information-pages**', async (route) => {
        if (route.request().method() === 'PATCH') {
            body = (route.request().postDataJSON() as { body: string }).body;
        }
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(
                route.request().method() === 'GET'
                    ? [{ body, slug: 'about', title: 'About Wicked Learning' }]
                    : { body, slug: 'about', title: 'About Wicked Learning' },
            ),
        });
    });

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings/about');
    await expect(page.getByRole('heading', { name: 'About this space' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Markdown content')).toHaveValue(body);
    await page.getByLabel('Markdown content').fill('# A revised information page');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'A revised information page' })).toBeVisible();

    await expectInsideViewport(page, page.locator('[data-wl-id="settings.information.page"]'));
    await page.setViewportSize({ width: 390, height: 844 });
    await expectInsideViewport(page, page.getByRole('link', { name: 'Settings' }));
    await expectInsideViewport(page, page.getByRole('heading', { name: 'A revised information page' }));
});

async function expectInsideViewport(
    page: import('@playwright/test').Page,
    locator: import('@playwright/test').Locator,
): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('the test browser has no viewport');
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}
