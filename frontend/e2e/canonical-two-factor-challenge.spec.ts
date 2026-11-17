import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'narrow', width: 390, height: 844 },
];

for (const viewport of viewports) {
    test(`${viewport.name} copied two-factor challenge submits the source authentication-code form`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installProjection(page);
        let challengeRequests = 0;
        await page.route('**/api/v1/session/two-factor', async (route) => {
            challengeRequests += 1;
            expect(route.request().postDataJSON()).toEqual({ code: '123456' });
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(sessionStatus(true)) });
        });

        await page.goto('/two-factor-challenge');
        await expect(page.getByRole('heading', { name: 'Authentication code' })).toBeVisible();
        const input = page.getByLabel('Authentication code');
        await input.fill('12x34567');
        await expect(input).toHaveValue('12345');
        await input.fill('123456');
        const submit = page.getByRole('button', { name: 'Continue' });
        await expect(submit).toBeVisible();
        const bounds = await submit.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        await submit.click();
        await expect.poll(() => challengeRequests).toBe(1);
        await expect(page).toHaveURL(/\/world$/);
    });

    test(`${viewport.name} copied two-factor challenge retains its recovery mode and unavailable state`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installProjection(page);
        await page.route('**/api/v1/session/two-factor', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));

        await page.goto('/two-factor-challenge');
        await page.getByRole('button', { name: 'login using a recovery code' }).click();
        await expect(page.getByRole('heading', { name: 'Recovery code' })).toBeVisible();
        const recovery = page.getByPlaceholder('Enter recovery code');
        await recovery.fill('one-use-recovery-code');
        const submit = page.getByRole('button', { name: 'Continue' });
        const bounds = await submit.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        await submit.click();
        await expect(page.getByText('Two-factor authentication is currently unavailable.')).toBeVisible();
    });
}

test('copied two-factor challenge exposes the Rust rejection in its source code field', async ({ page }) => {
    await installProjection(page);
    await page.route('**/api/v1/session/two-factor', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));

    await page.goto('/two-factor-challenge');
    await page.getByLabel('Authentication code').fill('123456');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('The authentication code is invalid or expired.')).toBeVisible();
});

async function installProjection(page: Page) {
    await page.route('**/api/v1/public/welcome', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(welcome()) }));
    await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) }));
}

function sessionStatus(authenticated: boolean) {
    return { authenticated, subject_id: authenticated ? 'f6b13b8b-2df8-4c5c-8b30-5d6dfecf8fa7' : null, two_factor_required: false };
}

function welcome() {
    const theme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#ffffff', button_text_color: '#ffffff', input_background: '#07111f', panel_background: '#07111f' };
    const palette = { accent_text: '#5eead4', accent_text_opacity: 100, body_text: '#e2e8f0', body_text_opacity: 100, control_border: '#ffffff', control_border_opacity: 100, control_text: '#ffffff', control_text_opacity: 100, heading_text: '#f8fafc', heading_text_opacity: 100, muted_text: '#94a3b8', muted_text_opacity: 100, welcome_overlay: '#020617', welcome_overlay_opacity: 62 };
    return { appearance: 'system', auth: { user: null }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: theme, light: theme }, register: { dark: theme, light: theme }, welcome: { dark: theme, light: theme } }, cursors: {}, welcome: { pages: [] }, information_pages: [], public_palette: { dark: palette, light: palette }, settings_palette: { dark: {}, light: {} } } };
}
