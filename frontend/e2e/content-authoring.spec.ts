import { expect, test } from './authenticated';

test('a scoped author can open the source-derived ContentPlan dialog from an editable map', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    const suffix = Date.now();
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };

    const templateResponse = await page.request.post('/api/v1/admin/ai/templates', {
        data: {
            concurrency_limit: 1,
            enabled: true,
            guarded_context: true,
            name: `Content author ${suffix}`,
            purpose: 'content_authoring',
        },
        headers: {
            Origin: 'http://localhost:8081',
            'X-CSRF-Token': token,
        },
    });
    expect(templateResponse.status()).toBe(201);
    const template = (await templateResponse.json()) as {
        agent_template: { id: string; name: string };
    };

    const mapTitle = `ContentPlan map ${suffix}`;
    const mapResponse = await page.request.post('/api/v1/admin/world-builder/maps', {
        data: { description: null, slug: null, title: mapTitle },
        headers: {
            Origin: 'http://localhost:8081',
            'X-CSRF-Token': token,
        },
    });
    expect(mapResponse.status()).toBe(201);
    const { map_id: mapId } = (await mapResponse.json()) as { map_id: string };

    await page.goto(`/settings?panel=admin-world-builder&map=${mapId}`);
    await expect(page.getByRole('heading', { name: mapTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Create with AI' }).click();

    const dialog = page.locator('[data-wl-id="authoring.content-plan"]');
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole('heading', { name: 'Draft learning content with AI' }),
    ).toBeVisible();
    await expect(dialog.getByText(mapTitle, { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Agent template')).toHaveValue(
        template.agent_template.id,
    );
    await expect(dialog.getByLabel('Learning goal and context')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    const deleteTemplateResponse = await page.request.delete(
        `/api/v1/admin/ai/templates/${template.agent_template.id}`,
        {
            headers: {
                Origin: 'http://localhost:8081',
                'X-CSRF-Token': token,
            },
        },
    );
    expect(deleteTemplateResponse.status()).toBe(204);
    const deleteMapResponse = await page.request.delete(
        `/api/v1/admin/world-builder/maps/${mapId}`,
        {
            headers: {
                Origin: 'http://localhost:8081',
                'X-CSRF-Token': token,
            },
        },
    );
    expect(deleteMapResponse.status()).toBe(204);
});
