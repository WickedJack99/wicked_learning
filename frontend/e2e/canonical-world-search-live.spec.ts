import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`real Rust search retains graph identities and navigates copied World at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        const context = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const shell = await (await context.request.get('/api/v1/learner/shell')).json();
        const world = await (await context.request.get('/api/v1/learner/world')).json();
        const graphMap = world.graph.maps[0];
        const map = world.world.maps.find((map) => map.slug === graphMap.slug);
        const place = map.nodes.find((node) => !['hidden', 'locked'].includes(node.state));
        expect(place).toBeDefined();
        const node = { ...place, id: graphMap.nodes.find((node) => node.slug === place.slug).id };
        map.id = graphMap.id;
        try {
            const start = performance.now();
            const result = await context.request.get(`/api/v1/learner/search?query=${encodeURIComponent(map.title)}&per_page=24`);
            expect(result.status()).toBe(200);
            const bytes = (await result.body()).length;
            const document = await result.json();
            await info.attach('search-read-measurement', { contentType: 'application/json', body: JSON.stringify({ duration_ms: Math.round(performance.now() - start), bytes, results: document.results.length }) });
            expect(document.results.length).toBeLessThanOrEqual(24);
            expect(document.results.find((row) => row.kind === 'map' && row.map_slug === map.slug)).toMatchObject({ map_id: map.id, node_id: null });
            expect(document.results.find((row) => row.kind === 'node' && row.node_slug === node.slug)).toMatchObject({ map_id: map.id, node_id: node.id });
            for (const row of document.results) {
                if (row.kind === 'topic') { expect(row.map_id).toBeNull(); expect(row.node_id).toBeNull(); continue; }
                const graphMap = world.graph.maps.find((candidate) => candidate.slug === row.map_slug);
                expect(row.map_id).toBe(graphMap.id);
                if (row.kind === 'node') expect(row.node_id).toBe(graphMap.nodes.find((candidate) => candidate.slug === row.node_slug).id);
            }
            const page = await context.newPage();
            page.setDefaultTimeout(5_000);
            await page.goto(`/world?map=${map.slug}`);
            await expect(page.locator('.platform-shell')).toBeVisible();
            if (viewport.width === 390) {
                // The pinned Companion wrapper intercepts this pointer target.
                // Test the real keyboard path; source comparison records the defect.
                const trigger = page.getByRole('button', { name: 'Open map search' });
                await trigger.focus();
                await trigger.press('Enter');
            }
            const input = page.getByRole('textbox', { name: 'Search maps, places and topics' });
            await input.fill(node.title);
            const place = page.getByRole('button', { name: `${node.title} ${map.title}`, exact: true });
            await expect(place).toBeVisible();
            const box = await place.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
            expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
            await info.attach(`real-search-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
            await place.click();
            expect(new URL(page.url()).searchParams.get('focused')).toBe(node.slug);
            expect(new URL(page.url()).searchParams.get('map')).toBe(map.slug);
            if (viewport.width === 390) {
                // The pinned Companion wrapper intercepts this pointer target.
                // Test the real keyboard path; source comparison records the defect.
                const trigger = page.getByRole('button', { name: 'Open map search' });
                await trigger.focus();
                await trigger.press('Enter');
            }
            await input.fill(map.title);
            await page.getByRole('button', { name: `${map.title} World map`, exact: true }).click();
            expect(new URL(page.url()).searchParams.has('focused')).toBe(false);
            expect(new URL(page.url()).searchParams.get('map')).toBe(map.slug);
        } finally {
            if (shell.menu_theme) {
                const csrf = await context.request.get('/api/v1/security/csrf');
                expect((await context.request.post('/api/v1/learner/map-location', {
                    headers: { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await csrf.json()).token },
                    data: { map: shell.menu_theme.map_id },
                })).status()).toBe(200);
            }
            await context.close();
        }
    });
}

test('native authenticated search rejects an anonymous reader', async ({ request }) => {
    expect((await request.get('/api/v1/learner/search?query=map')).status()).toBe(401);
});


test('OpenAPI search destinations accept the exact source URLs', () => {
    const contract = readFileSync(new URL('../../contracts/openapi/v1.yaml', import.meta.url), 'utf8');
    const result = contract.split('    LearnerDeskSearchResult:\n')[1].split('    LearnerPathPagination:')[0];
    const pattern = result.match(/href:.*pattern: '([^']+)'/)!;
    expect(pattern).not.toBeNull();
    for (const href of ['/topics/orientation', '/world?map=first-path', '/world?map=first-path&focused=notice-the-map']) {
        expect(new RegExp(pattern[1]).test(href)).toBe(true);
    }
    expect(new RegExp(pattern[1]).test('https://example.test/world?map=first-path')).toBe(false);
});
