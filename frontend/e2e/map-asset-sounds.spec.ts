import { expect, test } from '@playwright/test';

test('a local author selects a reusable MapAsset interaction sound', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const title = `MapAsset sound ${Date.now()}`;
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const map = graph.maps.find((candidate) => candidate.title === title);
    if (!map) throw new Error('the disposable MapAsset sound map was not created');

    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/maps/${map.id}/assets`),
    );
    await page.getByRole('button', { name: 'Add MapAsset' }).click();
    expect((await created).status()).toBe(201);

    const documentResponse = await page.request.get(
        `/api/v1/admin/world-builder/maps/${map.id}`,
    );
    expect(documentResponse.ok()).toBeTruthy();
    const document = (await documentResponse.json()) as {
        editable_map: { map: { map_assets: Array<{ id: string }> } };
        sounds: Array<{ id: string; name: string }>;
    };
    const asset = document.editable_map.map.map_assets[0];
    const sound = document.sounds[0];
    if (!asset || !sound) {
        throw new Error('the local stack needs a MapAsset and reusable sound');
    }

    await page
        .locator(`[data-wl-id="authoring.map-asset.select.${asset.id}"]`)
        .click();
    await page.getByLabel('Enable Click sound').check();
    await page.getByLabel('Click sound', { exact: true }).selectOption(sound.id);
    const saved = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/assets/${asset.id}`),
    );
    await page.getByRole('button', { name: 'Save MapAsset' }).click();
    expect((await saved).status()).toBe(204);

    const savedDocument = await page.request.get(
        `/api/v1/admin/world-builder/maps/${map.id}`,
    );
    const savedAsset = (
        (await savedDocument.json()) as {
            editable_map: {
                map: {
                    map_assets: Array<{
                        id: string;
                        visual_config: { sounds?: { click?: { soundId?: string } } };
                    }>;
                };
            };
        }
    ).editable_map.map.map_assets.find((candidate) => candidate.id === asset.id);
    expect(savedAsset?.visual_config.sounds?.click?.soundId).toBe(sound.id);

    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
