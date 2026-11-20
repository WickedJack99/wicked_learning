import { expect, test } from '@playwright/test';

const evidence = process.env.SEARCH_EVIDENCE_BASE_URL;
const mapId = '018f1f8c-4c2f-7b8a-9d0e-000000000002';
const nodeId = '018f1f8c-4c2f-7b8a-9d0e-000000000004';
const wire = {
    pagination: { current_page: 1, last_page: 1, per_page: 5, total: 3 },
    results: [
        { id: 'topic:018f1f8c-4c2f-7b8a-9d0e-000000000001', kind: 'topic', href: '/topics/orientation', title: 'Orientation', subtitle: 'Topic', map_id: null, map_slug: null, node_id: null, node_slug: null },
        { id: `map:${mapId}`, kind: 'map', href: '/world?map=orientation-map', title: 'Orientation map', subtitle: 'World map', map_id: mapId, map_slug: 'orientation-map', node_id: null, node_slug: null },
        { id: `node:${nodeId}`, kind: 'node', href: '/world?map=orientation-map&focused=first-place', title: 'First place', subtitle: 'Orientation map', map_id: mapId, map_slug: 'orientation-map', node_id: nodeId, node_slug: 'first-place' },
    ],
};

test.describe('World search adapter contracts', () => {
    test.skip(!evidence, 'Requires the source-preserving Vite evidence server.');

    test('preserves source result variants and actual identities', async ({ page }) => {
        await page.route('**/api/v1/learner/search?*', (route) => route.fulfill({ json: wire }));
        await page.goto(evidence!);
        const result = await page.evaluate(async () => {
            const { getJson } = await import('/src/platform/world-api.ts');
            return getJson('/learning/search?query=orientation');
        });
        expect(result).toEqual({
            pagination: { currentPage: 1, lastPage: 1, perPage: 5, total: 3 },
            results: wire.results.map(({ map_id, map_slug, node_id, node_slug, ...common }) => ({
                ...common,
                ...(common.kind !== 'topic' ? { mapId: map_id, mapSlug: map_slug } : {}),
                ...(common.kind === 'node' ? { nodeId: node_id, nodeSlug: node_slug } : {}),
            })),
        });
    });

    test('cancelled source searches do not fetch or present an unavailable alert', async ({ page }) => {
        let requests = 0;
        await page.route('**/api/v1/learner/search?*', (route) => { requests++; return route.fulfill({ json: wire }); });
        await page.goto(evidence!);
        const result = await page.evaluate(async () => {
            const { getJson } = await import('/src/platform/world-api.ts');
            const controller = new AbortController();
            controller.abort();
            let alerts = 0;
            window.addEventListener('world:source-operation-unavailable', () => alerts++);
            try { await getJson('/learning/search?query=cancelled', controller.signal); return { aborted: false, alerts }; }
            catch (error) { return { aborted: error instanceof DOMException && error.name === 'AbortError', alerts }; }
        });
        expect(result).toEqual({ aborted: true, alerts: 0 });
        expect(requests).toBe(0);
    });
});

test.describe('World search unavailable contracts', () => {
    test.skip(!evidence, 'Requires the source-preserving Vite evidence server.');
    for (const failure of ['unauthorized', 'unavailable', 'missing-node-id'] as const) {
        test(`rejects ${failure} without inventing a successful empty response`, async ({ page }) => {
            await page.route('**/api/v1/learner/search?*', (route) => route.fulfill({
                status: failure === 'unauthorized' ? 401 : failure === 'unavailable' ? 503 : 200,
                json: failure === 'missing-node-id'
                    ? { ...wire, results: [{ ...wire.results[2], node_id: null }] }
                    : { title: 'Unavailable' },
            }));
            await page.goto(evidence!);
            const result = await page.evaluate(async () => {
                const { getJson } = await import('/src/platform/world-api.ts');
                let alert = '';
                window.addEventListener('world:source-operation-unavailable', (event) => { alert = event.detail.message; });
                try { await getJson('/learning/search?query=orientation'); return { rejected: false, alert }; }
                catch { return { rejected: true, alert }; }
            });
            expect(result).toEqual({ rejected: true, alert: 'The World search is currently unavailable.' });
        });
    }
});
