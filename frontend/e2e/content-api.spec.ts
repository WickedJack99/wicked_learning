import { expect, test } from './authenticated';
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

test('a content API author can replace and delete a scoped MapAsset through the documented console', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API surface map ${suffix}`;
    const assetTitle = `Content API surface MapAsset ${suffix}`;
    const updatedText = `${assetTitle} updated`;
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
        description: 'A disposable map for scoped MapAsset mutation evidence.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('map-assets.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/maps/${map.data.id}/map-assets`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: assetTitle,
        description: 'A disposable MapAsset for replacement and deletion evidence.',
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

    await console.getByLabel('Operation').selectOption('map-assets.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        image_url: null,
        text: updatedText,
        position_x: 56,
        position_y: 42,
        position_z: 1,
        width: 18,
        opacity: 0.8,
        locked: true,
        interaction_mode: 'focusable',
        interaction_config: {},
        visual_config: {},
        sound_config: {},
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();

    await console.getByLabel('Operation').selectOption('map-assets.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/maps/${map.data.id}/map-assets`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedText);
    await expect(console.locator('pre')).toContainText('"locked": true');

    await console.getByLabel('Operation').selectOption('map-assets.destroy');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();

    await console.getByLabel('Operation').selectOption('map-assets.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/maps/${map.data.id}/map-assets`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).not.toContainText(updatedText);
});

test('a content API author can replace and delete a scoped map through the documented console', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API lifecycle map ${suffix}`;
    const updatedTitle = `${mapTitle} updated`;
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
        description: 'A disposable map for Content API lifecycle evidence.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('maps.show');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const initial = JSON.parse((await console.locator('pre').textContent()) ?? '{}') as {
        data: { updatedAt: string };
    };
    expect(initial.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await console.getByLabel('Operation').selectOption('maps.update');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedTitle,
        description: null,
        topic_id: null,
        map_assets_locked: true,
        updated_at: initial.data.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedTitle);
    await expect(console.locator('pre')).toContainText('"mapAssetsLocked": true');

    await console.getByLabel('Operation').selectOption('maps.destroy');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();

    await console.getByLabel('Operation').selectOption('maps.index');
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).not.toContainText(updatedTitle);
});

test('a content API author can replace a scoped Reflection Activity through the documented console', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API reflection map ${suffix}`;
    const assetTitle = `Content API reflection MapAsset ${suffix}`;
    const reflectionTitle = `Content API reflection ${suffix}`;
    const updatedTitle = `${reflectionTitle} updated`;
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
        description: 'A disposable map for Reflection replacement evidence.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('map-assets.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/maps/${map.data.id}/map-assets`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: assetTitle,
        description: 'A disposable MapAsset for Reflection replacement evidence.',
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

    await console.getByLabel('Operation').selectOption('activities.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'reflection',
        title: reflectionTitle,
        introduction: 'Notice the energy transfer.',
        reflection_prompt: 'What is clearer now?',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const reflection = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const activities = JSON.parse((await console.locator('pre').textContent()) ?? '{}') as {
        data: Array<{ id: string; updatedAt: string }>;
    };
    const initial = activities.data.find((activity) => activity.id === reflection.data.id);
    if (!initial) {
        throw new Error('the created Reflection Activity was not returned by its scoped list');
    }
    expect(initial.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await console.getByLabel('Operation').selectOption('activities.reflection.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${reflection.data.id}/reflection`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedTitle,
        slug: null,
        introduction: 'Trace the current through the alternator.',
        prompt: 'What changed in your explanation?',
        note: null,
        topic: 'Vehicle electrics',
        subtopic: null,
        updated_at: initial.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(reflection.data.id);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedTitle);
    await expect(console.locator('pre')).toContainText('What changed in your explanation?');

    await console.getByLabel('Operation').selectOption('maps.destroy');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();
});

