import { expect, test } from '@playwright/test';
import type { Locator, Page, Request } from '@playwright/test';

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of viewports) {
    test.describe(`${name} canonical Profile settings`, () => {
        test.use({ viewport });

        test('mounts copied profile controls and saves the bounded Rust profile document', async ({
            page,
        }) => {
            let profileWrite: unknown;
            await routeProfile(page, (request) => {
                profileWrite = request.postDataJSON();
            });

            await page.goto('/settings/profile');

            await expect(
                page.getByRole('heading', { name: 'Profile', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Profile details' }),
            ).toBeVisible();

            const back = page.getByRole('link', { name: 'Settings' });
            const nameField = page.getByRole('textbox', {
                name: 'Name',
                exact: true,
            });
            const username = page.getByRole('textbox', {
                name: 'Public username',
            });
            const email = page.getByRole('textbox', { name: 'Email address' });
            const upload = page.getByRole('button', { name: 'Upload' });
            const save = page.getByRole('button', { name: 'Save' });

            await expect(back).toHaveAttribute('href', '/settings');
            await expectBounded(back, viewport);
            await expectBounded(nameField, viewport);
            await expectBounded(username, viewport);
            await expectBounded(email, viewport);
            await expectBounded(upload, viewport);
            await expectBounded(save, viewport);
            await expect(save).toBeDisabled();

            await nameField.fill('Updated Profile');
            await username.fill('updated-profile');
            await save.click();

            await expect.poll(() => profileWrite).toEqual({
                email: 'profile@example.test',
                name: 'Updated Profile',
                profile_image_id: null,
                username: 'updated-profile',
            });
            await expect(nameField).toHaveValue('Updated Profile');
            await expect(username).toHaveValue('updated-profile');
        });
    });
}

test('maps a Rust-staged profile image URL back to its opaque ID on the copied form save', async ({
    page,
}) => {
    let profileWrite: unknown;
    await routeProfile(page, (request) => {
        profileWrite = request.postDataJSON();
    });

    await page.goto('/settings/profile');
    await page.locator('#profile-image-upload').setInputFiles({
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimeType: 'image/png',
        name: 'profile.png',
    });
    await expect(page.locator('img[src^="/api/v1/profile-images/"]')).toHaveAttribute(
        'src',
        '/api/v1/profile-images/00000000-0000-4000-8000-000000000099',
    );

    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => profileWrite).toEqual({
        email: 'profile@example.test',
        name: 'Profile Tester',
        profile_image_id: '00000000-0000-4000-8000-000000000099',
        username: 'profile-tester',
    });
});

test('keeps the copied profile form retryable when the Rust write is unavailable', async ({
    page,
}) => {
    await routeProfile(page, undefined, 503);

    await page.goto('/settings/profile');
    await page
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('Retry Profile');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
        page.getByText('Profile settings are currently unavailable.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('places a structured Rust validation rejection in the copied source field slot', async ({
    page,
}) => {
    await routeProfile(page, undefined, 422, {
        code: 'profile_update_rejected',
        errors: { username: 'The username has already been taken.' },
        title: 'The profile could not be updated with these details.',
    });

    await page.goto('/settings/profile');
    await page
        .getByRole('textbox', { name: 'Public username' })
        .fill('taken-name');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
        page.getByText('The username has already been taken.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('does not turn a source-visible raw media path into fabricated Rust image data', async ({
    page,
}) => {
    await routeProfile(page, undefined, 200, undefined, true);

    await page.goto('/settings/profile');
    await page.locator('#profile-image').fill('/storage/profiles/example.webp');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
        page.getByText('The selected profile image is not available.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('renders an explicit unavailable state when the Rust profile read fails', async ({
    page,
}) => {
    await routeSharedProfileReads(page);
    await page.route('**/api/v1/account/profile', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                code: 'dependency_unavailable',
                title: 'A required service is unavailable.',
            }),
            contentType: 'application/json',
            status: 503,
        });
    });

    await page.goto('/settings/profile');

    await expect(page.getByText('Profile settings are unavailable.')).toBeVisible();
    await expect(
        page.getByText(
            'The current profile or Settings presentation projection is currently unavailable.',
        ),
    ).toBeVisible();
});

async function routeProfile(
    page: Page,
    onProfileWrite?: (request: Request) => void,
    profileWriteStatus = 200,
    profileWriteBody?: object,
    canViewMediaPaths = false,
) {
    let profile = {
        email: 'profile@example.test',
        name: 'Profile Tester',
        profile_image_id: null as string | null,
        profile_image_url: null as string | null,
        username: 'profile-tester' as string | null,
    };
    await routeSharedProfileReads(page, canViewMediaPaths);
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ token: 'profile-csrf' }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/account/profile/image', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                profile_image_id: '00000000-0000-4000-8000-000000000099',
                url: '/api/v1/profile-images/00000000-0000-4000-8000-000000000099',
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/account/profile', async (route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                body: JSON.stringify(profile),
                contentType: 'application/json',
            });

            return;
        }

        onProfileWrite?.(route.request());
        const body = route.request().postDataJSON() as typeof profile;
        if (profileWriteStatus === 200) {
            profile = {
                ...body,
                profile_image_url: body.profile_image_id
                    ? `/api/v1/profile-images/${body.profile_image_id}`
                    : null,
            };
        }
        await route.fulfill({
            body: JSON.stringify(profileWriteBody ?? profile),
            contentType: 'application/json',
            status: profileWriteStatus,
        });
    });
}

async function routeSharedProfileReads(page: Page, canViewMediaPaths = false) {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                appearance: 'light',
                avatar_url: null,
                can_view_media_paths: canViewMediaPaths,
                capabilities: [],
                email: 'profile@example.test',
                name: 'Profile Tester',
                roles: ['learner'],
                settings_access: {},
                subject_id: '00000000-0000-4000-8000-000000000001',
                username: 'profile-tester',
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
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ locale: 'en', translations: {} }),
            contentType: 'application/json',
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
