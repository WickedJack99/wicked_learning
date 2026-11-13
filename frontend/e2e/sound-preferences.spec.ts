import { expect, installE2eAdminSession, test } from './authenticated';

test('a learner saves private source-shaped sound preferences from the account menu', async ({ page, request }) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable local identity',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;
    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);
    await page.goto('/home');
    await page.getByRole('button', { name: 'Open user menu' }).click();
    await page.getByRole('menuitem', { name: 'Sound preferences' }).click();
    await expect(page.getByRole('dialog', { name: 'Audio preferences' })).toBeVisible();
    await page.getByRole('button', { name: 'Sound enabled' }).click();
    const sliders = page.locator('input[type="range"]');
    await sliders.nth(0).fill('35');
    await sliders.nth(1).fill('65');
    await page.getByRole('button', { name: 'Save sound preferences' }).click();
    await page.getByRole('button', { name: 'Close audio preferences' }).click();
    const saved = await request.get('/api/v1/learner/sound-preferences');
    await expect(saved.json()).resolves.toEqual({ muted: true, effects_volume: 35, ambience_volume: 65 });
});
