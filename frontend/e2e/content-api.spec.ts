import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

type CreatedResponse = { data: { id: string } };

async function createdResponse(console: Locator): Promise<CreatedResponse> {
    const response = console.locator('pre');
    const body = await response.textContent();

    return JSON.parse(body ?? '{}') as CreatedResponse;
}

test('a content API author can inspect the live contract and send a documented read request', async ({
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

    await page.goto('/settings?panel=admin-api&api=console');
    const console = page.locator('[data-wl-id="settings.content-api.console"]');
    await expect(console).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content API' })).toBeVisible();
    await expect(console.getByLabel('Operation')).toHaveValue('maps.index');
    await expect(console.getByLabel('Request path')).toHaveValue('/api/content/v1/maps');

    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();

    await console.getByLabel('Request path').fill('/api/content/v1/contract');
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(
        console.getByText(
            'The request path must match the selected documented operation.',
        ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'API Documentation' }).click();
    const documentation = page.locator('[data-wl-id="settings.content-api.documentation"]');
    await expect(documentation).toBeVisible();
    await expect(documentation.getByText('AI ContentPlan v1.5')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const docsBox = await documentation.boundingBox();
    expect(docsBox).not.toBeNull();
    expect(docsBox!.x).toBeGreaterThanOrEqual(0);
    expect(docsBox!.x + docsBox!.width).toBeLessThanOrEqual(390);
});

test('a content API author creates a MapAsset Activity through the documented console flow', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API browser map ${suffix}`;
    const assetTitle = `Content API browser MapAsset ${suffix}`;
    const activityTitle = `Content API browser practice ${suffix}`;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-api&api=console');
    const console = page.locator('[data-wl-id="settings.content-api.console"]');
    await expect(console).toBeVisible();

    await console.getByLabel('Operation').selectOption('maps.store');
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: mapTitle,
        description: 'A disposable browser verification map.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);
    expect(map.data.id).toMatch(/^[0-9a-f-]{36}$/i);

    await console.getByLabel('Operation').selectOption('map-assets.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/maps/${map.data.id}/map-assets`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: assetTitle,
        description: 'A disposable browser verification MapAsset.',
        image_url: null,
        text: assetTitle,
        position_x: 50,
        position_y: 50,
        position_z: 0,
        width: 14,
        opacity: 1,
        locked: false,
        interaction_mode: 'focusable',
        interaction_config: {},
        visual_config: {},
        sound_config: {},
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const mapAsset = await createdResponse(console);
    expect(mapAsset.data.id).toMatch(/^[0-9a-f-]{36}$/i);

    await console.getByLabel('Operation').selectOption('activities.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'open_practice',
        title: activityTitle,
        introduction: 'Use the place to choose a next investigation.',
        open_practice_next_step: 'Inspect one nearby detail and describe why it matters.',
        graph_position_x: 120,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const activity = await createdResponse(console);
    expect(activity.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(activity.data).toMatchObject({ type: 'open_practice', title: activityTitle });

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(activityTitle);
});
