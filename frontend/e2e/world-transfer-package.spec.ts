import { expect, test } from './authenticated';

test('a local author transfers a map package with managed media', async ({ page }) => {
    test.setTimeout(90_000);
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };
    const headers = {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': token,
    };

    const uploaded = await page.request.post('/api/v1/admin/media-assets', {
        headers,
        multipart: {
            file: {
                buffer: Buffer.from(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="#0f766e" d="M0 0h24v24H0z"/></svg>',
                ),
                mimeType: 'image/svg+xml',
                name: 'portable-map.svg',
            },
        },
    });
    expect(uploaded.status()).toBe(201);
    const media = (await uploaded.json()) as { asset: { id: string; url: string } };

    await page.goto('/settings?panel=admin-world-builder');
    const sourceTitle = `Portable source ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(sourceTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    const sourceHref = await page
        .getByRole('link', { name: 'Export map', exact: true })
        .getAttribute('href');
    const sourceMapId = sourceHref?.match(/maps\/([^/]+)\/export$/)?.[1];
    if (!sourceMapId) throw new Error('the disposable source map did not expose its ID');

    const createdNode = await page.request.post(
        `/api/v1/admin/world-builder/maps/${sourceMapId}/nodes`,
        {
            data: {
                title: 'Portable media node',
                description: 'Carries the transferred image.',
                position_q: 0,
                position_r: 0,
                state: 'available',
                visual_config: {
                    dark: { imageUrl: media.asset.url },
                    light: { imageUrl: media.asset.url },
                },
            },
            headers,
        },
    );
    expect(createdNode.status()).toBe(201);

    const packageResponse = await page.request.get(
        `/api/v1/admin/world-builder/maps/${sourceMapId}/export-package`,
    );
    expect(packageResponse.ok()).toBeTruthy();
    expect(packageResponse.headers()['content-type']).toContain('application/zip');
    const packageBytes = await packageResponse.body();
    expect(packageBytes.subarray(0, 2).toString()).toBe('PK');

    const packagePart = {
        buffer: packageBytes,
        mimeType: 'application/zip',
        name: 'portable-map.zip',
    };
    const preflight = await page.request.post(
        '/api/v1/admin/world-builder/map-exports/preflight',
        { headers, multipart: { manifest: packagePart } },
    );
    expect(preflight.ok()).toBeTruthy();
    expect((await preflight.json()) as { valid: boolean }).toMatchObject({ valid: true });

    const importedTitle = `${sourceTitle} imported`;
    const imported = await page.request.post(
        '/api/v1/admin/world-builder/map-exports/import',
        { headers, multipart: { manifest: packagePart, title: importedTitle } },
    );
    expect(imported.status()).toBe(201);
    const { map_id: importedMapId } = (await imported.json()) as { map_id: string };
    const importedDocument = await page.request.get(
        `/api/v1/admin/world-builder/maps/${importedMapId}`,
    );
    expect(importedDocument.ok()).toBeTruthy();
    const importedMap = (await importedDocument.json()) as {
        editable_map: {
            map: { nodes: Array<{ visual_config: { dark?: { imageUrl?: string } } }> };
        };
    };
    const copiedUrl = importedMap.editable_map.map.nodes[0]?.visual_config.dark?.imageUrl;
    expect(copiedUrl).toMatch(/\/api\/v1\/admin\/media-assets\/[0-9a-f-]+\/content$/);
    expect(copiedUrl).not.toBe(media.asset.url);

    expect((await page.request.delete(`/api/v1/admin/world-builder/maps/${importedMapId}`, { headers })).status()).toBe(204);
    expect((await page.request.delete(`/api/v1/admin/world-builder/maps/${sourceMapId}`, { headers })).status()).toBe(204);
    expect((await page.request.delete(`/api/v1/admin/media-assets/${media.asset.id}`, { headers })).status()).toBe(204);
});
