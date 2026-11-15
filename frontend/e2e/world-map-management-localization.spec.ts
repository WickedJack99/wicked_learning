import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

const ids = {
    firstMap: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
    node: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
    secondMap: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9d',
};

function map({
    description = null,
    id,
    nodes = [],
    reviewCount = 0,
    title,
}: {
    description?: string | null;
    id: string;
    nodes?: object[];
    reviewCount?: number;
    title: string;
}) {
    return {
        access_roles: [],
        description,
        id,
        node_count: nodes.length,
        nodes,
        review_count: reviewCount,
        slug: title.toLowerCase().replaceAll(' ', '-'),
        title,
        updated_at: '2026-11-15T12:34:00Z',
    };
}

const node = {
    activity_review_count: 1,
    description: 'Mocked MapAsset description',
    id: ids.node,
    position: { q: 0, r: 0 },
    slug: 'mocked-map-asset',
    state: 'available',
    title: 'Mocked MapAsset',
    unlock_diagnostics: [],
    visual_config: {},
};

async function installWorldBuilderRoutes(page: Page, maps: object[]) {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'world-builder-admin@example.test',
                roles: ['administrator'],
                settings_access: { world_activities: true, world_maps: true, world_nodes: true },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ locale: 'test', translations: {} }),
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps,
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9d',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
}

async function expectBoundedWorkspace(
    page: Page,
    viewport: { height: number; width: number },
) {
    const workspace = page.locator(
        '[data-wl-id="authoring.world-builder.structural-workspace"]',
    );
    await workspace.scrollIntoViewIfNeeded();
    await expect(workspace).toBeVisible();
    const bounds = await workspace.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);

    return workspace;
}

test('World Builder lifts the pinned-source Structural map and MapAsset navigator at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page, [
        map({
            id: ids.firstMap,
            nodes: [node],
            reviewCount: 1,
            title: 'Mocked structural map',
        }),
        map({ id: ids.secondMap, title: 'Second source map' }),
    ]);

    await page.goto('/settings?panel=admin-world-builder&worldSection=structural');
    const workspace = await expectBoundedWorkspace(page, {
        height: 900,
        width: 1440,
    });

    await expect(workspace.getByText('World maps', { exact: true })).toBeVisible();
    await expect(workspace.getByText('1 tile', { exact: true })).toBeVisible();
    await expect(
        workspace.getByText('1 activity needs review', { exact: true }),
    ).toHaveCount(2);
    await expect(workspace.getByText('Selected map', { exact: true })).toBeVisible();
    await expect(workspace.getByText('No map description yet.')).toBeVisible();
    await expect(
        workspace.getByText('Map configuration', { exact: true }),
    ).toBeVisible();
    await expect(
        workspace.getByText('Details, visuals and access.').first(),
    ).toBeVisible();
    await expect(workspace.getByText('MapAssets', { exact: true })).toBeVisible();
    await expect(
        workspace.getByText('Mocked MapAsset', { exact: true }),
    ).toBeVisible();
    await expect(
        workspace.getByText('Mocked MapAsset description'),
    ).toBeVisible();
    await expect(
        workspace.getByText(
            'Select a MapAsset to edit its activities, or open the map configuration for details, visuals and access.',
        ),
    ).toBeVisible();

    const configureMap = workspace.getByRole('link', {
        name: 'Configure map',
    });
    await expect(configureMap).toHaveAttribute(
        'href',
        `/settings?panel=admin-world-builder&worldSection=structural&map=${ids.firstMap}&worldView=configure`,
    );
    await expect(
        workspace.getByRole('link', { name: /Map configuration/ }),
    ).toHaveAttribute(
        'href',
        `/settings?panel=admin-world-builder&worldSection=structural&map=${ids.firstMap}&worldView=configure`,
    );
    await expect(
        workspace.getByRole('link', { name: /Mocked MapAsset/ }),
    ).toHaveAttribute(
        'href',
        `/settings?panel=admin-world-builder&worldSection=structural&map=${ids.firstMap}&node=${ids.node}&worldView=nodes`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expectBoundedWorkspace(page, { height: 844, width: 390 });
    await expect(configureMap).toBeVisible();

    await workspace.getByRole('link', { name: /Second source map/ }).click();
    await expect(page).toHaveURL(
        new RegExp(`worldSection=structural&map=${ids.secondMap}`),
    );

    await page.goto('/settings?panel=admin-world-builder&worldSection=structural');
    await configureMap.click();
    await expect(page).toHaveURL(
        new RegExp(
            `worldSection=structural&map=${ids.firstMap}&worldView=configure`,
        ),
    );
    await page.goto('/settings?panel=admin-world-builder&worldSection=structural');
    await workspace.getByRole('link', { name: /Mocked MapAsset/ }).click();
    await expect(page).toHaveURL(
        new RegExp(
            `worldSection=structural&map=${ids.firstMap}&node=${ids.node}&worldView=nodes`,
        ),
    );
});

test('World Builder lifts the pinned-source Structural no-map state at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page, []);
    await page.goto('/settings?panel=admin-world-builder&worldSection=structural');

    for (const viewport of [
        { height: 900, width: 1440 },
        { height: 844, width: 390 },
    ]) {
        await page.setViewportSize(viewport);
        const workspace = await expectBoundedWorkspace(page, viewport);
        await expect(
            workspace.getByText(
                'Create a map before configuring map or MapAsset access.',
            ),
        ).toHaveCount(2);
    }
});
