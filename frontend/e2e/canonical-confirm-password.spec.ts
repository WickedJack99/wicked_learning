import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`confirm password ${viewport.width} submits the copied password form`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await authenticatedPage(page);
        await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) }));
        await page.route('**/api/v1/account/password/confirmation', async (route) => {
            expect(route.request().postDataJSON()).toEqual({ password: 'correct horse battery staple' });
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ confirmed: true }) });
        });

        await page.goto('/user/confirm-password');
        await page.locator('input[name=password]').fill('correct horse battery staple');
        const button = page.getByRole('button', { name: 'Confirm password' });
        const bounds = await button.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        await button.click();
        await expect(page).toHaveURL(/\/home$/);
    });
}

test('confirm password keeps anonymous access at the source Welcome destination', async ({ page }) => {
    await page.route('**/api/v1/session', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ authenticated: false, subject_id: null, two_factor_required: false }) }));
    await page.goto('/user/confirm-password');
    await expect(page).toHaveURL(/\/$/);
});

test('confirm password keeps Rust rejection visible in the copied field error', async ({ page }) => {
    await authenticatedPage(page);
    await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) }));
    await page.route('**/api/v1/account/password/confirmation', (route) => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 'password_confirmation_rejected', title: 'The password could not be confirmed.' }) }));
    await page.goto('/user/confirm-password');
    await page.locator('input[name=password]').fill('wrong password');
    await page.getByRole('button', { name: 'Confirm password' }).click();
    await expect(page.getByText('The password could not be confirmed.')).toBeVisible();
});

test('confirm password uses the copied passkey control with its Rust confirmation contract', async ({ page }) => {
    await installPasskeyBrowser(page);
    await authenticatedPage(page);
    await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf-token' }) }));
    await page.route('**/api/v1/account/passkeys/confirmation/options', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ options: { challenge: 'Y2hhbGxlbmdl', rpId: '127.0.0.1', timeout: 60_000, userVerification: 'preferred' } }) }));
    await page.route('**/api/v1/account/passkeys/confirmation', async (route) => {
        expect(route.request().postDataJSON()).toMatchObject({ id: 'credential-id', type: 'public-key' });
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ confirmed: true }) });
    });
    await page.goto('/user/confirm-password');
    await page.getByRole('button', { name: 'Confirm with passkey' }).click();
    await expect(page).toHaveURL(/\/home$/);
});

async function authenticatedPage(page: Page) {
    await page.route('**/api/v1/session', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ authenticated: true, subject_id: 'f6b13b8b-2df8-4c5c-8b30-5d6dfecf8fa7', two_factor_required: false }) }));
    await page.route('**/api/v1/public/welcome', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(welcome()) }));
}

async function installPasskeyBrowser(page: Page) {
    await page.addInitScript(() => {
        class MockPublicKeyCredential {}
        Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, value: MockPublicKeyCredential });
        Object.defineProperty(navigator, 'credentials', {
            configurable: true,
            value: { get: async () => ({ id: 'credential-id', rawId: new Uint8Array([1, 2, 3]).buffer, type: 'public-key', response: { authenticatorData: new Uint8Array([4, 5, 6]).buffer, clientDataJSON: new Uint8Array([7, 8, 9]).buffer, signature: new Uint8Array([10, 11, 12]).buffer, userHandle: null }, getClientExtensionResults: () => ({}) }) },
        });
    });
}

function welcome() {
    const theme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#ffffff', button_text_color: '#ffffff', input_background: '#07111f', panel_background: '#07111f' };
    const palette = { accent_text: '#5eead4', accent_text_opacity: 100, body_text: '#e2e8f0', body_text_opacity: 100, control_border: '#ffffff', control_border_opacity: 100, control_text: '#ffffff', control_text_opacity: 100, heading_text: '#f8fafc', heading_text_opacity: 100, muted_text: '#94a3b8', muted_text_opacity: 100, welcome_overlay: '#020617', welcome_overlay_opacity: 62 };
    return { appearance: 'system', auth: { user: { id: 'marker' } }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: theme, light: theme }, register: { dark: theme, light: theme }, welcome: { dark: theme, light: theme } }, cursors: {}, welcome: { pages: [] }, information_pages: [], public_palette: { dark: palette, light: palette }, settings_palette: { dark: {}, light: {} } } };
}
