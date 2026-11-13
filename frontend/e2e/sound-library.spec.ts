import { expect, test } from './authenticated';

test('an authorized administrator can store, preview, publish and delete a reusable sound', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-assets-world-objects&asset=sounds');
    await expect(page.getByRole('heading', { name: 'Reusable sound library' })).toBeVisible();
    await page.getByRole('button', { name: 'Create sound' }).first().click();

    const upload = page.waitForResponse((response) =>
        response.request().method() === 'POST' && response.url().endsWith('/api/v1/admin/sounds/media'),
    );
    await page.locator('input[type="file"]').setInputFiles({
        buffer: Buffer.from('RIFF0000WAVEfmt '),
        mimeType: 'audio/wav',
        name: 'signal.wav',
    });
    expect((await upload).status()).toBe(201);

    const name = `Sound check ${Date.now()}`;
    await page.getByLabel('Sound name').fill(name);
    await page.getByLabel('Sound slug').fill(`sound-check-${Date.now()}`);
    const create = page.waitForResponse((response) =>
        response.request().method() === 'POST' && response.url().endsWith('/api/v1/admin/sounds'),
    );
    await page.getByRole('button', { name: 'Create sound' }).last().click();
    const created = await create;
    expect(created.status()).toBe(201);
    const sound = await created.json() as { sound: { id: string; url: string } };
    await expect(page.getByRole('button', { name })).toBeVisible();

    const publicAudio = await page.request.get(sound.sound.url);
    expect(publicAudio.status()).toBe(200);
    expect(publicAudio.headers()['content-type']).toBe('audio/wav');

    page.once('dialog', (dialog) => dialog.accept());
    const deletion = page.waitForResponse((response) =>
        response.request().method() === 'DELETE' && response.url().includes(`/api/v1/admin/sounds/${sound.sound.id}`),
    );
    await page.getByRole('button', { name: 'Delete sound' }).click();
    expect((await deletion).status()).toBe(204);
    expect((await page.request.get(sound.sound.url)).status()).toBe(404);
});
