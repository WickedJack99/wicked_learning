import { expect, test } from '@playwright/test';
import type { Locator, Page, Request } from '@playwright/test';

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of viewports) {
    test.describe(`${name} canonical Language settings`, () => {
        test.use({ viewport });

        test('mounts the copied page, preserves bounded controls, and refreshes source props after the Rust write', async ({
            page,
        }) => {
            let languageWrite: unknown;
            await routeLanguage(page, (request) => {
                languageWrite = request.postDataJSON();
            });

            await page.goto('/settings/language');

            await expect(
                page.getByRole('heading', { name: 'Language', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Current language' }),
            ).toBeVisible();

            const back = page.getByRole('link', { name: 'Settings' });
            const selector = page.getByRole('combobox', {
                name: 'Current language',
            });
            const save = page.getByRole('button', { name: 'Save' });
            await expect(back).toHaveAttribute('href', '/settings');
            await expectBounded(back, viewport);
            await expectBounded(selector, viewport);
            await expect(save).toBeDisabled();

            await selector.click();
            await page.getByRole('option', { name: 'German (Deutsch)' }).click();
            await expect(save).toBeEnabled();
            await save.click();

            await expect.poll(() => languageWrite).toEqual({ locale: 'de' });
            await expect
                .poll(() => page.getByRole('button', { name: 'Save' }).isDisabled())
                .toBe(true);
            await expect(
                page.getByRole('combobox', { name: 'Current language' }),
            ).toContainText('German');
        });
    });
}

test('keeps the copied form retryable when the Rust language write is unavailable', async ({
    page,
}) => {
    await routeLanguage(page, undefined, 503);

    await page.goto('/settings/language');
    await page.getByRole('combobox', { name: 'Current language' }).click();
    await page.getByRole('option', { name: 'German (Deutsch)' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
    await expect(page.getByText(/saved/i)).toHaveCount(0);
});

test('renders an explicit unavailable state when the Rust language read fails', async ({
    page,
}) => {
    await routeSharedSettingsReads(page, () => 'en', false);
    await page.route('**/api/v1/learner/language-preference', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                code: 'dependency_unavailable',
                title: 'A required service is unavailable.',
            }),
            contentType: 'application/json',
            status: 503,
        });
    });

    await page.goto('/settings/language');

    await expect(page.getByText('Language settings are unavailable.')).toBeVisible();
    await expect(
        page.getByText(
            'The language preference or Settings presentation projection is currently unavailable.',
        ),
    ).toBeVisible();
});

async function routeLanguage(
    page: Page,
    onLanguageWrite?: (request: Request) => void,
    writeStatus = 200,
) {
    let locale = 'en';
    await routeSharedSettingsReads(page, () => locale, false);
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ token: 'language-csrf' }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/learner/language-preference', async (route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                body: JSON.stringify({
                    available_languages: availableLanguages(),
                    locale,
                }),
                contentType: 'application/json',
            });

            return;
        }

        onLanguageWrite?.(route.request());
        const body = route.request().postDataJSON() as { locale: string };
        if (writeStatus === 200) {
            locale = body.locale;
        }
        await route.fulfill({
            body: JSON.stringify({
                available_languages: availableLanguages(),
                locale,
            }),
            contentType: 'application/json',
            status: writeStatus,
        });
    });
}

async function routeSharedSettingsReads(
    page: Page,
    locale = () => 'en',
    includeLanguagePreference = true,
) {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                appearance: 'light', avatar_url: null, can_view_media_paths: false,
                capabilities: [], email: 'language@example.test', name: 'Language Tester',
                roles: ['learner'], settings_access: {},
                subject_id: '00000000-0000-4000-8000-000000000001', username: null,
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/public/welcome', async (route) => {
        await route.fulfill({ body: JSON.stringify(welcomeProjection()) });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ locale: locale(), translations: {} }),
            contentType: 'application/json',
        });
    });
    if (includeLanguagePreference) {
        await page.route('**/api/v1/learner/language-preference', async (route) => {
            await route.fulfill({
                body: JSON.stringify({
                    available_languages: availableLanguages(),
                    locale: locale(),
                }),
                contentType: 'application/json',
            });
        });
    }
}

function availableLanguages() {
    return [
        { code: 'en', name: 'English', native_name: 'English' },
        { code: 'de', name: 'German', native_name: 'Deutsch' },
    ];
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
    const authTheme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#fff', button_text_color: '#fff', input_background: '#07111f', panel_background: '#07111f' };
    const publicPalette = { accent_text: '#5eead4', accent_text_opacity: 100, body_text: '#e2e8f0', body_text_opacity: 100, control_border: '#fff', control_border_opacity: 100, control_text: '#fff', control_text_opacity: 100, heading_text: '#fff', heading_text_opacity: 100, muted_text: '#94a3b8', muted_text_opacity: 100, welcome_overlay: '#020617', welcome_overlay_opacity: 62 };
    const settingsPalette = { accent: '#9f1239', accent_opacity: 100, accent_foreground: '#f8fafc', accent_foreground_opacity: 100, active_background: '#fce7f3', active_background_opacity: 100, appearance_switch_background: '#fce7f3', appearance_switch_background_opacity: 100, appearance_switch_active_background: '#fff', appearance_switch_active_background_opacity: 100, appearance_switch_active_text: '#9f1239', appearance_switch_active_text_opacity: 100, appearance_switch_inactive_text: '#64748b', appearance_switch_inactive_text_opacity: 100, border_color: '#9f1239', border_color_opacity: 25, content_background: '#fff1f2', content_background_opacity: 100, input_background: '#fff', input_background_opacity: 100, input_border_color: '#9f1239', input_border_color_opacity: 25, muted_text: '#475569', muted_text_opacity: 100, nested_sidebar_background: '#ffe4e6', nested_sidebar_background_opacity: 100, panel_background: '#fff', panel_background_opacity: 100, scrollbar_thumb: '#9f1239', scrollbar_thumb_opacity: 100, sidebar_background: '#ffe4e6', sidebar_background_opacity: 100 };

    return { appearance: 'light', auth: { user: { id: '00000000-0000-4000-8000-000000000001' } }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: authTheme, light: authTheme }, register: { dark: authTheme, light: authTheme }, welcome: { dark: authTheme, light: authTheme } }, cursors: {}, information_pages: [], public_palette: { dark: publicPalette, light: publicPalette }, settings_palette: { dark: settingsPalette, light: settingsPalette }, welcome: { pages: [] } } };
}
