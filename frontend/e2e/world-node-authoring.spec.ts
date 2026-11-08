import { expect, test } from '@playwright/test';

type NodeSummary = {
    id: string;
    position: { q: number; r: number };
    title: string;
    visual_config: unknown;
};

type MapDocument = {
    editable_map: {
        map: {
            map_assets: Array<{ id: string; node_id: string | null }>;
            nodes: NodeSummary[];
        };
    };
};

type NodeAuthoringDocument = {
    tools: Array<{ id: string; slug: string }>;
};

const node = (title: string, q: number, r: number, state = 'available') => ({
    title,
    description: `${title} description`,
    position_q: q,
    position_r: r,
    state,
    visual_config: {
        dark: {
            imageRotation: '0',
            imageWidth: '100',
            imageX: '50',
            imageY: '50',
            tileOpacity: '100',
        },
        light: {
            imageRotation: '0',
            imageWidth: '100',
            imageX: '50',
            imageY: '50',
            tileOpacity: '100',
        },
    },
});

test('a local author writes the complete source node lifecycle', async ({ page }) => {
    test.setTimeout(60_000);
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    await page.goto('/settings?panel=admin-world-builder');

    const mapTitle = `Node authoring ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(mapTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: mapTitle })).toBeVisible();
    const exportHref = await page
        .getByRole('link', { name: 'Export map' })
        .getAttribute('href');
    const mapId = exportHref?.match(/maps\/([^/]+)\/export$/)?.[1];
    if (!mapId) throw new Error('the disposable map did not expose its ID');

    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const headers = {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': token,
    };
    const document = async () =>
        (await (
            await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}`)
        ).json()) as MapDocument;

    const first = await page.request.post(
        `/api/v1/admin/world-builder/maps/${mapId}/nodes`,
        { data: node('First source node', 0, 0, 'recommended'), headers },
    );
    expect(first.status()).toBe(201);
    const firstCreated = (await first.json()) as {
        asset_id: string;
        node_id: string;
    };
    const second = await page.request.post(
        `/api/v1/admin/world-builder/maps/${mapId}/nodes`,
        { data: node('Second source node', 1, 0, 'hidden'), headers },
    );
    expect(second.status()).toBe(201);
    const secondCreated = (await second.json()) as { node_id: string };

    const authoring = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${firstCreated.node_id}`,
    );
    expect(authoring.ok()).toBeTruthy();
    const tool = (await authoring.json() as NodeAuthoringDocument).tools[0];
    if (!tool) throw new Error('the local authoring catalogue has no tool');
    const reveal = await page.request.post(
        `/api/v1/admin/world-builder/maps/${mapId}/nodes`,
        {
            data: {
                ...node('Catalog tool reference', -2, 0, 'hidden'),
                visual_config: {
                    reveal: { enabled: true, toolId: tool.id },
                },
            },
            headers,
        },
    );
    expect(reveal.status()).toBe(201);
    const revealCreated = (await reveal.json()) as { node_id: string };
    const normalizedReveal = (await document()).editable_map.map.nodes.find(
        (candidate) => candidate.id === revealCreated.node_id,
    );
    expect(normalizedReveal?.visual_config).toMatchObject({
        reveal: { enabled: true, toolId: tool.slug },
    });

    const rejectedPrerequisite = await page.request.post(
        `/api/v1/admin/world-builder/maps/${mapId}/nodes`,
        {
            data: {
                ...node('Rejected prerequisite', -1, 0, 'locked'),
                visual_config: {
                    unlock: {
                        enabled: true,
                        requiredNodeIds: [
                            '00000000-0000-4000-8000-000000000000',
                        ],
                    },
                },
            },
            headers,
        },
    );
    expect(rejectedPrerequisite.status()).toBe(400);
    const prerequisite = await page.request.post(
        `/api/v1/admin/world-builder/maps/${mapId}/nodes`,
        {
            data: {
                ...node('Locked prerequisite', -1, 0, 'locked'),
                visual_config: {
                    unlock: {
                        enabled: true,
                        requiredNodeIds: [firstCreated.node_id],
                    },
                    schedule: { unlockAt: '2026-11-08T12:10' },
                },
            },
            headers,
        },
    );
    expect(prerequisite.status()).toBe(201);
    const prerequisiteCreated = (await prerequisite.json()) as { node_id: string };
    const configuredPrerequisite = (await document()).editable_map.map.nodes.find(
        (candidate) => candidate.id === prerequisiteCreated.node_id,
    );
    expect(configuredPrerequisite?.visual_config).toMatchObject({
        schedule: { unlockAt: '2026-11-08T12:10:00Z' },
        unlock: { requiredNodeIds: [firstCreated.node_id] },
    });

    const rejectedSelfPrerequisite = await page.request.patch(
        `/api/v1/admin/world-builder/nodes/${firstCreated.node_id}`,
        {
            data: {
                ...node('First source node', 0, 0, 'locked'),
                visual_config: {
                    unlock: {
                        enabled: true,
                        requiredNodeIds: [firstCreated.node_id],
                    },
                },
            },
            headers,
        },
    );
    expect(rejectedSelfPrerequisite.status()).toBe(400);

    const moved = await page.request.patch(
        `/api/v1/admin/world-builder/nodes/${firstCreated.node_id}`,
        {
            data: node('First source node updated', 0, -1, 'active'),
            headers,
        },
    );
    expect(moved.status()).toBe(204);
    const layoutHistory = await page.request.get(
        `/api/v1/admin/world-builder/maps/${mapId}/layout-versions?page=1&per_page=6`,
    );
    expect(layoutHistory.ok()).toBeTruthy();
    expect((await layoutHistory.json()) as { total: number }).toMatchObject({
        total: 1,
    });

    const movedFirst = (await document()).editable_map.map.nodes.find(
        (candidate) => candidate.id === firstCreated.node_id,
    );
    if (!movedFirst) throw new Error('the created source node disappeared');
    const restoredPosition = await page.request.patch(
        `/api/v1/admin/world-builder/nodes/${firstCreated.node_id}`,
        {
            data: node('First source node updated', 0, 0, 'active'),
            headers,
        },
    );
    expect(restoredPosition.status()).toBe(204);

    const inserted = await page.request.post(
        `/api/v1/admin/world-builder/nodes/${firstCreated.node_id}/insert`,
        {
            data: {
                direction: { q: 1, r: 0 },
                node: node('Inserted source node', 99, 99, 'completed'),
            },
            headers,
        },
    );
    expect(inserted.status()).toBe(201);
    const insertedCreated = (await inserted.json()) as { node_id: string };
    const afterInsert = (await document()).editable_map.map.nodes;
    expect(
        afterInsert.find((candidate) => candidate.id === firstCreated.node_id)
            ?.position,
    ).toEqual({ q: 0, r: 0 });
    expect(
        afterInsert.find((candidate) => candidate.id === insertedCreated.node_id)
            ?.position,
    ).toEqual({ q: 1, r: 0 });
    expect(
        afterInsert.find((candidate) => candidate.id === secondCreated.node_id)
            ?.position,
    ).toEqual({ q: 2, r: 0 });

    const removed = await page.request.delete(
        `/api/v1/admin/world-builder/nodes/${secondCreated.node_id}`,
        { headers },
    );
    expect(removed.status()).toBe(204);
    const afterDelete = (await document()).editable_map.map;
    expect(
        afterDelete.nodes.some((candidate) => candidate.id === secondCreated.node_id),
    ).toBeFalsy();
    expect(
        afterDelete.map_assets.some(
            (asset) => asset.node_id === secondCreated.node_id,
        ),
    ).toBeFalsy();

    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
