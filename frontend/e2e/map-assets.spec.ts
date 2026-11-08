import { expect, test } from '@playwright/test';

test('a local author manages source-shaped MapAssets and reusable visual references', async ({
    page,
}) => {
    test.setTimeout(60_000);
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-assets');
    const upload = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/api/v1/admin/media-assets'),
    );
    await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
            buffer: Buffer.from(
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#0f766e"/></svg>',
            ),
            mimeType: 'image/svg+xml',
            name: 'map-asset-visual.svg',
        });
    const uploaded = await upload;
    expect(uploaded.status()).toBe(201);
    const media = (await uploaded.json()) as {
        asset: { id: string; url: string };
    };
    const mediaName = `MapAsset visual ${Date.now()}`;
    await page.getByLabel('Visual name').fill(mediaName);
    const mediaMetadata = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(`/api/v1/admin/media-assets/${media.asset.id}`),
    );
    await page.getByRole('button', { name: 'Save details' }).click();
    expect((await mediaMetadata).status()).toBe(200);

    await page.goto('/settings?panel=admin-world-builder');
    const title = `Disposable MapAsset ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(
        page.locator('[data-wl-id="authoring.map-asset.surface"]'),
    ).toBeVisible();

    const graph = (await (
        await page.request.get('/api/v1/admin/world-builder')
    ).json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const map = graph.maps.find((candidate) => candidate.title === title);
    if (!map) throw new Error('the disposable map was not created');

    const addAsset = async () => {
        const created = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response
                    .url()
                    .includes(
                        `/api/v1/admin/world-builder/maps/${map.id}/assets`,
                    ),
        );
        await page.getByRole('button', { name: 'Add MapAsset' }).click();
        expect((await created).status()).toBe(201);
        await expect
            .poll(async () => {
                const response = await page.request.get(
                    `/api/v1/admin/world-builder/maps/${map.id}`,
                );
                const document = (await response.json()) as {
                    editable_map: {
                        map: { map_assets: Array<{ id: string }> };
                    };
                };
                return document.editable_map.map.map_assets.length;
            })
            .toBeGreaterThan(0);
    };
    const mapAssets = async () => {
        const response = await page.request.get(
            `/api/v1/admin/world-builder/maps/${map.id}`,
        );
        expect(response.ok()).toBeTruthy();
        return (await response.json()) as {
            editable_map: {
                map: {
                    map_assets: Array<{ id: string; image_url: string | null }>;
                };
            };
        };
    };
    const attachVisual = async (assetId: string, positionX: number) => {
        await page
            .locator(`[data-wl-id="authoring.map-asset.select.${assetId}"]`)
            .click();
        await expect(
            page.getByRole('heading', { name: 'MapAsset', exact: true }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Select existing' }).click();
        await expect(
            page.getByRole('heading', { name: 'Select existing visual' }),
        ).toBeVisible();
        await page.getByRole('button', { name: mediaName }).click();
        await page
            .getByLabel('Horizontal position (X)')
            .fill(String(positionX));
        const saved = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                response
                    .url()
                    .includes(`/api/v1/admin/world-builder/assets/${assetId}`),
        );
        await page.getByRole('button', { name: 'Save MapAsset' }).click();
        expect((await saved).status()).toBe(204);
    };

    await addAsset();
    const first = (await mapAssets()).editable_map.map.map_assets[0];
    await attachVisual(first.id, 30);
    await addAsset();
    const second = (await mapAssets()).editable_map.map.map_assets.find(
        (asset) => asset.id !== first.id,
    );
    if (!second) throw new Error('the second MapAsset was not created');
    await attachVisual(second.id, 70);

    const saved = await mapAssets();
    expect(
        saved.editable_map.map.map_assets.find((asset) => asset.id === first.id)
            ?.image_url,
    ).toBe(media.asset.url);

    await page
        .locator(`[data-wl-id="authoring.map-asset.select.${first.id}"]`)
        .click();
    page.once('dialog', (dialog) => dialog.accept());
    const deleted = page.waitForResponse(
        (response) =>
            response.request().method() === 'DELETE' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/assets/${first.id}`),
    );
    await page.getByRole('button', { name: 'Delete MapAsset' }).click();
    expect((await deleted).status()).toBe(204);

    await expect
        .poll(async () => {
            const response = await page.request.get(
                '/api/v1/admin/media-assets?page=1&per_page=12',
            );
            const assets = (await response.json()) as {
                items: Array<{ id: string; reference_count: number }>;
            };
            return assets.items.find((asset) => asset.id === media.asset.id)
                ?.reference_count;
        })
        .toBe(1);

    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    await expect(page).toHaveURL(/\/settings\?panel=admin-world-builder$/);
    await expect
        .poll(async () => {
            const response = await page.request.get(
                '/api/v1/admin/media-assets?page=1&per_page=12',
            );
            const assets = (await response.json()) as {
                items: Array<{ id: string; reference_count: number }>;
            };
            return assets.items.find((asset) => asset.id === media.asset.id)
                ?.reference_count;
        })
        .toBe(0);
});
