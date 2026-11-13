import { expect, test } from './authenticated';

test('a local author can edit and restore current World details', async ({
    page,
}) => {
    test.setTimeout(60_000);
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        world: { description: string; title: string };
    };
    const original = graph.world;
    const updatedTitle = `World detail check ${Date.now()}`;
    const updatedDescription =
        'A disposable World description used to verify version restoration.';

    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Edit world details' }).click();
    const dialog = page.locator(
        '[data-wl-id="authoring.world-builder.world-details.dialog"]',
    );
    await expect(dialog.getByRole('heading', { name: 'Edit world details' })).toBeVisible();
    await dialog.getByLabel('Title').fill(updatedTitle);
    await dialog.getByLabel('Description').fill(updatedDescription);
    const saved = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/admin/world-builder/world/details'),
    );
    await dialog.getByRole('button', { name: 'Save details' }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();

    const historyResponse = await page.request.get(
        '/api/v1/admin/world-builder/world/versions?page=1&per_page=24',
    );
    expect(historyResponse.ok()).toBeTruthy();
    const history = (await historyResponse.json()) as {
        items: Array<{ description: string; id: string; title: string }>;
    };
    expect(history.items).toContainEqual(
        expect.objectContaining({
            description: original.description,
            title: original.title,
        }),
    );

    await page.getByRole('button', { name: 'Edit world details' }).click();
    const restoreDialog = page.locator(
        '[data-wl-id="authoring.world-builder.world-details.dialog"]',
    );
    await expect(restoreDialog.getByText(original.title, { exact: true })).toBeVisible();
    page.once('dialog', (confirm) => confirm.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes('/api/v1/admin/world-builder/world/versions/'),
    );
    await restoreDialog
        .getByRole('button', { name: 'Restore this version' })
        .click();
    expect((await restored).status()).toBe(200);
    await expect(restoreDialog.getByLabel('Title')).toHaveValue(original.title);
    await expect(restoreDialog.getByLabel('Description')).toHaveValue(
        original.description,
    );
    await restoreDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: original.title })).toBeVisible();
});
