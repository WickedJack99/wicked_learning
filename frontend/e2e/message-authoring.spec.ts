import { expect, test } from '@playwright/test';

test('a local world author can save source message activity fields', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    const graph = await page.request.get('/api/v1/admin/world-builder');
    const body = (await graph.json()) as { maps: Array<{ id: string; nodes: Array<{ id: string }> }> };
    const map = body.maps.find((candidate) => candidate.nodes.length > 0);
    expect(map).toBeDefined();
    if (!map) throw new Error('the local World Builder graph has no readable node');
    await page.goto(`/settings?panel=admin-world-builder&map=${map.id}&node=${map.nodes[0].id}`);
    await page.getByRole('button', { name: 'Message prompt' }).click();
    await expect(page.getByRole('heading', { name: 'Add Message prompt' })).toBeVisible();
    await expect(page.getByLabel('Message topic')).toBeVisible();
    await expect(page.getByLabel('Who should receive this?')).toBeVisible();
    const accentDark = page.getByRole('textbox', { name: 'Accent - dark', exact: true });
    await expect(accentDark).toHaveValue('#5eead4');
    const title = `Message authoring ${Date.now()}`;
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('New topic name').fill(`${title} topic`);
    await accentDark.fill('#123abc');
    const [created] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/message-activities')),
        page.getByRole('button', { name: 'Create activity' }).click(),
    ]);
    expect(created.status()).toBe(201);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.getByText(title, { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit Message prompt' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Accent - dark', exact: true }).fill('#654321');
    const [updated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes('/message')),
        page.getByRole('button', { name: 'Save activity' }).click(),
    ]);
    expect(updated.ok()).toBeTruthy();
    const node = await page.request.get(`/api/v1/admin/world-builder/nodes/${map.nodes[0].id}`);
    expect(node.ok()).toBeTruthy();
    const document = (await node.json()) as { activity_graph: { activities: Array<{ config: { messageUi?: { accentColorDark?: string } }; id: string; title: string }> } };
    expect(document.activity_graph.activities.find((activity) => activity.title === title)?.config.messageUi?.accentColorDark).toBe('#654321');
    await page.getByRole('button', { name: `Delete ${title}` }).click();
    await page.getByRole('dialog', { name: 'Delete activity?' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Message wall' }).click();
    await expect(page.getByRole('heading', { name: 'Add Message wall' })).toBeVisible();
    await expect(page.getByText('Invite optional peer responses')).toBeVisible();
});
