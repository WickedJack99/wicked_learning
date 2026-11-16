import type { Locator, Page } from '@playwright/test';

import { expect, test } from './authenticated';

test.setTimeout(60_000);

const viewports = [
    { height: 900, width: 1440 },
    { height: 844, width: 390 },
] as const;

type WorldGraphRead = {
    maps: Array<{
        id: string;
        title: string;
    }>;
};

async function expectBoundedInViewport(
    locator: Locator,
    viewport: { height: number; width: number },
) {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeVisible();

    const bounds = await locator.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
}

async function signInAsDisposableLocalAdministrator(page: Page) {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
}

test('a local world author sees the mounted source-derived Graph workspace at desktop and narrow viewports', async ({
    page,
}) => {
    await signInAsDisposableLocalAdministrator(page);

    for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(
            '/settings?panel=admin-world-builder&worldSection=graph',
        );

        const graphResponse = await page.request.get(
            '/api/v1/admin/world-builder',
        );
        expect(graphResponse.ok()).toBeTruthy();
        const graphDocument = (await graphResponse.json()) as WorldGraphRead;

        const workspace = page.locator(
            '[data-wl-id="authoring.world-builder.graph-workspace"]',
        );
        const graph = page.locator(
            '[data-wl-id="authoring.world-builder.graph"]',
        );
        const mapCards = graph.locator(
            '[data-wl-id="authoring.world-builder.graph.map-card"]',
        );

        await expect(workspace).toBeVisible();
        await expectBoundedInViewport(graph, viewport);
        await expect(
            graph.getByRole('status', { name: 'Preparing graph view' }),
        ).toBeHidden();
        await expect(mapCards).toHaveCount(graphDocument.maps.length);

        await expectBoundedInViewport(
            page.getByRole('heading', { name: 'Select a map or portal' }),
            viewport,
        );
        await expectBoundedInViewport(
            page.getByRole('heading', { name: 'New world map' }),
            viewport,
        );
        await expectBoundedInViewport(
            page.getByRole('button', { name: 'Create world node' }),
            viewport,
        );
        await expectBoundedInViewport(
            page.getByRole('heading', { name: 'Portal routes' }),
            viewport,
        );
    }
});
