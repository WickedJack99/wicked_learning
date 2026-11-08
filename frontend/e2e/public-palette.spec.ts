import { expect, test } from '@playwright/test';

test('a local administrator updates the source public palette and anonymous pages receive it', async ({ browser, page }) => {
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

    await page.goto('/settings?panel=admin-presentation-localization&presentation=palette');
    await expect(page.getByRole('heading', { name: 'Color palette' })).toBeVisible();
    await page.getByRole('button', { name: 'Dark' }).click();
    await page.getByRole('textbox', { name: 'Heading text', exact: true }).fill('#123456');
    await page.getByRole('slider', { name: 'Heading text opacity' }).fill('82');
    const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().endsWith('/api/v1/admin/public-presentation'));
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok()).toBeTruthy();

    const anonymous = await browser.newContext();
    const projection = await anonymous.request.get('/api/v1/public/presentation');
    expect(projection.ok()).toBeTruthy();
    await expect(projection.json()).resolves.toMatchObject({
        public_palette: { dark: { heading_text: '#123456', heading_text_opacity: 82 } },
    });
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
});
