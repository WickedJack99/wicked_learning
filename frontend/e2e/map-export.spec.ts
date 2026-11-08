import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('a local author exports, validates, and imports a source-shaped map manifest', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const title = `Map export ${Date.now()}`;
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    const graph = (await graphResponse.json()) as { maps: Array<{ id: string; title: string }> };
    const map = graph.maps.find((candidate) => candidate.title === title);
    if (!map) throw new Error('the disposable export map was not created');

    const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/api/v1/admin/world-builder/maps/${map.id}/assets`));
    await page.getByRole('button', { name: 'Add MapAsset' }).click();
    expect((await created).status()).toBe(201);

    const response = page.waitForResponse((candidate) => candidate.url().includes(`/api/v1/admin/world-builder/maps/${map.id}/export`));
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export map' }).click();
    const manifest = await download;
    expect((await response).headers()['content-type']).toContain('application/json');
    expect(manifest.suggestedFilename()).toContain('wicked-learning-map.json');
    const filePath = await manifest.path();
    if (!filePath) throw new Error('the export download has no file');
    const payload = JSON.parse(await readFile(filePath, 'utf8')) as { format: string; formatVersion: number; map: { title: string }; mapAssets: unknown[]; nodes: unknown[]; references: { mediaUrls: string[] } };
    expect(payload).toMatchObject({ format: 'wicked-learning-map', formatVersion: 1, map: { title } });
    expect(payload.mapAssets).toHaveLength(1);
    expect(payload.nodes).toHaveLength(1);
    expect(Array.isArray(payload.references.mediaUrls)).toBeTruthy();

    await page.getByRole('button', { name: 'Validate map export' }).click();
    await page.getByLabel('JSON export file').setInputFiles(filePath);
    const preflight = page.waitForResponse((candidate) => candidate.url().includes('/api/v1/admin/world-builder/map-exports/preflight'));
    await page.getByRole('button', { name: 'Check manifest' }).click();
    const preflightResponse = await preflight;
    if (preflightResponse.status() !== 200) {
        throw new Error(await preflightResponse.text());
    }
    await expect(page.getByRole('status')).toContainText(
        'The map export is structurally ready for transfer.',
    );
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    const deletedSource = page.waitForResponse(
        (candidate) =>
            candidate.request().method() === 'DELETE' &&
            /\/api\/v1\/admin\/world-builder\/maps\/[0-9a-f-]+$/.test(
                candidate.url(),
            ),
    );
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    expect((await deletedSource).status()).toBe(204);

    const importedTitle = `Map import ${Date.now()}`;
    await page.getByRole('button', { name: 'Import map', exact: true }).click();
    const importDialog = page.locator(
        '[data-wl-id="authoring.world-builder.map-import.dialog"]',
    );
    await importDialog.getByLabel('JSON export file').setInputFiles(filePath);
    const importPreflight = page.waitForResponse((candidate) =>
        candidate.url().includes('/api/v1/admin/world-builder/map-exports/preflight'),
    );
    await importDialog.getByRole('button', { name: 'Check export' }).click();
    expect((await importPreflight).status()).toBe(200);
    await expect(importDialog.getByRole('status')).toContainText(
        'The map export is structurally ready for transfer.',
    );
    await importDialog.getByLabel('Map title').fill(importedTitle);
    const imported = page.waitForResponse((candidate) =>
        candidate.url().includes('/api/v1/admin/world-builder/map-exports/import'),
    );
    await importDialog.getByRole('button', { name: 'Import map', exact: true }).click();
    expect((await imported).status()).toBe(201);
    await expect(page.getByRole('heading', { name: importedTitle })).toBeVisible();

    const deletedImport = page.waitForResponse(
        (candidate) =>
            candidate.request().method() === 'DELETE' &&
            /\/api\/v1\/admin\/world-builder\/maps\/[0-9a-f-]+$/.test(
                candidate.url(),
            ),
    );
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    expect((await deletedImport).status()).toBe(204);
});
