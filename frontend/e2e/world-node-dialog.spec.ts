import { expect, test } from '@playwright/test';

test('a local author creates, edits, and deletes a source-shaped map tile', async ({
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

    const mapTitle = `Node dialog ${Date.now()}`;
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(mapTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: mapTitle })).toBeVisible();

    await page.getByRole('button', { name: 'Add map tile' }).click();
    await expect(page.getByRole('heading', { name: 'Add map tile' })).toBeVisible();
    await page.getByLabel('Title').fill('Disposable dialogue tile');
    await page.getByLabel('Slug').fill('disposable-dialogue-tile');
    await page.getByLabel('Description').fill('Created through the source-shaped tile dialog.');
    await page.getByLabel('Grid q').fill('4');
    await page.getByLabel('Grid r').fill('-2');
    await page.getByLabel('State').selectOption('locked');
    const created = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/v1\/admin\/world-builder\/maps\/[0-9a-f-]+\/nodes$/.test(response.url()));
    await page.getByRole('button', { name: 'Add map tile' }).last().click();
    expect((await created).status()).toBe(201);

    await expect(page.getByText('Disposable dialogue tile', { exact: true })).toBeVisible();
    const exportHref = await page.getByRole('link', { name: 'Export map', exact: true }).getAttribute('href');
    const mapId = exportHref?.match(/maps\/([^/]+)\/export$/)?.[1];
    if (!mapId) throw new Error('the disposable map did not expose its ID');
    const map = await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}`);
    expect(map.ok()).toBeTruthy();
    const mapDocument = (await map.json()) as {
        editable_map: { map: { nodes: Array<{ id: string; title: string; slug: string; description: string; position: { q: number; r: number }; state: string }> } };
    };
    const node = mapDocument.editable_map.map.nodes.find((candidate) => candidate.title === 'Disposable dialogue tile');
    if (!node) throw new Error('the disposable tile is missing');
    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const preservedVisualConfig = { label: 'Keep authored tile appearance', tooltip: 'Do not replace this configuration.' };
    expect((await page.request.patch(`/api/v1/admin/world-builder/nodes/${node.id}`, {
        data: { title: node.title, slug: node.slug, description: node.description, position_q: node.position.q, position_r: node.position.r, state: node.state, visual_config: preservedVisualConfig },
        headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': token },
    })).status()).toBe(204);
    await page.reload();
    await expect(page.getByRole('heading', { name: mapTitle })).toBeVisible();

    const edit = page.getByRole('button', { name: 'Edit tile' }).last();
    await edit.click();
    await expect(page.getByRole('heading', { name: 'Edit map tile' })).toBeVisible();
    await page.getByLabel('Title').fill('Updated dialogue tile');
    await page.getByLabel('State').selectOption('recommended');
    const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && /\/api\/v1\/admin\/world-builder\/nodes\/[0-9a-f-]+$/.test(response.url()));
    await page.getByRole('button', { name: 'Save map tile' }).click();
    expect((await saved).status()).toBe(204);
    await expect(page.getByText('Updated dialogue tile', { exact: true })).toBeVisible();
    const savedNode = await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}`);
    expect(savedNode.ok()).toBeTruthy();
    expect(JSON.stringify(await savedNode.json())).toContain('Keep authored tile appearance');

    await page.getByRole('button', { name: 'Edit tile' }).last().click();
    page.once('dialog', (dialog) => dialog.accept());
    const unlocksReset = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/v1\/admin\/world-builder\/nodes\/[0-9a-f-]+\/reset-unlocks$/.test(response.url()));
    await page.getByRole('button', { name: 'Lock for all users' }).click();
    expect((await unlocksReset).status()).toBe(200);
    page.once('dialog', (dialog) => dialog.accept());
    const deleted = page.waitForResponse((response) => response.request().method() === 'DELETE' && /\/api\/v1\/admin\/world-builder\/nodes\/[0-9a-f-]+$/.test(response.url()));
    await page.getByRole('button', { name: 'Delete map tile' }).click();
    expect((await deleted).status()).toBe(204);
    await expect(page.getByText('Updated dialogue tile', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
