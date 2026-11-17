import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'narrow', width: 390, height: 844 },
]) {
    test(`${viewport.name} copied Login completes the Rust passkey ceremony`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installPasskeyBrowser(page);
        await installWelcome(page);
        await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) }));
        await page.route('**/api/v1/session/passkey/options', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ options: options() }) }));
        await page.route('**/api/v1/session/passkey', async (route) => {
            expect(route.request().headers()['x-csrf-token']).toBe('csrf-token');
            expect(route.request().postDataJSON()).toMatchObject({
                id: 'credential-id', rawId: 'AQID', type: 'public-key',
                response: { authenticatorData: 'BAUG', clientDataJSON: 'BwgJ', signature: 'CgsM' },
            });
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ authenticated: true, redirect: '/', subject_id: 'f6b13b8b-2df8-4c5c-8b30-5d6dfecf8fa7', two_factor_required: false }) });
        });

        await page.goto('/login');
        const passkey = page.getByRole('button', { name: 'Sign in with a passkey' });
        await expect(passkey).toBeVisible();
        const bounds = await passkey.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        await passkey.click();
        await expect(page).toHaveURL(/\/$/);
    });

    test(`${viewport.name} copied Login keeps Rust passkey unavailability visible`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installPasskeyBrowser(page);
        await installWelcome(page);
        await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) }));
        await page.route('**/api/v1/session/passkey/options', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'dependency_unavailable', title: 'A required service is unavailable.' }) }));

        await page.goto('/login');
        await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
        await expect(page.getByText('Passkey authentication is currently unavailable.')).toBeVisible();
    });
}

async function installPasskeyBrowser(page: Page) {
    await page.addInitScript(() => {
        class MockPublicKeyCredential {}

        Object.defineProperty(window, 'PublicKeyCredential', {
            configurable: true,
            value: MockPublicKeyCredential,
        });
        Object.defineProperty(navigator, 'credentials', {
            configurable: true,
            value: {
                get: async () => ({
                    id: 'credential-id',
                    rawId: new Uint8Array([1, 2, 3]).buffer,
                    type: 'public-key',
                    response: {
                        authenticatorData: new Uint8Array([4, 5, 6]).buffer,
                        clientDataJSON: new Uint8Array([7, 8, 9]).buffer,
                        signature: new Uint8Array([10, 11, 12]).buffer,
                        userHandle: null,
                    },
                    getClientExtensionResults: () => ({}),
                }),
            },
        });
    });
}

async function installWelcome(page: Page) {
    await page.route('**/api/v1/public/welcome', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(welcome()) }));
}

function options() {
    return { challenge: 'Y2hhbGxlbmdl', rpId: '127.0.0.1', timeout: 60_000, userVerification: 'preferred' };
}

function welcome() {
    const theme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#ffffff', button_text_color: '#ffffff', input_background: '#07111f', panel_background: '#07111f' };
    const palette = { accent_text: '#5eead4', accent_text_opacity: 100, body_text: '#e2e8f0', body_text_opacity: 100, control_border: '#ffffff', control_border_opacity: 100, control_text: '#ffffff', control_text_opacity: 100, heading_text: '#f8fafc', heading_text_opacity: 100, muted_text: '#94a3b8', muted_text_opacity: 100, welcome_overlay: '#020617', welcome_overlay_opacity: 62 };
    return { appearance: 'system', auth: { user: null }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: theme, light: theme }, register: { dark: theme, light: theme }, welcome: { dark: theme, light: theme } }, cursors: {}, welcome: { pages: [] }, information_pages: [], public_palette: { dark: palette, light: palette }, settings_palette: { dark: {}, light: {} } } };
}
