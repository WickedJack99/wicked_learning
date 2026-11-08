import { expect, test } from '@playwright/test';

test('a local author configures Laravel-shaped map visuals with reusable media', async ({
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

    await page.goto('/settings?panel=admin-assets');
    const upload = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/v1/admin/media-assets'),
    );
    await page.locator('input[type="file"]').first().setInputFiles({
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#0f766e"/></svg>'),
        mimeType: 'image/svg+xml',
        name: 'map-visual.svg',
    });
    const media = (await (await upload).json()) as {
        asset: { id: string; url: string };
    };
    const mediaName = `Map visual ${Date.now()}`;
    await page.getByLabel('Visual name').fill(mediaName);
    const metadata = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/v1/admin/media-assets/${media.asset.id}`),
    );
    await page.getByRole('button', { name: 'Save details' }).click();
    expect((await metadata).status()).toBe(200);

    await page.goto('/settings?panel=admin-world-builder');
    const title = `Disposable map visuals ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const graph = (await (await page.request.get('/api/v1/admin/world-builder')).json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const map = graph.maps.find((candidate) => candidate.title === title);
    if (!map) throw new Error('the disposable map was not created');

    await page.getByRole('button', { name: 'Configure map visuals' }).click();
    await expect(page.getByRole('heading', { name: 'Configure map visuals' })).toBeVisible();
    await page.getByRole('button', { name: 'Background image' }).click();
    await page.getByRole('button', { name: 'Upload or select visual' }).click();
    await expect(page.getByRole('heading', { name: 'Select existing visual' })).toBeVisible();
    await page.getByRole('button', { name: mediaName }).click();
    await page.getByRole('button', { name: 'Assets' }).click();
    await page.getByRole('button', { name: 'Add layer' }).click();
    await page.getByRole('button', { name: 'Upload or select visual' }).click();
    await page.getByRole('button', { name: mediaName }).click();
    await page.getByLabel('X %').fill('35');
    const saved = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/v1/admin/world-builder/maps/${map.id}/visuals`),
    );
    await page.getByRole('button', { name: 'Save map visuals' }).click();
    expect((await saved).status()).toBe(200);

    const document = await page.request.get(`/api/v1/admin/world-builder/maps/${map.id}`);
    expect(document.ok()).toBeTruthy();
    expect((await document.json()) as {
        editable_map: { map: { background_config: { dark: { imageUrl: string; assets: Array<{ x: number; imageUrl: string }> } } } };
    }).toMatchObject({
        editable_map: {
            map: {
                background_config: {
                    dark: {
                        imageUrl: media.asset.url,
                        assets: [{ imageUrl: media.asset.url, x: 35 }],
                    },
                },
            },
        },
    });

    await expect.poll(async () => {
        const assets = await page.request.get('/api/v1/admin/media-assets?page=1&per_page=12');
        const data = (await assets.json()) as { items: Array<{ id: string; reference_count: number }> };
        return data.items.find((asset) => asset.id === media.asset.id)?.reference_count;
    }).toBe(2);

    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    await expect.poll(async () => {
        const assets = await page.request.get('/api/v1/admin/media-assets?page=1&per_page=12');
        const data = (await assets.json()) as { items: Array<{ id: string; reference_count: number }> };
        return data.items.find((asset) => asset.id === media.asset.id)?.reference_count;
    }).toBe(0);
});
