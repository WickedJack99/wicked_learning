import { expect, test } from '@playwright/test';

for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'narrow', width: 390, height: 844 },
]) {
    test(`${viewport.name} copied Login submits on its first click`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        let csrfRequests = 0;
        let loginRequests = 0;
        await page.route('**/api/v1/public/welcome', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(welcome()) }));
        await page.route('**/api/v1/security/csrf', (route) => {
            csrfRequests += 1;
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) });
        });
        await page.route('**/api/v1/session/login', async (route) => {
            loginRequests += 1;
            expect(route.request().headers()['x-csrf-token']).toBe('csrf-token');
            expect(route.request().postDataJSON()).toEqual({ email: 'learner@example.test', password: 'correct horse battery staple', remember: true });
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ authenticated: true, subject_id: 'f6b13b8b-2df8-4c5c-8b30-5d6dfecf8fa7', two_factor_required: false }) });
        });
        await page.goto('/login');
        await page.getByLabel('Email address').fill('learner@example.test');
        await page.locator('input[name="password"]').fill('correct horse battery staple');
        await page.getByLabel('Remember me').click();
        const submit = page.getByRole('button', { name: 'Log in' });
        await expect(submit).toBeVisible();
        const box = await submit.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        await submit.click();
        await expect.poll(() => loginRequests).toBe(1);
        expect(csrfRequests).toBe(1);
        await expect(page.getByText('Login is currently unavailable.')).toHaveCount(0);
    });
}

test('copied Login keeps the Rust-session unavailable state explicit', async ({ page }) => {
    await page.route('**/api/v1/public/welcome', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(welcome()) }));
    await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) }));
    await page.route('**/api/v1/session/login', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto('/login');
    await page.getByLabel('Email address').fill('learner@example.test');
    await page.locator('input[name="password"]').fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Login is currently unavailable.')).toBeVisible();
});

function welcome() {
    const theme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#ffffff', button_text_color: '#ffffff', input_background: '#07111f', panel_background: '#07111f' };
    const palette = { accent_text: '#5eead4', accent_text_opacity: 100, body_text: '#e2e8f0', body_text_opacity: 100, control_border: '#ffffff', control_border_opacity: 100, control_text: '#ffffff', control_text_opacity: 100, heading_text: '#f8fafc', heading_text_opacity: 100, muted_text: '#94a3b8', muted_text_opacity: 100, welcome_overlay: '#020617', welcome_overlay_opacity: 62 };
    return { appearance: 'system', auth: { user: null }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: theme, light: theme }, register: { dark: theme, light: theme }, welcome: { dark: theme, light: theme } }, cursors: {}, welcome: { pages: [] }, information_pages: [], public_palette: { dark: palette, light: palette }, settings_palette: { dark: {}, light: {} } } };
}
