import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

test.setTimeout(60_000);

type WorldGraphRead = {
    maps: Array<{
        id: string;
        nodes: Array<{
            id: string;
        }>;
    }>;
};

type WorldNodeRead = {
    activity_graph: {
        activities: Array<{
            id: string;
        }>;
        transitions: Array<{
            id: string;
        }>;
    };
};

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

async function findTwoNodesWithActivities(page: Page, graph: WorldGraphRead) {
    const readableNodes: Array<{
        document: WorldNodeRead;
        nodeId: string;
    }> = [];

    for (const nodeId of graph.maps.flatMap((map) =>
        map.nodes.map((node) => node.id),
    )) {
        const response = await page.request.get(
            `/api/v1/admin/world-builder/nodes/${nodeId}`,
        );
        if (!response.ok()) {
            continue;
        }

        const document = (await response.json()) as WorldNodeRead;
        if (document.activity_graph.activities[0]) {
            readableNodes.push({ document, nodeId });
        }
        if (readableNodes.length === 2) {
            return readableNodes;
        }
    }

    throw new Error(
        'the disposable local World Builder needs two readable nodes with activities',
    );
}

test('a source transition cannot cross persisted World Builder node boundaries', async ({
    page,
}) => {
    await signInAsDisposableLocalAdministrator(page);

    const graphResponse = await page.request.get(
        '/api/v1/admin/world-builder',
    );
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as WorldGraphRead;
    const [source, target] = await findTwoNodesWithActivities(page, graph);
    if (!source || !target) {
        throw new Error('two readable World Builder nodes are required');
    }

    const sourceActivity = source.document.activity_graph.activities[0];
    const targetActivity = target.document.activity_graph.activities[0];
    if (!sourceActivity || !targetActivity) {
        throw new Error('both scoped nodes need a persisted activity');
    }

    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const rejected = await page.request.post(
        `/api/v1/admin/world-builder/nodes/${source.nodeId}/activity-transitions`,
        {
            data: {
                from_activity_id: sourceActivity.id,
                from_connector: 'completed',
                to_activity_id: targetActivity.id,
                to_connector: 'in',
            },
            headers: {
                Origin: new URL(page.url()).origin,
                'X-CSRF-Token': token,
            },
        },
    );
    expect(rejected.status()).toBe(404);

    const afterResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${source.nodeId}`,
    );
    expect(afterResponse.ok()).toBeTruthy();
    const after = (await afterResponse.json()) as WorldNodeRead;
    expect(after.activity_graph.transitions.map((transition) => transition.id)).toEqual(
        source.document.activity_graph.transitions.map((transition) => transition.id),
    );
});