test('a content API author can replace a scoped Review Activity through the documented console', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API review map ${suffix}`;
    const assetTitle = `Content API review MapAsset ${suffix}`;
    const reviewTitle = `Content API review ${suffix}`;
    const updatedTitle = `${reviewTitle} updated`;
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
        description: 'A disposable map for Review replacement evidence.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('map-assets.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/maps/${map.data.id}/map-assets`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: assetTitle,
        description: 'A disposable MapAsset for Review replacement evidence.',
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

    await console.getByLabel('Operation').selectOption('activities.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'review',
        title: reviewTitle,
        introduction: 'Return to your earlier explanation.',
        reflection_prompt: 'What feels clearer now?',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const review = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const activities = JSON.parse((await console.locator('pre').textContent()) ?? '{}') as {
        data: Array<{ id: string; updatedAt: string }>;
    };
    const initial = activities.data.find((activity) => activity.id === review.data.id);
    if (!initial) {
        throw new Error('the created Review Activity was not returned by its scoped list');
    }
    expect(initial.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await console.getByLabel('Operation').selectOption('activities.review.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${review.data.id}/review`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedTitle,
        slug: null,
        introduction: 'Compare this explanation with your earlier note.',
        prompt: 'What would you explain differently now?',
        note: null,
        topic: 'Vehicle electrics',
        subtopic: null,
        updated_at: initial.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(review.data.id);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedTitle);
    await expect(console.locator('pre')).toContainText('What would you explain differently now?');

    await console.getByLabel('Operation').selectOption('maps.destroy');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();
});

test('a content API author can replace a scoped Open Practice Activity through the documented console', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API open practice map ${suffix}`;
    const assetTitle = `Content API open practice MapAsset ${suffix}`;
    const practiceTitle = `Content API open practice ${suffix}`;
    const updatedTitle = `${practiceTitle} updated`;
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
        description: 'A disposable map for Open Practice replacement evidence.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('map-assets.store');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}/map-assets`);
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: assetTitle,
        description: 'A disposable MapAsset for Open Practice replacement evidence.',
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

    await console.getByLabel('Operation').selectOption('activities.store');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'open_practice',
        title: practiceTitle,
        introduction: 'Try the idea in a nearby situation.',
        open_practice_next_step: 'Choose one useful next step.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const practice = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const activities = JSON.parse((await console.locator('pre').textContent()) ?? '{}') as {
        data: Array<{ id: string; updatedAt: string }>;
    };
    const initial = activities.data.find((activity) => activity.id === practice.data.id);
    if (!initial) {
        throw new Error('the created Open Practice Activity was not returned by its scoped list');
    }
    expect(initial.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await console.getByLabel('Operation').selectOption('activities.open-practice.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${practice.data.id}/open-practice`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedTitle,
        slug: null,
        introduction: 'Apply the idea in a different setting.',
        next_step: 'Name one concrete next step before continuing.',
        updated_at: initial.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(practice.data.id);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedTitle);
    await expect(console.locator('pre')).toContainText('Name one concrete next step before continuing.');

    await console.getByLabel('Operation').selectOption('maps.destroy');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();
});

