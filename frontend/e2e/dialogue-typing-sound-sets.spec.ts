import { expect, test } from '@playwright/test';

test('an authorized administrator creates a complete dialogue typing set and replaces one letter', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-assets&asset=dialogue-sounds');
    await expect(page.getByRole('heading', { name: 'Letter sound sets' })).toBeVisible();
    await page.getByRole('button', { name: 'New set' }).click();
    const suffix = Date.now();
    const name = `Typing keys ${suffix}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Slug').fill(`typing-keys-${suffix}`);
    await page.locator('input[type="file"]').first().setInputFiles(
        Array.from({ length: 26 }, (_, index) => ({
            buffer: Buffer.from('RIFF0000WAVEfmt '),
            mimeType: 'audio/wav',
            name: `${String.fromCharCode(97 + index)}.wav`,
        })),
    );
    const creation = page.waitForResponse((response) =>
        response.request().method() === 'POST' && response.url().endsWith('/api/v1/admin/dialogue-typing-sound-sets'),
    );
    await page.getByRole('button', { name: 'Create set' }).click();
    expect((await creation).status()).toBe(201);
    await expect(page.getByRole('button', { name })).toBeVisible();
    await expect(page.getByRole('button', { name })).toContainText('26/26 letters');

    const replacement = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' && /\/api\/v1\/admin\/dialogue-typing-sound-sets\/[^/]+\/sounds\/a$/.test(response.url()),
    );
    await page.locator('#dialogue-typing-sound-a').setInputFiles({
        buffer: Buffer.from('RIFF0000WAVEfmt '),
        mimeType: 'audio/wav',
        name: 'a.wav',
    });
    expect((await replacement).status()).toBe(200);
    await expect(page.getByRole('status')).toContainText('A sound was replaced.');
});
