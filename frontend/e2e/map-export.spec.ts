import { readFile, writeFile } from 'node:fs/promises';

import { expect, test } from './authenticated';

type WorldMapManifest = {
    map: {
        slug: string;
        title: string;
        companionConfig?: Record<string, unknown>;
    };
    nodes: Array<{
        slug: string;
        companionConfig?: Record<string, unknown>;
        activities: Array<Record<string, unknown>>;
    }>;
    portalTargets: Array<Record<string, string>>;
    references: { mediaUrls: string[] };
};

test('a local author exports, validates, and imports a source-shaped map manifest', async ({ page }) => {
    test.setTimeout(60_000);
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

    if (!map) {
        throw new Error('the disposable export map was not created');
    }

    const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/api/v1/admin/world-builder/maps/${map.id}/assets`));
    await page.getByRole('button', { name: 'Add MapAsset' }).click();
    expect((await created).status()).toBe(201);

    const response = page.waitForResponse((candidate) => candidate.url().includes(`/api/v1/admin/world-builder/maps/${map.id}/export`));
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export map', exact: true }).click();
    const manifest = await download;
    expect((await response).headers()['content-type']).toContain('application/json');
    expect(manifest.suggestedFilename()).toContain('wicked-learning-map.json');
    const filePath = await manifest.path();

    if (!filePath) {
        throw new Error('the export download has no file');
    }

    const payload = JSON.parse(await readFile(filePath, 'utf8')) as {
        format: string;
        formatVersion: number;
        map: { title: string; companionConfig?: Record<string, unknown> };
        mapAssets: unknown[];
        nodes: Array<{
            companionConfig?: Record<string, unknown>;
            activities: Array<Record<string, unknown>>;
        }>;
        references: { mediaUrls: string[] };
    };
    expect(payload).toMatchObject({ format: 'wicked-learning-map', formatVersion: 1, map: { title } });
    expect(payload.mapAssets).toHaveLength(1);
    expect(payload.nodes).toHaveLength(1);
    expect(Array.isArray(payload.references.mediaUrls)).toBeTruthy();

    const exportedNode = payload.nodes[0];

    if (!exportedNode) {
        throw new Error('the disposable export map has no node');
    }

    payload.map.companionConfig = { display_name: 'Map transfer companion' };
    exportedNode.companionConfig = { avatar_color: '#123456' };
    exportedNode.activities = [
        {
            slug: 'companion-config-activity',
            title: 'Companion config activity',
            type: 'markdown',
            companionConfig: { welcome_message: 'Transferred without loss.' },
            transitions: [],
            dialogueNodes: [],
            dialogueTransitions: [],
        },
    ];
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);

    const worldDownload = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export world', exact: true }).click();
    const worldManifest = await worldDownload;
    expect(worldManifest.suggestedFilename()).toContain(
        'wicked-learning-world.json',
    );
    const worldFilePath = await worldManifest.path();

    if (!worldFilePath) {
        throw new Error('the World export download has no file');
    }

    const worldPayload = JSON.parse(await readFile(worldFilePath, 'utf8')) as {
        format: string;
        formatVersion: number;
        maps: Array<{ format: string; map: { title: string } }>;
        references: { mediaUrls: string[] };
    };
    expect(worldPayload).toMatchObject({
        format: 'wicked-learning-world',
        formatVersion: 1,
    });
    expect(worldPayload.maps).toContainEqual(
        expect.objectContaining({
            format: 'wicked-learning-map',
            map: expect.objectContaining({ title }),
        }),
    );
    expect(Array.isArray(worldPayload.references.mediaUrls)).toBeTruthy();

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

    const importedWorldDownload = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export world', exact: true }).click();
    const importedWorld = await importedWorldDownload;
    const importedWorldFilePath = await importedWorld.path();

    if (!importedWorldFilePath) {
        throw new Error('the imported World export download has no file');
    }

    const importedWorldPayload = JSON.parse(
        await readFile(importedWorldFilePath, 'utf8'),
    ) as {
        maps: WorldMapManifest[];
        references: { mediaUrls: string[] };
    };
    const importedMapPayload = importedWorldPayload.maps.filter(
        (candidate) => candidate.map.title === importedTitle,
    );

    if (importedMapPayload.length !== 1) {
        throw new Error('the imported map was not uniquely present in the World export');
    }

    expect(importedMapPayload[0]).toMatchObject({
        map: {
            companionConfig: { display_name: 'Map transfer companion' },
        },
        nodes: [
            expect.objectContaining({
                companionConfig: { avatar_color: '#123456' },
                activities: [
                    expect.objectContaining({
                        companionConfig: {
                            welcome_message: 'Transferred without loss.',
                        },
                    }),
                ],
            }),
        ],
    });

    const portalNonce = Date.now();
    const sourceTitle = `World source ${portalNonce}`;
    const targetTitle = `World target ${portalNonce}`;
    const sourceMap = structuredClone(importedMapPayload[0]);
    const targetMap = structuredClone(importedMapPayload[0]);
    const sourceNode = sourceMap.nodes[0];
    const targetNode = targetMap.nodes[0];

    if (!sourceNode || !targetNode) {
        throw new Error('the disposable World map has no importable node');
    }

    sourceMap.map = { slug: `world-source-${portalNonce}`, title: sourceTitle };
    targetMap.map = { slug: `world-target-${portalNonce}`, title: targetTitle };
    sourceNode.activities = [
        {
            slug: 'portal-source',
            title: 'Portal source',
            type: 'markdown',
            transitions: [],
            dialogueNodes: [],
            dialogueTransitions: [],
        },
    ];
    targetNode.activities = [
        {
            slug: 'portal-target',
            title: 'Portal target',
            type: 'markdown',
            transitions: [],
            dialogueNodes: [],
            dialogueTransitions: [],
        },
    ];
    sourceMap.portalTargets = [
        {
            sourceNodeSlug: sourceNode.slug,
            sourceActivitySlug: 'portal-source',
            targetMapSlug: targetMap.map.slug,
            targetNodeSlug: targetNode.slug,
            targetActivitySlug: 'portal-target',
        },
    ];
    targetMap.portalTargets = [];
    importedWorldPayload.maps = [sourceMap, targetMap];
    importedWorldPayload.references.mediaUrls = importedWorldPayload.maps.flatMap(
        (candidate) => candidate.references.mediaUrls,
    );
    await writeFile(
        importedWorldFilePath,
        `${JSON.stringify(importedWorldPayload, null, 2)}\n`,
    );

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

    await page.getByRole('button', { name: 'Import world', exact: true }).click();
    const worldImportDialog = page.locator(
        '[data-wl-id="authoring.world-builder.world-import.dialog"]',
    );
    await worldImportDialog
        .getByLabel('JSON world export')
        .setInputFiles(importedWorldFilePath);
    const worldPreflight = page.waitForResponse((candidate) =>
        candidate.url().includes('/api/v1/admin/world-builder/world-exports/preflight'),
    );
    await worldImportDialog.getByRole('button', { name: 'Check export' }).click();
    expect((await worldPreflight).status()).toBe(200);
    await expect(worldImportDialog.getByRole('status')).toContainText(
        'The world bundle is structurally valid and ready to import.',
    );
    const worldImported = page.waitForResponse((candidate) =>
        candidate.url().includes('/api/v1/admin/world-builder/world-exports/import'),
    );
    await worldImportDialog
        .getByRole('button', { name: 'Import world', exact: true })
        .click();
    expect((await worldImported).status()).toBe(201);
    await expect(page.getByRole('heading', { name: sourceTitle })).toBeVisible();

    const importedGraphResponse = await page.request.get(
        '/api/v1/admin/world-builder',
    );
    const importedGraph = (await importedGraphResponse.json()) as {
        maps: Array<{ id: string; title: string }>;
        portal_links: Array<{ source_map_id: string; target_map_id: string }>;
    };
    const sourceMapSummary = importedGraph.maps.find(
        (candidate) => candidate.title === sourceTitle,
    );
    const targetMapSummary = importedGraph.maps.find(
        (candidate) => candidate.title === targetTitle,
    );

    if (!sourceMapSummary || !targetMapSummary) {
        throw new Error('the World import did not create both portal maps');
    }

    expect(importedGraph.portal_links).toContainEqual(
        expect.objectContaining({
            source_map_id: sourceMapSummary.id,
            target_map_id: targetMapSummary.id,
        }),
    );

    const deletedWorldImport = page.waitForResponse(
        (candidate) =>
            candidate.request().method() === 'DELETE' &&
            /\/api\/v1\/admin\/world-builder\/maps\/[0-9a-f-]+$/.test(
                candidate.url(),
            ),
    );
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    expect((await deletedWorldImport).status()).toBe(204);

    await page.goto(
        `/settings?panel=admin-world-builder&map=${targetMapSummary.id}`,
    );
    await expect(page.getByRole('heading', { name: targetTitle })).toBeVisible();
    const deletedPortalTarget = page.waitForResponse(
        (candidate) =>
            candidate.request().method() === 'DELETE' &&
            /\/api\/v1\/admin\/world-builder\/maps\/[0-9a-f-]+$/.test(
                candidate.url(),
            ),
    );
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    expect((await deletedPortalTarget).status()).toBe(204);
});
