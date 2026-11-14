import { expect, installE2eAdminSession, test } from './authenticated';

test('a learner saves private source-shaped sound preferences from the account menu', async ({ page, request }) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable local identity',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;
    const before = await request.get('/api/v1/learner/sound-preferences');
    expect(before.ok()).toBeTruthy();
    const current = (await before.json()) as {
        ambience_volume: number;
        effects_volume: number;
        muted: boolean;
    };
    const expected = {
        ambience_volume: current.ambience_volume === 65 ? 64 : 65,
        effects_volume: current.effects_volume === 35 ? 36 : 35,
        muted: !current.muted,
    };

    await page.goto('/settings?panel=personal&personal=sound');
    await expect(page.getByRole('heading', { name: 'Sound', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Audio preferences' })).toBeVisible();
    await page.getByRole('button', { name: 'Mute all sound' }).click();
    await page.getByRole('slider', { name: 'Effects volume' }).fill(String(expected.effects_volume));
    await page.getByRole('slider', { name: 'Ambience volume' }).fill(String(expected.ambience_volume));
    await page.locator('footer').getByRole('button', { name: 'Save' }).click();
    await expect
        .poll(async () => {
            const saved = await request.get('/api/v1/learner/sound-preferences');
            return saved.json();
        })
        .toEqual(expected);
});
