import { expect, test } from './authenticated';

test('a local world author can open the source-derived Shared task form', async ({
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
    const graph = await page.request.get('/api/v1/admin/world-builder');
    expect(graph.ok()).toBeTruthy();
    const document = (await graph.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    const map = document.maps.find((candidate) => candidate.nodes.length > 0);
    expect(map).toBeDefined();
    if (!map) throw new Error('the local World Builder graph has no readable node');

    await page.goto(`/settings?panel=admin-world-builder&map=${map.id}&node=${map.nodes[0].id}`);
    await page.getByRole('button', { name: 'Shared task' }).click();
    await expect(page.getByRole('heading', { name: 'Add Shared task' })).toBeVisible();
    await expect(page.getByLabel('Task kind')).toBeVisible();
    await expect(page.getByLabel('Repeat policy')).toBeVisible();
    await expect(page.getByLabel('Prompt')).toBeVisible();
    await expect(page.getByText('Allow anonymous contributions to be shown')).toBeVisible();
    await page.getByRole('button', { name: 'Close activity form' }).click();
});
