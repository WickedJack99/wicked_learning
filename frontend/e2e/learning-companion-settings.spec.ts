import { expect, test } from './authenticated';

test('a local administrator can save bounded Learning Companion platform settings', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const original = await page.request.get('/api/v1/admin/learning-companion');
    expect(original.status()).toBe(200);
    const originalSettings = await original.json();
    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const headers = {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': token,
    };
    const replacement = {
        ...originalSettings,
        ai_capabilities: ['current-context', 'nearby-places'],
        avatar_color: '#13579b',
        display_name: `Companion ${Date.now()}`,
        mode: 'guided_ai',
        welcome_message: 'Choose a direction whenever you want one.',
    };
    delete replacement.ai_template_options;

    try {
        const saved = await page.request.patch('/api/v1/admin/learning-companion', {
            data: replacement,
            headers,
        });
        expect(saved.status()).toBe(200);
        const settings = await saved.json();
        expect(settings.display_name).toBe(replacement.display_name);
        expect(settings.avatar_color).toBe('#13579b');
        expect(settings.ai_capabilities).toEqual([
            'current-context',
            'nearby-places',
        ]);
    } finally {
        const restore = { ...originalSettings };
        delete restore.ai_template_options;
        expect(
            (
                await page.request.patch('/api/v1/admin/learning-companion', {
                    data: restore,
                    headers,
                })
            ).status(),
        ).toBe(200);
    }
});