test('a content API author can replace a scoped Markdown Activity page graph through the documented console', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API Markdown map ${suffix}`;
    const assetTitle = `Content API Markdown MapAsset ${suffix}`;
    const markdownTitle = `Content API Markdown ${suffix}`;
    const updatedTitle = `${markdownTitle} updated`;
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
        description: 'A disposable map for Markdown page-graph replacement evidence.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('map-assets.store');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}/map-assets`);
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: assetTitle,
        description: 'A disposable MapAsset for Markdown page-graph replacement evidence.',
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

    await console.getByLabel('Operation').selectOption('activities.store');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'markdown',
        title: markdownTitle,
        introduction: 'Read a short source-shaped briefing before continuing.',
        markdown_pages: [{
            id: 'briefing',
            title: 'Briefing',
            body: '# Start here\n\nChoose one detail worth revisiting.',
            position: { x: 140, y: 80 },
            visual: {
                page_color_dark: '#0f172a',
                page_color_light: '#ffffff',
                border_color_dark: '#2dd4bf',
                border_color_light: '#0891b2',
                heading_color_dark: '#67e8f9',
                heading_color_light: '#0e7490',
                text_color_dark: '#f8fafc',
                text_color_light: '#0f172a',
            },
        }],
        markdown_transitions: [
            { id: 'start-briefing', from: 'start', to: 'briefing' },
            { id: 'briefing-end', from: 'briefing', to: 'end' },
        ],
        markdown_graph_layout: {},
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const markdown = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const activities = JSON.parse((await console.locator('pre').textContent()) ?? '{}') as {
        data: Array<{ id: string; updatedAt: string }>;
    };
    const initial = activities.data.find((activity) => activity.id === markdown.data.id);
    if (!initial) {
        throw new Error('the created Markdown Activity was not returned by its scoped list');
    }
    expect(initial.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await console.getByLabel('Operation').selectOption('activities.markdown.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${markdown.data.id}/markdown`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedTitle,
        slug: null,
        introduction: 'Read this revised briefing before continuing.',
        markdown_pages: [{
            id: 'briefing',
            title: 'Updated briefing',
            body: '# Updated direction\n\nName one detail you will use next.',
            position: { x: 140, y: 80 },
            visual: {
                page_color_dark: '#0f172a',
                page_color_light: '#ffffff',
                border_color_dark: '#2dd4bf',
                border_color_light: '#0891b2',
                heading_color_dark: '#67e8f9',
                heading_color_light: '#0e7490',
                text_color_dark: '#f8fafc',
                text_color_light: '#0f172a',
            },
        }],
        markdown_transitions: [
            { id: 'start-briefing', from: 'start', to: 'briefing' },
            { id: 'briefing-end', from: 'briefing', to: 'end' },
        ],
        markdown_graph_layout: {},
        updated_at: initial.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(markdown.data.id);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedTitle);
    await expect(console.locator('pre')).toContainText('Name one detail you will use next.');

    await console.getByLabel('Operation').selectOption('maps.destroy');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();
});

test('a content API author can replace a scoped Question Activity through the documented console', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API Question map ${suffix}`;
    const assetTitle = `Content API Question MapAsset ${suffix}`;
    const questionTitle = `Content API Question ${suffix}`;
    const updatedTitle = `${questionTitle} updated`;
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
        description: 'A disposable map for Question replacement evidence.',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const map = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('map-assets.store');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}/map-assets`);
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: assetTitle,
        description: 'A disposable MapAsset for Question replacement evidence.',
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

    await console.getByLabel('Operation').selectOption('activities.store');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'question',
        title: questionTitle,
        introduction: 'Choose the explanation that fits.',
        question_prompt: 'Which part receives the electrical current?',
        question_feedback_correct: 'Yes — the current flows through the load.',
        question_feedback_incorrect: 'Look again at the circuit.',
        question_explanation: 'A closed circuit routes current through the load.',
        question_allow_multiple: false,
        question_options: [
            { label: 'A', body: 'The load', is_correct: true, outcome_key: 'correct', feedback: 'That is right.' },
            { label: 'B', body: 'Outside the system', is_correct: false, outcome_key: 'incorrect', feedback: 'The circuit remains closed.' },
        ],
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const question = await createdResponse(console);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const activities = JSON.parse((await console.locator('pre').textContent()) ?? '{}') as {
        data: Array<{ id: string; updatedAt: string }>;
    };
    const initial = activities.data.find((activity) => activity.id === question.data.id);
    if (!initial) {
        throw new Error('the created Question Activity was not returned by its scoped list');
    }
    expect(initial.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await console.getByLabel('Operation').selectOption('activities.question.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${question.data.id}/question`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedTitle,
        slug: null,
        introduction: 'Choose the revised explanation that fits.',
        prompt: 'Which circuit component receives the current?',
        feedback_correct: 'Yes — the current passes through the selected load.',
        feedback_incorrect: 'Trace the complete circuit before choosing.',
        explanation: 'A closed circuit routes electrical current through its load.',
        allow_multiple: false,
        options: [
            { label: 'A', body: 'The selected load', is_correct: true, key: null, outcome_key: 'correct', feedback: 'That is right.', weights: { recall: 0.5 } },
            { label: 'B', body: 'Outside the circuit', is_correct: false, key: null, outcome_key: 'incorrect', feedback: 'The circuit remains closed.', weights: {} },
        ],
        updated_at: initial.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(question.data.id);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(`/api/content/v1/map-assets/${mapAsset.data.id}/activities`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedTitle);
    await expect(console.locator('pre')).toContainText('The selected load');

    await console.getByLabel('Operation').selectOption('maps.destroy');
    await console.getByLabel('Request path').fill(`/api/content/v1/maps/${map.data.id}`);
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 204')).toBeVisible();
});

