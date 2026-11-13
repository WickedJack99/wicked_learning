import { expect, test } from '@playwright/test';

type CatalogResponse = {
    item?: { id: string; title: string; slug: string };
    items?: Array<{ id: string; title: string }>;
    tool?: { id: string; title: string; slug: string; image_width_percent: number };
    tools?: Array<{ id: string; title: string }>;
};

test('an asset administrator creates, updates and reads reusable catalog entries', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    const suffix = Date.now();
    const itemTitle = `Browser catalog item ${suffix}`;
    const toolTitle = `Browser catalog tool ${suffix}`;

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };

    async function request(
        path: string,
        method: 'GET' | 'PATCH' | 'POST',
        body?: Record<string, unknown>,
    ): Promise<{ status: number; body: CatalogResponse }> {
        return page.evaluate(async ({ body, method, path, token }) => {
            const response = await fetch(path, {
                body: body ? JSON.stringify(body) : undefined,
                credentials: 'same-origin',
                headers: body
                    ? { 'Content-Type': 'application/json', 'X-CSRF-Token': token }
                    : undefined,
                method,
            });
            return {
                body: await response.json() as CatalogResponse,
                status: response.status,
            };
        }, { body, method, path, token });
    }

    const createdItem = await request('/api/v1/admin/assets/items', 'POST', {
        description: 'A disposable catalog item for local browser verification.',
        image_dark: null,
        image_light: null,
        slug: null,
        title: itemTitle,
    });
    expect(createdItem.status).toBe(201);
    expect(createdItem.body.item).toMatchObject({ title: itemTitle, slug: `browser-catalog-item-${suffix}` });

    const createdTool = await request('/api/v1/admin/assets/tools', 'POST', {
        animation_dark: null,
        animation_duration_seconds: 0.5,
        animation_light: null,
        animation_width_percent: 28,
        description: 'A disposable catalog tool for local browser verification.',
        image_dark: null,
        image_light: null,
        image_width_percent: 24,
        slug: null,
        title: toolTitle,
    });
    expect(createdTool.status).toBe(201);
    expect(createdTool.body.tool).toMatchObject({
        image_width_percent: 24,
        slug: `browser-catalog-tool-${suffix}`,
        title: toolTitle,
    });

    const savedItem = await request(`/api/v1/admin/assets/items/${createdItem.body.item!.id}`, 'PATCH', {
        description: 'Saved after creation through the browser contract.',
        image_dark: null,
        image_light: null,
        slug: null,
        title: itemTitle,
    });
    expect(savedItem.status).toBe(200);

    const savedTool = await request(`/api/v1/admin/assets/tools/${createdTool.body.tool!.id}`, 'PATCH', {
        animation_dark: null,
        animation_duration_seconds: null,
        animation_light: null,
        animation_width_percent: null,
        description: 'Saved after creation through the browser contract.',
        image_dark: null,
        image_light: null,
        image_width_percent: 16,
        slug: null,
        title: toolTitle,
    });
    expect(savedTool.status).toBe(200);
    expect(savedTool.body.tool).toMatchObject({ image_width_percent: 16, title: toolTitle });

    const items = await request('/api/v1/admin/assets/items', 'GET');
    expect(items.status).toBe(200);
    expect(items.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ title: itemTitle })]));

    const tools = await request('/api/v1/admin/assets/tools', 'GET');
    expect(tools.status).toBe(200);
    expect(tools.body.tools).toEqual(expect.arrayContaining([expect.objectContaining({ title: toolTitle })]));
});
