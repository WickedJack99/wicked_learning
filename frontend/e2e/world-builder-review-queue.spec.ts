import { expect, test } from './authenticated';

test('a local world author can open a pending activity from the source-shaped review queue', async ({
    page,
}) => {
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

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    const map = graph.maps.find((candidate) => candidate.nodes.length > 0);
    expect(map).toBeDefined();
    if (!map) {
        throw new Error('the local World Builder has no readable node');
    }
    const nodeId = map.nodes[0]?.id;
    if (!nodeId) {
        throw new Error('the selected local map has no node');
    }

    const title = `Review queue ${Date.now()}`;
    const created = await browserJsonRequest<{
        activity_id: string;
    }>(
        page,
        `/api/v1/admin/world-builder/nodes/${nodeId}/open-practice-activities`,
        'POST',
        { title },
    );
    expect(created.status).toBe(201);

    try {
        const queuePage = await page.evaluate(async (activityTitle) => {
            let currentPage = 1;
            for (;;) {
                const response = await fetch(
                    `/api/v1/admin/world-builder/review-queue?page=${currentPage}&per_page=4`,
                );
                const body = (await response.json()) as {
                    items: Array<{ title: string }>;
                    pagination: { last_page: number };
                };
                if (!response.ok || body.items.some((item) => item.title === activityTitle)) {
                    return { body, currentPage, status: response.status };
                }
                if (currentPage >= body.pagination.last_page) {
                    return { body, currentPage, status: response.status };
                }
                currentPage += 1;
            }
        }, title);
        expect(queuePage.status).toBe(200);
        expect(queuePage.body.items).toContainEqual(
            expect.objectContaining({ title }),
        );
        await page.goto('/settings?panel=admin-world-builder');
        await page.getByRole('button', { name: /Review queue/ }).click();
        await expect(
            page.getByRole('heading', { name: 'Review queue' }),
        ).toBeVisible();
        for (let currentPage = 1; currentPage < queuePage.currentPage; currentPage += 1) {
            await page.getByRole('button', { name: 'Next' }).click();
            await expect(
                page.getByText(
                    `Page ${currentPage + 1} of ${queuePage.body.pagination.last_page}`,
                ),
            ).toBeVisible();
        }
        const card = page.locator('article', { hasText: title });
        await expect(card).toBeVisible();
        await card.getByRole('button', { name: 'Open activity graph' }).click();
        await expect(page).toHaveURL(
            new RegExp(`map=${map.id}.*node=${nodeId}`),
        );
        await expect(page.getByText(title, { exact: true })).toBeVisible();
    } finally {
        await browserJsonRequest(
            page,
            `/api/v1/admin/world-builder/activities/${created.data?.activity_id ?? '00000000-0000-4000-8000-000000000000'}`,
            'DELETE',
        );
    }
});

async function browserJsonRequest<T>(
    page: import('@playwright/test').Page,
    url: string,
    method: 'DELETE' | 'POST',
    body?: Record<string, unknown>,
): Promise<{ data: T | null; status: number }> {
    return page.evaluate(async ({ body, method, url }) => {
        const csrf = await fetch('/api/v1/security/csrf');
        const { token } = (await csrf.json()) as { token: string };
        const response = await fetch(url, {
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                'X-CSRF-Token': token,
            },
            method,
        });
        const data = response.status === 204 ? null : await response.json();
        return { data, status: response.status };
    }, { body, method, url });
}
