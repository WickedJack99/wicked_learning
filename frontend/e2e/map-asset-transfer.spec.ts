import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('a local author exports, validates, and imports a standalone MapAsset', async ({
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

    const title = `Map asset transfer ${Date.now()}`;
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const graph = (await (
        await page.request.get('/api/v1/admin/world-builder')
    ).json()) as { maps: Array<{ id: string; title: string }> };
    const map = graph.maps.find((candidate) => candidate.title === title);

    if (!map) {
        throw new Error('the disposable MapAsset transfer map was not created');
    }

    const created = page.waitForResponse((response) =>
        response.url().includes(
            `/api/v1/admin/world-builder/maps/${map.id}/assets`,
        ),
    );
    await page.getByRole('button', { name: 'Add MapAsset' }).click();
    expect((await created).status()).toBe(201);

    await page.getByRole('button', { name: 'Edit MapAsset' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export MapAsset' }).click();
    const manifest = await download;
    expect(manifest.suggestedFilename()).toContain('wicked-learning-asset.json');
    const filePath = await manifest.path();

    if (!filePath) {
        throw new Error('the MapAsset export download has no file');
    }

    const payload = JSON.parse(await readFile(filePath, 'utf8')) as {
        format: string;
        formatVersion: number;
        node: { slug: string; activities: unknown[] } | null;
        mapAsset: { nodeSlug: string | null };
        references: { mediaUrls: string[] };
    };
    expect(payload).toMatchObject({
        format: 'wicked-learning-map-asset',
        formatVersion: 1,
    });
    expect(payload.node?.slug).toBe(payload.mapAsset.nodeSlug);
    expect(Array.isArray(payload.references.mediaUrls)).toBeTruthy();

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    const dialog = page.locator('[data-wl-id="authoring.map-asset.import.dialog"]');
    await dialog.getByLabel('JSON MapAsset export').setInputFiles(filePath);
    const preflight = page.waitForResponse((response) =>
        response.url().includes(`/maps/${map.id}/asset-exports/preflight`),
    );
    await dialog.getByRole('button', { name: 'Check export' }).click();
    expect((await preflight).status()).toBe(200);
    await expect(dialog.getByRole('status')).toContainText(
        'The map export is structurally ready for transfer.',
    );
    const imported = page.waitForResponse((response) =>
        response.url().includes(`/maps/${map.id}/asset-exports/import`),
    );
    await dialog.getByRole('button', { name: 'Import MapAsset' }).click();
    expect((await imported).status()).toBe(201);
    await expect(page.getByRole('button', { name: 'Edit MapAsset' })).toHaveCount(2);

    const deleted = page.waitForResponse(
        (response) =>
            response.request().method() === 'DELETE' &&
            /\/api\/v1\/admin\/world-builder\/maps\/[0-9a-f-]+$/.test(
                response.url(),
            ),
    );
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    expect((await deleted).status()).toBe(204);
});
