import { expect, test } from './authenticated';

test('a local author restores a scoped MapAsset configuration version', async ({
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

    const original = `MapAsset history ${Date.now()}`;
    const changed = `${original} changed`;
    const mapTitle = `Disposable ${original}`;

    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(mapTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: mapTitle })).toBeVisible();

    const graph = (await (
        await page.request.get('/api/v1/admin/world-builder')
    ).json()) as { maps: Array<{ id: string; title: string }> };
    const map = graph.maps.find((candidate) => candidate.title === mapTitle);

    if (!map) {
        throw new Error('the disposable map was not created');
    }

    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/maps/${map.id}/assets`),
    );
    await page.getByRole('button', { name: 'Add MapAsset' }).click();
    expect((await created).status()).toBe(201);

    const document = (await (
        await page.request.get(`/api/v1/admin/world-builder/maps/${map.id}`)
    ).json()) as {
        editable_map: { map: { map_assets: Array<{ id: string }> } };
    };
    const asset = document.editable_map.map.map_assets[0];

    if (!asset) {
        throw new Error('the disposable MapAsset was not created');
    }

    const openAsset = async () => {
        await page
            .locator(`[data-wl-id="authoring.map-asset.select.${asset.id}"]`)
            .click();
        await expect(
            page.locator('[aria-labelledby="map-asset-editor-title"]'),
        ).toBeVisible();
    };
    const save = async () => {
        const saved = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                response
                    .url()
                    .includes(`/api/v1/admin/world-builder/assets/${asset.id}`),
        );
        await page.getByRole('button', { name: 'Save MapAsset' }).click();
        expect((await saved).status()).toBe(204);
    };

    await openAsset();
    await page.getByLabel('Label shown on the MapAsset').fill(original);
    await save();
    await openAsset();
    await page.getByLabel('Label shown on the MapAsset').fill(changed);
    await save();
    await openAsset();
    await page.getByRole('button', { name: 'Previous versions' }).click();

    const history = page.locator(
        '[data-wl-id="authoring.map-asset-history.dialog"]',
    );
    await expect(history.getByText(original, { exact: true })).toBeVisible();
    const originalVersion = history
        .getByText(original, { exact: true })
        .locator('xpath=../..');

    page.once('dialog', (dialog) => dialog.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/assets/${asset.id}/versions/`),
    );
    await originalVersion
        .getByRole('button', { name: 'Restore this version' })
        .click();
    expect((await restored).status()).toBe(200);
    await expect(page.getByLabel('Label shown on the MapAsset')).toHaveValue(
        original,
    );
    await history.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect
        .poll(async () => {
            const response = await page.request.get(
                `/api/v1/admin/world-builder/maps/${map.id}`,
            );
            const current = (await response.json()) as {
                editable_map: {
                    map: { map_assets: Array<{ id: string; text: string | null }> };
                };
            };

            return current.editable_map.map.map_assets.find(
                (candidate) => candidate.id === asset.id,
            )?.text;
        })
        .toBe(original);

    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
