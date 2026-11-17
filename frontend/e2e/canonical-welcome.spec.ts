import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type WelcomeScenario = {
    authenticated: boolean;
    name: string;
};

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

const scenarios: WelcomeScenario[] = [
    { authenticated: false, name: 'unauthenticated' },
    { authenticated: true, name: 'authenticated' },
];

for (const { name: viewportName, viewport } of viewports) {
    test.describe(`${viewportName} canonical Welcome`, () => {
        test.use({ viewport });

        for (const scenario of scenarios) {
            test(`${scenario.name} source page retains its documented viewport behavior`, async ({ page }) => {
                await routeWelcome(page, scenario.authenticated);

                await page.goto('/');
                await expect(page.locator('main.platform-shell')).toBeVisible();
                await expect(page.getByRole('heading', { name: 'Welcome to a learning world' })).toBeVisible();

                if (scenario.authenticated) {
                    const learningDesk = page.getByRole('link', {
                        name: 'Open learning desk',
                    });
                    await expectBounded(learningDesk, viewport);
                    await learningDesk.click();
                    await expect(page.getByText('This page is not available yet')).toBeVisible();
                } else {
                    const appearance = page.getByRole('button', { name: 'Dark' });
                    const login = page.getByRole('link', { name: 'Log in' });
                    const register = page.getByRole('link', { name: 'Register' });
                    let appearanceWrites = 0;
                    page.on('request', (request) => {
                        if (request.url().endsWith('/settings/appearance')) {
                            appearanceWrites += 1;
                        }
                    });

                    await expectBounded(appearance, viewport);

                    if (viewportName === 'narrow') {
                        await expectSourceInheritedHeaderOverflow(login, viewport);
                    } else {
                        await expectBounded(login, viewport);
                        await expectBounded(register, viewport);
                    }

                    await appearance.click();
                    await expect(page.locator('html')).toHaveClass(/dark/);
                    expect(appearanceWrites).toBe(0);

                    await page.getByRole('button', { name: 'Show Explore the source' }).click();
                    await expect(
                        page.getByRole('heading', { name: 'Explore the source' }),
                    ).toBeVisible();
                }
            });
        }
    });
}

test('the copied Welcome page renders an explicit projection-unavailable state', async ({ page }) => {
    await page.route('**/api/v1/public/welcome', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                code: 'dependency_unavailable',
                title: 'A required service is unavailable.',
            }),
            contentType: 'application/json',
            status: 503,
        });
    });

    await page.goto('/');

    await expect(page.getByText('Welcome is unavailable.')).toBeVisible();
    await expect(
        page.getByText('The public Welcome projection is currently unavailable.'),
    ).toBeVisible();
});

async function routeWelcome(page: Page, authenticated: boolean) {
    await page.route('**/api/v1/public/welcome', async (route) => {
        await route.fulfill({
            body: JSON.stringify(welcomeProjection(authenticated)),
            contentType: 'application/json',
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

async function expectSourceInheritedHeaderOverflow(
    locator: Locator,
    viewport: { width: number },
) {
    const box = await locator.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeGreaterThan(viewport.width);
}

function welcomeProjection(authenticated: boolean) {
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
        appearance: authenticated ? 'dark' : 'system',
        auth: {
            user: authenticated ? { id: 'f6b13b8b-2df8-4c5c-8b30-5d6dfecf8fa7' } : null,
        },
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
                        body: 'Choose a place to begin.',
                        buttons: [{ target: '/world', text: 'Enter the world' }],
                        eyebrow: 'Orientation',
                        title: 'Welcome to a learning world',
                    },
                    {
                        backgrounds: { dark: null, light: null },
                        body: 'The canonical source remains the visual owner.',
                        buttons: [{ target: '/source', text: 'Read source notes' }],
                        eyebrow: 'Canonical source',
                        title: 'Explore the source',
                    },
                ],
            },
            information_pages: [
                {
                    backgrounds: { dark: null, light: null },
                    body: 'About this deployment.',
                    slug: 'about',
                    title: 'About',
                },
            ],
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
