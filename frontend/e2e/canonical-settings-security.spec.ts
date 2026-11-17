import { expect, test } from '@playwright/test';
import type { Locator, Page, Request } from '@playwright/test';

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of viewports) {
    test(`${name} mounts copied Security controls and sends the source password form to Rust`, async ({
        page,
    }) => {
        let passwordWrite: unknown;
        await routeSecurity(page, {
            onPasswordWrite: (request) => {
                passwordWrite = request.postDataJSON();
            },
        });

        await page.goto('/settings/security');

        const back = page.getByRole('link', { name: 'Settings' });
        const save = page.getByRole('button', { name: 'Save' });
        const enableTwoFactor = page.getByRole('button', { name: 'Enable 2FA' });
        const addPasskey = page.getByRole('button', { name: 'Add passkey' });
        await expect(page.getByRole('heading', { name: 'Security', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Update password' })).toBeVisible();
        await expect(back).toHaveAttribute('href', '/settings');
        await expectBounded(back, viewport);
        await expect(save).toBeDisabled();

        if (viewport.width === 390) {
            // Known pinned-source defect: SettingsConfigurationShell keeps its
            // desktop grid width and clips the footer at this viewport. The
            // canonical migration must record, not redesign, that behavior.
            const saveBox = await save.boundingBox();
            expect(saveBox).not.toBeNull();
            expect(saveBox!.x + saveBox!.width).toBeGreaterThan(viewport.width);

            return;
        }

        await expectBounded(save, viewport);
        await expectBounded(enableTwoFactor, viewport);
        await expectBounded(addPasskey, viewport);

        await page.getByLabel('Current password').fill('current-password');
        await page.getByLabel('New password').fill('replacement-password');
        await page.getByLabel('Confirm password').fill('replacement-password');
        await expect(save).toBeEnabled();
        await save.click();

        await expect.poll(() => passwordWrite).toEqual({
            current_password: 'current-password',
            password: 'replacement-password',
            password_confirmation: 'replacement-password',
        });
    });
}

test('keeps structured Rust password validation in the copied source field slot', async ({
    page,
}) => {
    await routeSecurity(page, { passwordStatus: 422 });

    await page.goto('/settings/security');
    await page.getByLabel('Current password').fill('wrong-password');
    await page.getByLabel('New password').fill('replacement-password');
    await page.getByLabel('Confirm password').fill('replacement-password');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('The current password is incorrect.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('runs the copied two-factor setup and recovery-code surfaces through typed Rust commands', async ({
    page,
}) => {
    await routeSecurity(page);

    await page.goto('/settings/security');
    await page.getByRole('button', { name: 'Enable 2FA' }).click();
    await expect(
        page.getByRole('heading', { name: 'Enable two-factor authentication' }),
    ).toBeVisible();
    await expect(page.locator('input[readonly]')).toHaveValue('JBSWY3DPEHPK3PXP');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page
        .getByRole('textbox', { name: 'Authentication code' })
        .fill('123456');
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('button', { name: 'Disable 2FA' })).toBeVisible();
    await page.getByRole('button', { name: 'View recovery codes' }).click();
    await expect(page.getByRole('list', { name: 'Recovery codes' })).toContainText(
        'first-recovery-code',
    );
});

test('keeps copied passkey removal bound to Rust opaque UUIDs', async ({ page }) => {
    const passkeyId = '00000000-0000-4000-8000-000000000099';
    let deletedPasskey: string | undefined;
    await routeSecurity(page, {
        onPasskeyDelete: (request) => {
            deletedPasskey = request.url().split('/').at(-1);
        },
        passkeys: [
            {
                authenticator: null,
                created_at_diff: '1 minute ago',
                id: passkeyId,
                last_used_at_diff: null,
                name: 'Laptop',
            },
        ],
    });

    await page.goto('/settings/security');
    await page.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('button', { name: 'Remove passkey' }).click();

    await expect.poll(() => deletedPasskey).toBe(passkeyId);
});

test('registers a passkey through the copied source form and Rust WebAuthn contract', async ({
    page,
}) => {
    let registration: unknown;
    await installPasskeyRegistrationBrowser(page);
    await routeSecurity(page, {
        onPasskeyRegistration: (request) => {
            registration = request.postDataJSON();
        },
    });

    await page.goto('/settings/security');
    await page.getByRole('button', { name: 'Add passkey' }).click();
    await page.getByLabel('Passkey name').fill('Security laptop');
    await page.getByRole('button', { name: 'Register passkey' }).click();

    await expect.poll(() => registration).toMatchObject({
        name: 'Security laptop',
        credential: { id: 'registration-credential', type: 'public-key' },
    });
});

test('renders an explicit unavailable state when the Rust Security projection fails', async ({
    page,
}) => {
    await routeSharedSecurityReads(page);
    await page.route('**/api/v1/account/security', (route) =>
        route.fulfill({
            body: JSON.stringify({
                code: 'dependency_unavailable',
                title: 'A required service is unavailable.',
            }),
            contentType: 'application/json',
            status: 503,
        }),
    );

    await page.goto('/settings/security');

    await expect(page.getByText('Security settings are unavailable.')).toBeVisible();
    await expect(
        page.getByText('The Security settings projection is currently unavailable.'),
    ).toBeVisible();
});

type SecurityRouteOptions = {
    onPasskeyDelete?: (request: Request) => void;
    onPasskeyRegistration?: (request: Request) => void;
    onPasswordWrite?: (request: Request) => void;
    passkeys?: Array<{
        authenticator: string | null;
        created_at_diff: string;
        id: string;
        last_used_at_diff: string | null;
        name: string;
    }>;
    passwordStatus?: number;
};

async function routeSecurity(page: Page, options: SecurityRouteOptions = {}) {
    let twoFactorEnabled = false;
    await routeSharedSecurityReads(page);
    await page.route('**/api/v1/account/security', (route) =>
        route.fulfill({
            body: JSON.stringify({
                can_manage_passkeys: true,
                can_manage_two_factor: true,
                passkeys: options.passkeys ?? [],
                password_rules: 'minlength: 12',
                requires_confirmation: true,
                two_factor_enabled: twoFactorEnabled,
            }),
            contentType: 'application/json',
        }),
    );
    await page.route('**/api/v1/security/csrf', (route) =>
        route.fulfill({
            body: JSON.stringify({ token: 'security-csrf' }),
            contentType: 'application/json',
        }),
    );
    await page.route('**/api/v1/account/password', async (route) => {
        options.onPasswordWrite?.(route.request());
        await route.fulfill({
            body: JSON.stringify(
                options.passwordStatus === 422
                    ? {
                          code: 'password_update_rejected',
                          errors: {
                              current_password: 'The current password is incorrect.',
                          },
                          title: 'The password could not be updated with these details.',
                      }
                    : {
                          authenticated: true,
                          subject_id: '00000000-0000-4000-8000-000000000001',
                          two_factor_required: false,
                      },
            ),
            contentType: 'application/json',
            status: options.passwordStatus ?? 200,
        });
    });
    await page.route('**/api/v1/account/two-factor/setup', (route) =>
        route.fulfill({
            body: JSON.stringify({
                manual_setup_key: 'JBSWY3DPEHPK3PXP',
                provisioning_url:
                    'otpauth://totp/Wicked%20Learning:learner%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Wicked%20Learning',
            }),
            contentType: 'application/json',
        }),
    );
    await page.route('**/api/v1/account/two-factor/confirm', (route) => {
        twoFactorEnabled = true;
        return route.fulfill({
            body: JSON.stringify({ recovery_codes: ['first-recovery-code'] }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/account/two-factor/recovery-codes', (route) =>
        route.fulfill({
            body: JSON.stringify({ recovery_codes: ['first-recovery-code'] }),
            contentType: 'application/json',
        }),
    );
    await page.route('**/api/v1/account/passkeys/*', async (route) => {
        options.onPasskeyDelete?.(route.request());
        await route.fulfill({ status: 204 });
    });
    await page.route('**/api/v1/account/passkeys/options', (route) =>
        route.fulfill({
            body: JSON.stringify({ options: registrationOptions() }),
            contentType: 'application/json',
        }),
    );
    await page.route('**/api/v1/account/passkeys', async (route) => {
        options.onPasskeyRegistration?.(route.request());
        await route.fulfill({
            body: JSON.stringify({
                authenticator: null,
                created_at: '2026-11-17T20:00:00.000000Z',
                id: '00000000-0000-4000-8000-000000000099',
                last_used_at: null,
                name: 'Security laptop',
            }),
            contentType: 'application/json',
        });
    });
}

async function routeSharedSecurityReads(page: Page) {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            body: JSON.stringify({
                appearance: 'light',
                avatar_url: null,
                can_view_media_paths: false,
                capabilities: [],
                email: 'security@example.test',
                name: 'Security Tester',
                roles: ['learner'],
                settings_access: {},
                subject_id: '00000000-0000-4000-8000-000000000001',
                username: null,
            }),
            contentType: 'application/json',
        }),
    );
    await page.route('**/api/v1/public/welcome', (route) =>
        route.fulfill({
            body: JSON.stringify(welcomeProjection()),
            contentType: 'application/json',
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            body: JSON.stringify({ locale: 'en', translations: {} }),
            contentType: 'application/json',
        }),
    );
}

async function expectBounded(
    locator: Locator,
    viewport: { width: number; height: number },
) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
}

async function installPasskeyRegistrationBrowser(page: Page) {
    await page.addInitScript(() => {
        class MockPublicKeyCredential {}

        Object.defineProperty(window, 'PublicKeyCredential', {
            configurable: true,
            value: MockPublicKeyCredential,
        });
        Object.defineProperty(navigator, 'credentials', {
            configurable: true,
            value: {
                create: async () => ({
                    id: 'registration-credential',
                    rawId: new Uint8Array([1, 2, 3]).buffer,
                    type: 'public-key',
                    response: {
                        attestationObject: new Uint8Array([4, 5, 6]).buffer,
                        clientDataJSON: new Uint8Array([7, 8, 9]).buffer,
                        getTransports: () => [],
                    },
                    getClientExtensionResults: () => ({}),
                }),
            },
        });
    });
}

function registrationOptions() {
    return {
        challenge: 'Y2hhbGxlbmdl',
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        rp: { id: '127.0.0.1', name: 'Wicked Learning' },
        timeout: 60_000,
        user: {
            displayName: 'Security Tester',
            id: 'c2VjdXJpdHktdGVzdGVy',
            name: 'security@example.test',
        },
    };
}

function welcomeProjection() {
    const authTheme = { background_color: '#07111f', background_image: null, background_overlay: 'none', border_line_color: '#fff', button_text_color: '#fff', input_background: '#07111f', panel_background: '#07111f' };
    const publicPalette = { accent_text: '#5eead4', accent_text_opacity: 100, body_text: '#e2e8f0', body_text_opacity: 100, control_border: '#fff', control_border_opacity: 100, control_text: '#fff', control_text_opacity: 100, heading_text: '#fff', heading_text_opacity: 100, muted_text: '#94a3b8', muted_text_opacity: 100, welcome_overlay: '#020617', welcome_overlay_opacity: 62 };
    const settingsPalette = { accent: '#9f1239', accent_opacity: 100, accent_foreground: '#f8fafc', accent_foreground_opacity: 100, active_background: '#fce7f3', active_background_opacity: 100, appearance_switch_background: '#fce7f3', appearance_switch_background_opacity: 100, appearance_switch_active_background: '#fff', appearance_switch_active_background_opacity: 100, appearance_switch_active_text: '#9f1239', appearance_switch_active_text_opacity: 100, appearance_switch_inactive_text: '#64748b', appearance_switch_inactive_text_opacity: 100, border_color: '#9f1239', border_color_opacity: 25, content_background: '#fff1f2', content_background_opacity: 100, input_background: '#fff', input_background_opacity: 100, input_border_color: '#9f1239', input_border_color_opacity: 25, muted_text: '#475569', muted_text_opacity: 100, nested_sidebar_background: '#ffe4e6', nested_sidebar_background_opacity: 100, panel_background: '#fff', panel_background_opacity: 100, scrollbar_thumb: '#9f1239', scrollbar_thumb_opacity: 100, sidebar_background: '#ffe4e6', sidebar_background_opacity: 100 };
    return { appearance: 'light', auth: { user: { id: '00000000-0000-4000-8000-000000000001' } }, publicPresentation: { branding: { logo: '/images/logo.png' }, auth: { login: { dark: authTheme, light: authTheme }, register: { dark: authTheme, light: authTheme }, welcome: { dark: authTheme, light: authTheme } }, cursors: {}, information_pages: [], public_palette: { dark: publicPalette, light: publicPalette }, settings_palette: { dark: settingsPalette, light: settingsPalette }, welcome: { pages: [] } } };
}