test('a content API author creates a MapAsset Activity through the documented console flow', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const suffix = Date.now();
    const mapTitle = `Content API browser map ${suffix}`;
    const assetTitle = `Content API browser MapAsset ${suffix}`;
    const portalTargetAssetTitle = `Content API browser portal target ${suffix}`;
    const activityTitle = `Content API browser practice ${suffix}`;
    const dialogueTitle = `Content API browser dialogue ${suffix}`;
    const messageTitle = `Content API browser message ${suffix}`;
    const messageWallTitle = `Content API browser message wall ${suffix}`;
    const reflectionTitle = `Content API browser reflection ${suffix}`;
    const reviewTitle = `Content API browser review ${suffix}`;
    const markdownTitle = `Content API browser briefing ${suffix}`;
    const questionTitle = `Content API browser question ${suffix}`;
    const sharedTaskTitle = `Content API browser shared task ${suffix}`;
    const itemGrantTitle = `Content API browser item grant ${suffix}`;
    const toolGrantTitle = `Content API browser tool grant ${suffix}`;
    const itemObstacleTitle = `Content API browser item obstacle ${suffix}`;
    const obstacleTitle = `Content API browser obstacle ${suffix}`;
    const portalInputTitle = `Content API browser portal arrival ${suffix}`;
    const portalOutputTitle = `Content API browser portal departure ${suffix}`;
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

    await console.getByLabel('Operation').selectOption('maps.index');
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(mapTitle);

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

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: portalTargetAssetTitle,
        description: 'A disposable destination for Content API Portal verification.',
        image_url: null,
        text: portalTargetAssetTitle,
        position_x: 70,
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
    const portalTargetMapAsset = await createdResponse(console);
    expect(portalTargetMapAsset.data.id).toMatch(/^[0-9a-f-]{36}$/i);

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

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'npc_dialogue',
        title: dialogueTitle,
        introduction: 'Ask the guide one question about this place.',
        graph_position_x: 180,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const dialogue = await createdResponse(console);
    expect(dialogue.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(dialogue.data).toMatchObject({ type: 'npc_dialogue', title: dialogueTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'message_prompt',
        title: messageTitle,
        introduction: 'Invite a useful observation from the next learner.',
        message_topic_title: `Content API browser notes ${suffix}`,
        graph_position_x: 240,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const message = await createdResponse(console);
    expect(message.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(message.data).toMatchObject({ type: 'message_prompt', title: messageTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'message_wall',
        title: messageWallTitle,
        introduction: 'Let learners find the observations others have shared.',
        message_topic_title: `Content API browser notes ${suffix}`,
        graph_position_x: 300,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const messageWall = await createdResponse(console);
    expect(messageWall.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(messageWall.data).toMatchObject({ type: 'message_wall', title: messageWallTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'reflection',
        title: reflectionTitle,
        introduction: 'Pause to connect this place with an earlier idea.',
        reflection_prompt: 'What connection do you notice here?',
        reflection_note: 'A short private note can help you return to this thought.',
        reflection_topic: 'Content API browser evidence',
        reflection_subtopic: 'Reflection',
        graph_position_x: 360,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const reflection = await createdResponse(console);
    expect(reflection.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(reflection.data).toMatchObject({ type: 'reflection', title: reflectionTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'review',
        title: reviewTitle,
        introduction: 'Revisit an earlier idea with the benefit of this encounter.',
        reflection_prompt: 'What would you now explain differently?',
        reflection_note: 'Keep a small comparison note for your next return.',
        reflection_topic: 'Content API browser evidence',
        reflection_subtopic: 'Review',
        graph_position_x: 420,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const review = await createdResponse(console);
    expect(review.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(review.data).toMatchObject({ type: 'review', title: reviewTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'markdown',
        title: markdownTitle,
        introduction: 'Read a short source-shaped briefing before exploring further.',
        markdown_pages: [{
            id: 'briefing',
            title: 'A browser-created briefing',
            body: '# Notice the connections\n\nChoose one detail worth revisiting.',
            position: { x: 140, y: 80 },
            visual: {
                page_color_dark: '#0f172a',
                page_color_light: '#ffffff',
                border_color_dark: '#2dd4bf',
                border_color_light: '#0891b2',
                heading_color_dark: '#67e8f9',
                heading_color_light: '#0e7490',
                text_color_dark: '#f8fafc',
                text_color_light: '#0f172a',
            },
        }],
        markdown_transitions: [
            { id: 'start-briefing', from: 'start', to: 'briefing' },
            { id: 'briefing-end', from: 'briefing', to: 'end' },
        ],
        markdown_graph_layout: {},
        graph_position_x: 480,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const markdown = await createdResponse(console);
    expect(markdown.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(markdown.data).toMatchObject({ type: 'markdown', title: markdownTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'question',
        title: questionTitle,
        introduction: 'Choose the description that best fits the activity adapter.',
        question_prompt: 'Which field carries the authored question text?',
        question_feedback_correct: 'Yes — it is validated before the scoped command runs.',
        question_feedback_incorrect: 'Try again by looking at the documented request fields.',
        question_explanation: 'The typed question adapter retains source-shaped options and feedback.',
        question_allow_multiple: false,
        question_options: [
            {
                label: 'A',
                body: 'question_prompt',
                is_correct: true,
                outcome_key: 'correct',
                feedback: 'That is the authored question text.',
            },
            {
                label: 'B',
                body: 'graph_position_x',
                is_correct: false,
                outcome_key: 'incorrect',
                feedback: 'That locates the card in the author graph.',
            },
        ],
        graph_position_x: 540,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const question = await createdResponse(console);
    expect(question.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(question.data).toMatchObject({ type: 'question', title: questionTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'shared_task',
        title: sharedTaskTitle,
        introduction: 'Gather a small collection of observations with other learners.',
        shared_task_kind: 'reflection',
        shared_task_show_contributions: true,
        shared_task_prompt: 'What did you notice while working through this place?',
        shared_task_instructions: 'Use one concrete detail that another learner can build on.',
        shared_task_input_label: 'Your reflection',
        shared_task_project_goal: 'Build a shared record of useful observations.',
        shared_task_project_deliverable: 'One clear evidence-based contribution.',
        shared_task_project_steps: ['Observe', 'Explain'],
        shared_task_peer_review_enabled: true,
        shared_task_peer_review_prompt: 'What does this contribution help you notice?',
        shared_task_threshold: 3,
        shared_task_minimum_length: 20,
        shared_task_repeat_policy: 'once_per_user',
        shared_task_validation_mode: 'minimum_length',
        shared_task_cycle_mode: 'none',
        graph_position_x: 600,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const sharedTask = await createdResponse(console);
    expect(sharedTask.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(sharedTask.data).toMatchObject({ type: 'shared_task', title: sharedTaskTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'item_grant',
        title: itemGrantTitle,
        introduction: 'Receive a scoped catalog item after making an observation.',
        item_grant_items: [{
            item_id: '20000000-0000-4000-8000-000000000001',
            quantity: 1,
        }],
        item_grant_probability_percent: 100,
        graph_position_x: 660,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const itemGrant = await createdResponse(console);
    expect(itemGrant.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(itemGrant.data).toMatchObject({ type: 'item_grant', title: itemGrantTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'tool_grant',
        title: toolGrantTitle,
        introduction: 'Receive a scoped tool for a later author-designed interaction.',
        tool_grant_bubble_border_color_dark: '#2dd4bf',
        tool_grant_bubble_border_color_light: '#0891b2',
        tool_grant_bubble_color_dark: '#0f172a',
        tool_grant_bubble_color_light: '#ffffff',
        tool_grant_bubble_opacity_dark: 92,
        tool_grant_bubble_opacity_light: 94,
        tool_grant_fade_duration_seconds: 0.4,
        tool_grant_slide_direction: 'left',
        tool_grant_slide_duration_seconds: 0.6,
        tool_grant_text: 'Use this tool when the next place invites careful inspection.',
        tool_grant_tool_id: '10000000-0000-4000-8000-000000000001',
        tool_grant_tool_mirrored: false,
        tool_grant_tool_x: 50,
        tool_grant_tool_y: 50,
        tool_grant_typing_speed: 24,
        graph_position_x: 720,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const toolGrant = await createdResponse(console);
    expect(toolGrant.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(toolGrant.data).toMatchObject({ type: 'tool_grant', title: toolGrantTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'item_obstacle',
        title: itemObstacleTitle,
        introduction: 'Use a scoped item deliberately to open the next encounter.',
        item_obstacle_overlay_x: 50,
        item_obstacle_overlay_y: 50,
        item_obstacle_overlay_width: 30,
        item_obstacle_slots: [{
            item_id: '20000000-0000-4000-8000-000000000001',
            x: 50,
            y: 50,
            width: 10,
        }],
        item_obstacle_consume_on_each_entry: false,
        item_obstacle_lock_minutes: 0,
        graph_position_x: 780,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const itemObstacle = await createdResponse(console);
    expect(itemObstacle.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(itemObstacle.data).toMatchObject({ type: 'item_obstacle', title: itemObstacleTitle });

    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'obstacle',
        title: obstacleTitle,
        introduction: 'Use the configured tool to make a careful next observation.',
        obstacle_allowed_tool_ids: ['10000000-0000-4000-8000-000000000001'],
        obstacle_bubble_border_color_dark: '#2dd4bf',
        obstacle_bubble_border_color_light: '#0891b2',
        obstacle_bubble_color_dark: '#0f172a',
        obstacle_bubble_color_light: '#ffffff',
        obstacle_bubble_opacity_dark: 92,
        obstacle_bubble_opacity_light: 94,
        obstacle_persist_after_solved: true,
        obstacle_prompt_text: 'Which detail does the tool help you notice?',
        obstacle_x: 50,
        obstacle_y: 50,
        obstacle_width: 28,
        obstacle_success_animation: 'zoom',
        obstacle_success_text: 'The obstacle has opened a useful next direction.',
        obstacle_typing_speed: 24,
        graph_position_x: 840,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const obstacle = await createdResponse(console);
    expect(obstacle.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(obstacle.data).toMatchObject({ type: 'obstacle', title: obstacleTitle });

    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${portalTargetMapAsset.data.id}/activities`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'portal',
        title: portalInputTitle,
        introduction: 'Arrive at this MapAsset through a same-World portal.',
        portal_mode: 'input',
        portal_bubble_text: 'You have arrived at a new place to inspect.',
        portal_bubble_typing_speed: 24,
        graph_position_x: 120,
        graph_position_y: 140,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const portalInput = await createdResponse(console);
    expect(portalInput.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(portalInput.data).toMatchObject({ type: 'portal', title: portalInputTitle });

    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        type: 'portal',
        title: portalOutputTitle,
        introduction: 'Travel to the related MapAsset after this encounter.',
        portal_mode: 'output',
        portal_duration_seconds: 1.5,
        portal_foreground_width: 28,
        portal_foreground_x: 50,
        portal_foreground_y: 50,
        portal_show_on_arrival: true,
        portal_swirl_enabled: true,
        portal_bubble_text: 'Enter the next place when you are ready.',
        portal_bubble_typing_speed: 24,
        portal_bubble_color_dark: '#0f172a',
        portal_bubble_color_light: '#ffffff',
        portal_bubble_border_color_dark: '#2dd4bf',
        portal_bubble_border_color_light: '#0891b2',
        portal_bubble_text_color_dark: '#f8fafc',
        portal_bubble_text_color_light: '#0f172a',
        portal_wait_for_enter: false,
        target_portal_activity_id: portalInput.data.id,
        graph_position_x: 900,
        graph_position_y: 80,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 201')).toBeVisible();
    const portalOutput = await createdResponse(console);
    expect(portalOutput.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(portalOutput.data).toMatchObject({ type: 'portal', title: portalOutputTitle });

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(activityTitle);
    await expect(console.locator('pre')).toContainText(dialogueTitle);
    await expect(console.locator('pre')).toContainText(messageTitle);
    await expect(console.locator('pre')).toContainText(messageWallTitle);
    await expect(console.locator('pre')).toContainText(reflectionTitle);
    await expect(console.locator('pre')).toContainText(reviewTitle);
    await expect(console.locator('pre')).toContainText(markdownTitle);
    await expect(console.locator('pre')).toContainText(questionTitle);
    await expect(console.locator('pre')).toContainText(sharedTaskTitle);
    await expect(console.locator('pre')).toContainText(itemGrantTitle);
    await expect(console.locator('pre')).toContainText(toolGrantTitle);
    await expect(console.locator('pre')).toContainText(itemObstacleTitle);
    await expect(console.locator('pre')).toContainText(obstacleTitle);
    await expect(console.locator('pre')).toContainText(portalOutputTitle);

    const listedActivities = JSON.parse((await console.locator('pre').textContent()) ?? '{}') as {
        data: Array<{ id: string; updatedAt: string }>;
    };
    const initialSharedTask = listedActivities.data.find((activity) => activity.id === sharedTask.data.id);
    if (!initialSharedTask) {
        throw new Error('the created Shared Task Activity was not returned by its scoped list');
    }
    await console.getByLabel('Operation').selectOption('activities.shared-task.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${sharedTask.data.id}/shared-task`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: `${sharedTaskTitle} updated`,
        slug: null,
        introduction: 'Gather one useful observation with other learners.',
        task_kind: 'reflection',
        show_contributions: true,
        prompt: 'What did you notice while working through this place?',
        instructions: 'Use one concrete detail another learner can build on.',
        input_label: 'Your reflection',
        project_goal: 'Build a shared record of useful observations.',
        project_deliverable: 'One clear evidence-based contribution.',
        project_steps: ['Observe', 'Explain'],
        peer_review_enabled: true,
        peer_review_prompt: 'What does this contribution help you notice?',
        threshold: 3,
        minimum_length: 20,
        repeat_policy: 'once_per_user',
        validation_mode: 'minimum_length',
        cycle_mode: 'none',
        updated_at: initialSharedTask.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(sharedTask.data.id);

    const initialItemGrant = listedActivities.data.find((activity) => activity.id === itemGrant.data.id);
    if (!initialItemGrant) {
        throw new Error('the created Item Grant Activity was not returned by its scoped list');
    }
    const updatedItemGrantTitle = `${itemGrantTitle} updated`;
    await console.getByLabel('Operation').selectOption('activities.item-grant.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${itemGrant.data.id}/item-grant`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedItemGrantTitle,
        slug: null,
        introduction: 'Collect the configured item after making an observation.',
        background_dark: null,
        background_light: null,
        background_mirrored: false,
        items: [{
            item_id: '20000000-0000-4000-8000-000000000001',
            quantity: 1,
        }],
        probability_percent: 100,
        updated_at: initialItemGrant.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(itemGrant.data.id);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedItemGrantTitle);

    const initialToolGrant = listedActivities.data.find((activity) => activity.id === toolGrant.data.id);
    if (!initialToolGrant) {
        throw new Error('the created Tool Grant Activity was not returned by its scoped list');
    }
    const updatedToolGrantTitle = `${toolGrantTitle} updated`;
    await console.getByLabel('Operation').selectOption('activities.tool-grant.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities/${toolGrant.data.id}/tool-grant`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        title: updatedToolGrantTitle,
        slug: null,
        introduction: 'Receive a scoped tool for the next author-designed interaction.',
        background_dark: null,
        background_light: null,
        background_mirrored: false,
        bubble_border_color_dark: '#2dd4bf',
        bubble_border_color_light: '#0891b2',
        bubble_color_dark: '#0f172a',
        bubble_color_light: '#ffffff',
        bubble_opacity_dark: 92,
        bubble_opacity_light: 94,
        fade_duration_seconds: 0.4,
        slide_direction: 'left',
        slide_duration_seconds: 0.6,
        text: 'Use this tool when the next place invites careful inspection.',
        tool_id: '10000000-0000-4000-8000-000000000001',
        tool_mirrored: false,
        tool_x: 50,
        tool_y: 50,
        typing_speed: 24,
        updated_at: initialToolGrant.updatedAt,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(toolGrant.data.id);

    await console.getByLabel('Operation').selectOption('activities.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activities`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    await expect(console.locator('pre')).toContainText(updatedToolGrantTitle);

    await console
        .getByLabel('Operation')
        .selectOption('activity-transitions.store');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activity-transitions`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        from_activity_id: activity.data.id,
        to_activity_id: dialogue.data.id,
        from_connector: 'completed',
        to_connector: 'in',
        label: 'Continue to the dialogue',
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const transitionResponse = JSON.parse(
        (await console.locator('pre').textContent()) ?? '{}',
    ) as {
        data: Array<{
            fromActivityId: string;
            id: string;
            label: string | null;
            toActivityId: string | null;
        }>;
    };
    expect(transitionResponse.data).toContainEqual(
        expect.objectContaining({
            fromActivityId: activity.data.id,
            label: 'Continue to the dialogue',
            toActivityId: dialogue.data.id,
        }),
    );
    const createdTransition = transitionResponse.data.find(
        (transition) =>
            transition.fromActivityId === activity.data.id &&
            transition.toActivityId === dialogue.data.id,
    );
    expect(createdTransition).toBeDefined();
    if (!createdTransition) {
        throw new Error('the Content API did not return the created transition');
    }

    await console
        .getByLabel('Operation')
        .selectOption('activity-transitions.index');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activity-transitions`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const listedTransitionResponse = JSON.parse(
        (await console.locator('pre').textContent()) ?? '{}',
    ) as { data: Array<{ id: string }> };
    expect(listedTransitionResponse.data).toContainEqual(
        expect.objectContaining({
            id: createdTransition.id,
        }),
    );

    await console
        .getByLabel('Operation')
        .selectOption('activity-transitions.update');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${portalTargetMapAsset.data.id}/activity-transitions/${createdTransition.id}`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 404')).toBeVisible();

    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activity-transitions/${createdTransition.id}`,
    );
    await console.getByLabel('JSON request body').fill(JSON.stringify({
        label: 'Continue after checking the dialogue',
        trigger_value: null,
    }));
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const updatedTransitionResponse = JSON.parse(
        (await console.locator('pre').textContent()) ?? '{}',
    ) as { data: Array<{ id: string; label: string | null }> };
    expect(updatedTransitionResponse.data).toContainEqual(
        expect.objectContaining({
            id: createdTransition.id,
            label: 'Continue after checking the dialogue',
        }),
    );

    await console
        .getByLabel('Operation')
        .selectOption('activity-transitions.destroy');
    await console.getByLabel('Request path').fill(
        `/api/content/v1/map-assets/${mapAsset.data.id}/activity-transitions/${createdTransition.id}`,
    );
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();
    const deletedTransitionResponse = JSON.parse(
        (await console.locator('pre').textContent()) ?? '{}',
    ) as { data: Array<{ id: string }> };
    expect(deletedTransitionResponse.data).not.toContainEqual(
        expect.objectContaining({
            id: createdTransition.id,
        }),
    );
});
