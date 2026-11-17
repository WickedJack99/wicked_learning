import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of viewports) {
    test.describe(`${name} canonical source-code page`, () => {
        test.use({ viewport });

        test('preserves origin, modified-source links, and source back navigation', async ({
            page,
        }) => {
            await routeSourceCode(page);

            await page.goto('/');
            await page.goto('/source');

            await expect(page.locator('main.platform-shell')).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Source code' }),
            ).toBeVisible();
            await expect(page.getByText('Modified sources')).toBeVisible();

            const back = page.getByRole('button', { name: 'Back' });
            const origin = page.getByRole('link', { name: 'Original project' });
            const modified = page.getByRole('link', {
                name: 'Deployment changes',
            });
            await expectBounded(back, viewport);
            await expectBounded(origin, viewport);
            await expectBounded(modified, viewport);
            await expect(origin).toHaveAttribute(
                'href',
                'https://example.test/original',
            );
            await expect(modified).toHaveAttribute('target', '_blank');

            await back.click();
            await expect(
                page.getByText('Welcome to a learning world'),
            ).toBeVisible();
        });
    });
}

test('the copied source page hides the modified-sources grouping without custom links', async ({
    page,
}) => {
    await routeSourceCode(page, []);

    await page.goto('/source');

    await expect(
        page.getByRole('link', { name: 'Original project' }),
    ).toBeVisible();
    await expect(page.getByText('Modified sources')).toHaveCount(0);
});

test('an unavailable source-links dependency renders an explicit unavailable state', async ({
    page,
}) => {
    await routeSourceCode(page, [], 503);

    await page.goto('/source');

    await expect(page.getByText('Source code is unavailable.')).toBeVisible();
    await expect(
        page.getByText('The public source-code projection is currently unavailable.'),
    ).toBeVisible();
});

async function routeSourceCode(
    page: Page,
    modifiedSources = [
        {
            label: 'Deployment changes',
            url: 'https://example.test/deployment',
        },
        {
            label: 'Documentation fork',
            url: 'https://example.test/docs',
        },
    ],
    sourceLinksStatus = 200,
) {
    await page.route('**/api/v1/public/welcome', async (route) => {
        await route.fulfill({
            body: JSON.stringify(welcomeProjection()),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/public/source-links', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                modified_sources: modifiedSources,
                origin: {
                    label: 'Original project',
                    url: 'https://example.test/original',
                },
            }),
            contentType: 'application/json',
            status: sourceLinksStatus,
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
            information_pages: [],
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
