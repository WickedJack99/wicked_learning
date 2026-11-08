import { expect, test } from '@playwright/test';

test('a local administrator saves a public visual and anonymous visitors receive only its public presentation projection', async ({
    browser,
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

    const originalResponse = await page.request.get('/api/v1/admin/public-presentation');
    expect(originalResponse.ok()).toBeTruthy();
    const originalPresentation = await originalResponse.json();

    await page.goto('/settings?panel=admin-presentation-localization&presentation=public');
    await expect(page.getByRole('heading', { name: 'Public presentation' })).toBeVisible();
    await page.getByRole('button', { name: 'Backgrounds' }).click();
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    const welcomeBackground = page.getByLabel('Light mode background').nth(2);
    await expect(welcomeBackground).toBeVisible();

    const uploadResponse = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/v1/admin/media-assets'),
    );
    await page.locator('input[type="file"]').nth(2).setInputFiles({
        buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#0f766e"/></svg>',
        ),
        mimeType: 'image/svg+xml',
        name: 'public-presentation-background.svg',
    });
    const uploaded = await uploadResponse;
    expect(uploaded.status()).toBe(201);
    const media = (await uploaded.json()) as { asset: { id: string; url: string } };
    await expect(welcomeBackground).toHaveValue(media.asset.url);

    const saved = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith('/api/v1/admin/public-presentation'),
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok()).toBe(true);

    await expect.poll(async () => {
        const response = await page.request.get('/api/v1/admin/media-assets?page=1&per_page=12');
        const assets = (await response.json()) as { items: Array<{ id: string; reference_count: number }> };
        return assets.items.find((asset) => asset.id === media.asset.id)?.reference_count;
    }).toBe(1);

    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    const publicMedia = anonymousPage.waitForResponse((response) =>
        response.url().endsWith(`/api/v1/public/media-assets/${media.asset.id}/content`),
    );
    await anonymousPage.goto('/');
    expect((await publicMedia).status()).toBe(200);
    await anonymous.close();

    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const restoreStatus = await page.evaluate(async ({ presentation, csrfToken }) => {
        const response = await fetch('/api/v1/admin/public-presentation', {
            body: JSON.stringify(presentation),
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            method: 'PATCH',
        });
        return response.status;
    }, { presentation: originalPresentation, csrfToken: token });
    expect(restoreStatus).toBe(200);

    await expect.poll(async () => {
        const response = await page.request.get('/api/v1/admin/media-assets?page=1&per_page=12');
        const assets = (await response.json()) as { items: Array<{ id: string; reference_count: number }> };
        return assets.items.find((asset) => asset.id === media.asset.id)?.reference_count;
    }).toBe(0);
    const removeStatus = await page.evaluate(async ({ assetId, csrfToken }) => {
        const response = await fetch(`/api/v1/admin/media-assets/${assetId}`, {
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': csrfToken },
            method: 'DELETE',
        });
        return response.status;
    }, { assetId: media.asset.id, csrfToken: token });
    expect(removeStatus).toBe(204);
});
