import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

const pages = [
    { heading: 'About the source contract', slug: 'about' },
    { heading: 'Imprint for this deployment', slug: 'imprint' },
    { heading: 'Data protection for this deployment', slug: 'data-protection' },
] as const;

for (const { name: viewportName, viewport } of viewports) {
    test.describe(`${viewportName} canonical public information`, () => {
        test.use({ viewport });

        for (const pageDefinition of pages) {
            test(`${pageDefinition.slug} mounts the copied source page`, async ({
                page,
            }) => {
                await routePublicInformation(page, pageDefinition.slug);

                await page.goto(`/${pageDefinition.slug}`);

                await expect(page.locator('main.platform-shell')).toBeVisible();
                await expect(
                    page.getByRole('heading', { name: pageDefinition.heading }),
                ).toBeVisible();

                const home = page.getByRole('link', { name: 'Home' });
                await expectBounded(home, viewport);
                await home.click();
                await expect(
                    page.getByText('Welcome to a learning world'),
                ).toBeVisible();
            });
        }
    });
}

test('a missing published document renders an explicit unavailable state', async ({
    page,
}) => {
    await routePublicInformation(page, 'about', 404);

    await page.goto('/about');

    await expect(
        page.getByText('Information page is unavailable.'),
    ).toBeVisible();
    await expect(
        page.getByText('The public information projection is currently unavailable.'),
    ).toBeVisible();
});

test('a configured information route remains explicitly unavailable before its audit', async ({
    page,
}) => {
    let publicReadRequests = 0;
    await page.route('**/api/v1/public/**', async (route) => {
        publicReadRequests += 1;
        await route.abort();
    });

    await page.goto('/info/deployment-notes');

    await expect(page.getByText('This page is not available yet')).toBeVisible();
    expect(publicReadRequests).toBe(0);
});

async function routePublicInformation(
    page: Page,
    slug: (typeof pages)[number]['slug'],
    pageStatus = 200,
) {
    await page.route('**/api/v1/public/welcome', async (route) => {
        await route.fulfill({
            body: JSON.stringify(welcomeProjection()),
            contentType: 'application/json',
        });
    });
    await page.route(`**/api/v1/public/pages/${slug}`, async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                body: `# ${headingFor(slug)}\n\nThe copied source page renders this Rust-owned published markdown.`,
                slug,
                title: headingFor(slug),
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
    const box = await locator.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

function headingFor(slug: (typeof pages)[number]['slug']) {
    return pages.find((page) => page.slug === slug)!.heading;
}

function welcomeProjection() {
    const theme = {
        background_color: '#07111f',
        background_image: null,
        background_overlay: 'none',
        border_line_color: 'rgba(255,255,255,0.2)',
        button_text_color: '#ffffff',
        input_background: '#07111f',
        panel_background: '#07111f',
    };
    const palette = {
        accent_text: '#5eead4',
        accent_text_opacity: 100,
        body_text: '#e2e8f0',
        body_text_opacity: 100,
        control_border: '#ffffff',
        control_border_opacity: 100,
        control_text: '#ffffff',
        control_text_opacity: 100,
        heading_text: '#f8fafc',
        heading_text_opacity: 100,
        muted_text: '#94a3b8',
        muted_text_opacity: 100,
        welcome_overlay: '#020617',
        welcome_overlay_opacity: 62,
    };

    return {
        appearance: 'system',
        auth: { user: null },
        publicPresentation: {
            branding: { logo: '/images/logo.png' },
            auth: {
                login: { dark: theme, light: theme },
                register: { dark: theme, light: theme },
                welcome: { dark: theme, light: theme },
            },
            cursors: {},
            welcome: {
                pages: [
                    {
                        backgrounds: { dark: null, light: null },
                        body: 'Return to the canonical public shell.',
                        buttons: [],
                        eyebrow: 'Orientation',
                        title: 'Welcome to a learning world',
                    },
                ],
            },
            information_pages: pages.map((page) => ({
                backgrounds: { dark: null, light: null },
                body: `# ${page.heading}`,
                slug: page.slug,
                title: page.heading,
            })),
            public_palette: { dark: palette, light: palette },
            settings_palette: {
                dark: settingsPalette(),
                light: settingsPalette(),
            },
        },
    };
}

function settingsPalette() {
    return {
        accent: '#5eead4', accent_opacity: 100,
        accent_foreground: '#07111f', accent_foreground_opacity: 100,
        active_background: '#5eead4', active_background_opacity: 10,
        appearance_switch_background: '#07111f', appearance_switch_background_opacity: 55,
        appearance_switch_active_background: '#111820', appearance_switch_active_background_opacity: 100,
        appearance_switch_active_text: '#f8fafc', appearance_switch_active_text_opacity: 100,
        appearance_switch_inactive_text: '#94a3b8', appearance_switch_inactive_text_opacity: 100,
        border_color: '#ffffff', border_color_opacity: 10,
        content_background: '#07111f', content_background_opacity: 100,
        input_background: '#07111f', input_background_opacity: 100,
        input_border_color: '#ffffff', input_border_color_opacity: 20,
        muted_text: '#94a3b8', muted_text_opacity: 100,
        nested_sidebar_background: '#07111f', nested_sidebar_background_opacity: 100,
        panel_background: '#07111f', panel_background_opacity: 100,
        scrollbar_thumb: '#94a3b8', scrollbar_thumb_opacity: 100,
        sidebar_background: '#07111f', sidebar_background_opacity: 100,
    };
}
