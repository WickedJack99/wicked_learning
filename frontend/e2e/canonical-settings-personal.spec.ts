import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'narrow', width: 390, height: 844 },
]) {
    test(`${viewport.name} mounts copied Personal source navigation from the URL`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await routePersonal(page);
        await page.goto('/settings?panel=personal&personal=sound');

        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Audio preferences' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Mute all sound' })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Security/ })).toBeVisible();
        const sourceControl = viewport.name === 'narrow'
            ? page.getByLabel('Settings area')
            : page.getByRole('navigation', { name: 'Settings navigation' });
        await expect(sourceControl).toBeVisible();
        const bounds = await sourceControl.boundingBox();
        expect(bounds).not.toBeNull();
        expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
        await page.getByRole('tab', { name: /Feedback/ }).click();
        await expect(page).toHaveURL(/panel=personal&personal=feedback/);
        await expect(page.getByRole('heading', { name: 'Platform feedback' })).toBeVisible();
    });
}

test('saves copied Personal sound preferences with the typed Rust contract', async ({ page }) => {
    let write: unknown;
    await routePersonal(page, (request) => { write = request.postDataJSON(); });
    await page.goto('/settings?panel=personal&personal=sound');

    await page.locator('input[type="range"]').first().fill('41');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => write).toEqual({
        ambience_volume: 70,
        effects_volume: 41,
        muted: false,
    });
});

test('renders explicit root Settings unavailability when one required Personal read fails', async ({ page }) => {
    await routePersonal(page);
    await page.unroute('**/api/v1/learner/sound-preferences');
    await page.route('**/api/v1/learner/sound-preferences', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'dependency_unavailable', title: 'A required service is unavailable.' }) }));
    await page.goto('/settings?panel=personal');
    await expect(page.getByText('Settings are unavailable.')).toBeVisible();
});

test('renders explicit root Settings unavailability when the typed bootstrap read fails', async ({ page }) => {
    await routePersonal(page);
    await page.unroute('**/api/v1/settings/bootstrap');
    await page.route('**/api/v1/settings/bootstrap', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'dependency_unavailable', title: 'A required service is unavailable.' }) }));
    await page.goto('/settings?panel=personal');
    await expect(page.getByText('Settings are unavailable.')).toBeVisible();
});

test('renders explicit root Settings unavailability for an anonymous bootstrap response', async ({ page }) => {
    await routePersonal(page);
    await page.unroute('**/api/v1/settings/bootstrap');
    await page.route('**/api/v1/settings/bootstrap', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'authentication_required', title: 'Authentication is required.' }) }));
    await page.goto('/settings?panel=personal');
    await expect(page.getByText('Settings are unavailable.')).toBeVisible();
});

test('leaves a selected unprojected Settings panel explicitly unavailable without reading Personal data', async ({ page }) => {
    let personalReads = 0;
    await routePersonal(page, undefined, () => { personalReads += 1; });
    await page.goto('/settings?panel=admin-ai-integrations');
    await expect(page.getByText('Settings are unavailable.')).toBeVisible();
    expect(personalReads).toBe(0);
});

async function routePersonal(page: Page, onSoundWrite?: (request: Request) => void, onPersonalRead?: () => void) {
    const authTheme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#fff', button_text_color: '#fff', input_background: '#07111f', panel_background: '#07111f' };
    const palette = { accent: '#9f1239', accent_opacity: 100, accent_foreground: '#fff', accent_foreground_opacity: 100, active_background: '#fce7f3', active_background_opacity: 100, appearance_switch_background: '#fce7f3', appearance_switch_background_opacity: 100, appearance_switch_active_background: '#fff', appearance_switch_active_background_opacity: 100, appearance_switch_active_text: '#9f1239', appearance_switch_active_text_opacity: 100, appearance_switch_inactive_text: '#64748b', appearance_switch_inactive_text_opacity: 100, border_color: '#9f1239', border_color_opacity: 25, content_background: '#fff1f2', content_background_opacity: 100, input_background: '#fff', input_background_opacity: 100, input_border_color: '#9f1239', input_border_color_opacity: 25, muted_text: '#475569', muted_text_opacity: 100, nested_sidebar_background: '#ffe4e6', nested_sidebar_background_opacity: 100, panel_background: '#fff', panel_background_opacity: 100, scrollbar_thumb: '#9f1239', scrollbar_thumb_opacity: 100 };
    await page.route('**/api/v1/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ appearance: 'light', avatar_url: null, can_view_media_paths: false, capabilities: [], email: 'personal@example.test', name: 'Personal Tester', roles: ['learner'], settings_access: {}, subject_id: '00000000-0000-4000-8000-000000000001', username: null }) }));
    await page.route('**/api/v1/settings/bootstrap', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_capabilities: {}, can_access_administration: false, notifications: { pending_feedback_requests: 0, pending_organization_icon_reports: 0, reported_organizations: [] } }) }));
    await page.route('**/api/v1/account/profile', route => { onPersonalRead?.(); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ email: 'personal@example.test', name: 'Personal Tester', profile_image_id: null, profile_image_url: null, username: null }) }); });
    await page.route('**/api/v1/account/security', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ can_manage_passkeys: true, can_manage_two_factor: true, passkeys: [], password_rules: 'minlength: 12', requires_confirmation: true, two_factor_enabled: false }) }));
    await page.route('**/api/v1/learner/language-preference', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ available_languages: [{ code: 'en', name: 'English', native_name: 'English' }], locale: 'en' }) }));
    await page.route('**/api/v1/learner/platform-translations', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ locale: 'en', translations: {} }) }));
    await page.route('**/api/v1/learner/feedback-prompt-preference', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'enabled' }) }));
    await page.route('**/api/v1/learner/sound-preferences', async route => {
        if (route.request().method() === 'PATCH') onSoundWrite?.(route.request());
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ambience_volume: 70, effects_volume: 42, muted: false }) });
    });
    await page.route('**/api/v1/security/csrf', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'personal-csrf' }) }));
    await page.route('**/api/v1/public/welcome', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ appearance: 'light', auth: { user: { id: '00000000-0000-4000-8000-000000000001' } }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: authTheme, light: authTheme }, register: { dark: authTheme, light: authTheme }, welcome: { dark: authTheme, light: authTheme } }, cursors: {}, information_pages: [], public_palette: { dark: {}, light: {} }, settings_palette: { dark: palette, light: palette }, welcome: { pages: [] } } }) }));
}
