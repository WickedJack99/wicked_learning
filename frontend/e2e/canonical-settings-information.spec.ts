import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

const pages = [
    { path: '/settings/about', slug: 'about', title: 'About Learning Worlds' },
    { path: '/settings/imprint', slug: 'imprint', title: 'Imprint' },
    {
        path: '/settings/data-protection',
        slug: 'data-protection',
        title: 'Data Protection',
    },
] as const;

for (const { name, viewport } of viewports) {
    test.describe(`${name} canonical Settings information`, () => {
        test.use({ viewport });

        for (const sourcePage of pages) {
            test(`mounts the copied ${sourcePage.slug} settings variant with its bounded source controls`, async ({
                page,
            }) => {
                await routeSettingsInformation(page, sourcePage.slug);

                await page.goto(sourcePage.path);

                const back = page.getByRole('link', { name: 'Settings' });
                await expect(back).toHaveAttribute('href', '/settings');
                await expectBounded(back, viewport);
                await expect(page.getByText(sourcePage.title, { exact: true })).toBeVisible();
                await expect(
                    page.getByRole('heading', {
                        name: `Canonical ${sourcePage.slug} information`,
                    }),
                ).toBeVisible();
                await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
            });
        }
    });
}

test('renders an explicit unavailable state when the authenticated information projection fails', async ({
    page,
}) => {
    await routeSettingsInformation(page, 'about', 503);

    await page.goto('/settings/about');

    await expect(
        page.getByText('Settings information is unavailable.'),
    ).toBeVisible();
    await expect(
        page.getByText(
            'The current-user or information-page projection is currently unavailable.',
        ),
    ).toBeVisible();
});

async function routeSettingsInformation(
    page: Page,
    slug: string,
    pageStatus = 200,
) {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                appearance: 'light',
                avatar_url: null,
                can_view_media_paths: false,
                capabilities: [],
                email: 'information@example.test',
                name: 'Information Tester',
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
    await page.route(`**/api/v1/public/pages/${slug}`, async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                body: `# Canonical ${slug} information`,
                slug,
                title: slug,
            }),
            contentType: 'application/json',
            status: pageStatus,
        });
    });
}

async function expectBounded(
    locator: Locator,
    viewport: { width: number; height: number },
) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

function welcomeProjection() {
    const authTheme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#fff', button_text_color: '#fff', input_background: '#07111f', panel_background: '#07111f' };
    const publicPalette = { accent_text: '#5eead4', accent_text_opacity: 100, body_text: '#e2e8f0', body_text_opacity: 100, control_border: '#fff', control_border_opacity: 100, control_text: '#fff', control_text_opacity: 100, heading_text: '#fff', heading_text_opacity: 100, muted_text: '#94a3b8', muted_text_opacity: 100, welcome_overlay: '#020617', welcome_overlay_opacity: 62 };
    const settingsPalette = { accent: '#9f1239', accent_opacity: 100, accent_foreground: '#f8fafc', accent_foreground_opacity: 100, active_background: '#fce7f3', active_background_opacity: 100, appearance_switch_background: '#fce7f3', appearance_switch_background_opacity: 100, appearance_switch_active_background: '#fff', appearance_switch_active_background_opacity: 100, appearance_switch_active_text: '#9f1239', appearance_switch_active_text_opacity: 100, appearance_switch_inactive_text: '#64748b', appearance_switch_inactive_text_opacity: 100, border_color: '#9f1239', border_color_opacity: 25, content_background: '#fff1f2', content_background_opacity: 100, input_background: '#fff', input_background_opacity: 100, input_border_color: '#9f1239', input_border_color_opacity: 25, muted_text: '#475569', muted_text_opacity: 100, nested_sidebar_background: '#ffe4e6', nested_sidebar_background_opacity: 100, panel_background: '#fff', panel_background_opacity: 100, scrollbar_thumb: '#9f1239', scrollbar_thumb_opacity: 100, sidebar_background: '#ffe4e6', sidebar_background_opacity: 100 };

    return { appearance: 'light', auth: { user: { id: '00000000-0000-4000-8000-000000000001' } }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: authTheme, light: authTheme }, register: { dark: authTheme, light: authTheme }, welcome: { dark: authTheme, light: authTheme } }, cursors: {}, information_pages: [], public_palette: { dark: publicPalette, light: publicPalette }, settings_palette: { dark: settingsPalette, light: settingsPalette }, welcome: { pages: [] } } };
}
