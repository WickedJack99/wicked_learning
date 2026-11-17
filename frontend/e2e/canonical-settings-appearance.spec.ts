import { expect, test } from '@playwright/test';
import type { Locator, Page, Request } from '@playwright/test';

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of viewports) {
    test.describe(`${name} canonical Appearance settings`, () => {
        test.use({ viewport });

        test('mounts the copied direct Settings page and persists its source control through Rust', async ({
            page,
        }) => {
            let appearanceWrite: unknown;
            await routeAppearance(page, (request) => {
                appearanceWrite = request.postDataJSON();
            });

            await page.goto('/settings/appearance');

            await expect(
                page.getByRole('heading', { name: 'Appearance' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Visual mode' }),
            ).toBeVisible();
            await expect
                .poll(() =>
                    page.locator('main.settings-surface').evaluate((element) =>
                        element.style.getPropertyValue('--settings-accent'),
                    ),
                )
                .toBe('#9f1239');

            const back = page.getByRole('link', { name: 'Settings' });
            const light = page.getByRole('button', { name: 'Light' });
            const dark = page.getByRole('button', { name: 'Dark' });
            await expect(back).toHaveAttribute('href', '/settings');
            await expectBounded(back, viewport);
            await expectBounded(light, viewport);
            await expectBounded(dark, viewport);

            await dark.click();
            await expect(page.locator('html')).toHaveClass(/dark/);
            await expect.poll(() => appearanceWrite).toEqual({
                appearance: 'dark',
            });
        });
    });
}

test('keeps the copied source control locally updated when the Rust appearance write is unavailable', async ({
    page,
}) => {
    await routeAppearance(page, undefined, 503);

    await page.goto('/settings/appearance');
    await page.getByRole('button', { name: 'Dark' }).click();

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByText(/saved/i)).toHaveCount(0);
});

test('renders an explicit unavailable state when current-user projection fails', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                code: 'dependency_unavailable',
                title: 'A required service is unavailable.',
            }),
            contentType: 'application/json',
            status: 503,
        });
    });
    await page.route('**/api/v1/public/welcome', async (route) => {
        await route.fulfill({ body: JSON.stringify(welcomeProjection()) });
    });

    await page.goto('/settings/appearance');

    await expect(
        page.getByText('Appearance settings are unavailable.'),
    ).toBeVisible();
    await expect(
        page.getByText(
            'The current-user or Settings presentation projection is currently unavailable.',
        ),
    ).toBeVisible();
});

async function routeAppearance(
    page: Page,
    onAppearanceWrite?: (request: Request) => void,
    appearanceStatus = 200,
) {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                appearance: 'light',
                avatar_url: null,
                can_view_media_paths: false,
                capabilities: [],
                email: 'appearance@example.test',
                name: 'Appearance Tester',
                roles: ['learner'],
                settings_access: {},
                subject_id: '00000000-0000-4000-8000-000000000001',
                username: null,
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/public/welcome', async (route) => {
        await route.fulfill({
            body: JSON.stringify(welcomeProjection()),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ token: 'appearance-csrf' }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/learner/appearance', async (route) => {
        onAppearanceWrite?.(route.request());
        await route.fulfill({
            body: JSON.stringify({ appearance: 'dark' }),
            contentType: 'application/json',
            status: appearanceStatus,
        });
    });
}

async function expectBounded(
    locator: Locator,
    viewport: { width: number; height: number },
) {
    const box = await locator.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

function welcomeProjection() {
    const authTheme = {
        background_color: '#07111f',
        background_image: null,
        background_overlay: 'none',
        border_line_color: 'rgba(255,255,255,0.2)',
        button_text_color: '#ffffff',
        input_background: '#07111f',
        panel_background: '#07111f',
    };
    const publicPalette = {
        accent_text: '#5eead4', accent_text_opacity: 100,
        body_text: '#e2e8f0', body_text_opacity: 100,
        control_border: '#ffffff', control_border_opacity: 100,
        control_text: '#ffffff', control_text_opacity: 100,
        heading_text: '#f8fafc', heading_text_opacity: 100,
        muted_text: '#94a3b8', muted_text_opacity: 100,
        welcome_overlay: '#020617', welcome_overlay_opacity: 62,
    };
    const settingsPalette = {
        accent: '#9f1239', accent_opacity: 100,
        accent_foreground: '#f8fafc', accent_foreground_opacity: 100,
        active_background: '#fce7f3', active_background_opacity: 100,
        appearance_switch_background: '#fce7f3', appearance_switch_background_opacity: 100,
        appearance_switch_active_background: '#ffffff', appearance_switch_active_background_opacity: 100,
        appearance_switch_active_text: '#9f1239', appearance_switch_active_text_opacity: 100,
        appearance_switch_inactive_text: '#64748b', appearance_switch_inactive_text_opacity: 100,
        border_color: '#9f1239', border_color_opacity: 25,
        content_background: '#fff1f2', content_background_opacity: 100,
        input_background: '#ffffff', input_background_opacity: 100,
        input_border_color: '#9f1239', input_border_color_opacity: 25,
        muted_text: '#475569', muted_text_opacity: 100,
        nested_sidebar_background: '#ffe4e6', nested_sidebar_background_opacity: 100,
        panel_background: '#ffffff', panel_background_opacity: 100,
        scrollbar_thumb: '#9f1239', scrollbar_thumb_opacity: 100,
        sidebar_background: '#ffe4e6', sidebar_background_opacity: 100,
    };

    return {
        appearance: 'light',
        auth: { user: { id: '00000000-0000-4000-8000-000000000001' } },
        publicPresentation: {
            branding: { logo: '/images/logo.png' },
            auth: {
                login: { dark: authTheme, light: authTheme },
                register: { dark: authTheme, light: authTheme },
                welcome: { dark: authTheme, light: authTheme },
            },
            cursors: {},
            information_pages: [],
            public_palette: { dark: publicPalette, light: publicPalette },
            settings_palette: { dark: settingsPalette, light: settingsPalette },
            welcome: { pages: [] },
        },
    };
}
